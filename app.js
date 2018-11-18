// var netq = require('./server/netutils')
// netq.download("https://image.tmdb.org/t/p/w300/kqjL17yufvn9OVLyXYpvtyrFfak.jpg","./plop/fanart.jpg")

var express = require('express')
//var cors = require('cors'); // Chrome cast
var session = require('express-session');
//var formidable = require('formidable');
var MySQLStore = require('express-mysql-session')(session);
/// Setup express server
var app = express()
var server  = require('http').createServer(app);

var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var bodyParser = require('body-parser');

var MediaMgr = require('./server/media.js');
var SeriesMgr = require('./server/series.js');
var MoviesMgr = require('./server/movies');
var MovieDBMgr = require('./server/moviedb');
var DBStructure = require('./server/dbstructure.js');
var Settings = require('./server/settings.js');
var Users = require('./server/users');
var Bricks = require('./server/bricks');

//Lang
//var mustache = require('mustache');
var i18n  = require('i18n');
var consolidate = require('consolidate');
var path = require('path');
var fsUtils = require('./server/fsutils.js')

//Ffmpeg manager
const ProcessesMgr = require('./server/transcoding/ffmpegprocesses').FfmpegProcessManager;
const TranscodeMgr = require('./server/transcoding/transcodermanager');

//Upload
const Resumable = require('./server/resumable-node.js')
var resumable = new Resumable()
var crypto = require('crypto');
const busboy = require('connect-busboy');

//Importer
var Importer = require('./server/importer.js')

// Notifications
var io = require('socket.io').listen(server);

var mysql = require('mysql');
var dbPool  = mysql.createPool({
  connectionLimit : 10,
  host: '127.0.0.1',
  port: 3306,
  user: 'streamy',
  password: 'pwd',
  database: 'streamy',
  multipleStatements: true
});

//var dbConnection = mysql.createConnection(dbOptions).on;
var dbMgr = new DBStructure();
var settings = new Settings(dbMgr);

async function startApp(){
  if(!await dbMgr.initialize(dbPool)){
    process.exit(1);
  }

  await settings.pullSettings();

  //Setup lang
  i18n.configure({
    locales: ['en', 'fr'],
    defaultLocale: 'en',
    queryParameter: 'lang',
    directory: path.join(__dirname, '/static/locales'),
    api: {
      '__': 'translate',  
      '__n': 'translateN' 
    },
  });

  /////////// setup managers //////////////////////
  var processesMgr = new ProcessesMgr();
  var mediaMgr = new MediaMgr(dbMgr,processesMgr);
  var movieDBMgr = new MovieDBMgr(settings)
  var serieMgr = new SeriesMgr(dbMgr,settings,mediaMgr,movieDBMgr);
  var movieMgr = new MoviesMgr(dbMgr,settings,mediaMgr,movieDBMgr)

  var transcodeMgr = new TranscodeMgr(processesMgr,dbMgr,mediaMgr,settings);
  var importer = new Importer(dbMgr,mediaMgr, transcodeMgr,serieMgr);
  var userMgr = new Users(dbMgr)
  var bricksMgr = new Bricks(dbMgr)
 

  processesMgr.setMinTimeBetweenProgresses(5000);//Min 5 sec between updates 
  processesMgr.addWorkersFromDB(dbMgr,true);

  userMgr.addDefaultUsers();
  // setTimeout(function(){
  //   processesMgr.addWorkersFromDB(dbMgr,true);
  // },5000)
  //processesMgr.addWorkersFromDB(dbMgr,true);
  //processesMgr.addWorker("127.0.0.1",7000);


  /// Setup sessions
  var sessionStore = new MySQLStore({},dbMgr.getConnection());
  var sess = {
    secret : 'sup3rs3cur3',
    name : 'sessionId',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    useConnectionPooling: true
  };

  //Handle reconnection
  dbMgr.on("connected",function(connection){
    sess.store = new MySQLStore({},connection);
  })
  
  /// Setup auth
  var failedConnectionAttempt = 0;
  passport.use(new LocalStrategy(
    async function(username, password, done) {
      try{
        let authSuccess = await userMgr.checkUserPasswordSecure(username,password);
        if(!authSuccess){
          //TODO remove this warning in case user tap his pwd in username
          console.warn("User failed to authentificate: "+username);
          done(null, false);
        }else{
          let user = await userMgr.getUserInfosByName(username)
          return done(null, user);
        }
      }catch(err){
        console.error("Failed while authentificating: ",err);
        done(err);
      }

      // users.findByUsername( username, function (err, user) {
      //   if (err || !user || user.password !== password){
      //     failedConnectionAttempt++;
      //     console.warn("Failed connection attempts! "+failedConnectionAttempt);
      //     setTimeout(function(){
      //       done(null, false);
      //     },3000);
      //   }else{
      //     return done(null, user);
      //   }

      //});
    }
  ));

  // Configure Passport authenticated session persistence.
  //
  // In order to restore authentication state across HTTP requests, Passport needs
  // to serialize users into and deserialize users out of the session.  The
  // typical implementation of this is as simple as supplying the user ID when
  // serializing, and querying the user record by ID from the database when
  // deserializing.
  passport.serializeUser(function(user, cb) {
    cb(null, user.id);
  });

  passport.deserializeUser(async function(id, cb) {
    let user = await userMgr.getUserInfos(id)
    if(user){
      cb(null,user);
    }else{
      cb(new Error('User ' + id + ' does not exist'))
    }
    userMgr.updateUserLastConnection(id);
    // users.findById(id, function (err, user) {
    //   if (err) { return cb(err); }
    //   cb(null, user);
    // });
  });

  /// Setup more secure option in production
  if (app.get('env') === 'production') {
    //minimale security
    app.disable('x-powered-by');
    app.set('trust proxy', 1) // trust first proxy
    app.use(helmet());
    sess.cookie.secure = true // serve secure cookies
  }

  //The following commented block is for mpd quick tests
  app.get('/videos/*', function (req, res) {
    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');//Compulsory for casting
    res.sendFile(__dirname + '/static/videos/'+req.params[0]);
  })

  ///app.use(cors());
  app.use(express.static('static'));
  app.use(session(sess));
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(express.json());

  //Setup lang
  app.engine('html', consolidate.mustache); // Assign html to mustache engine
  app.set('view engine', 'html'); // Set default extension
  app.set('views', __dirname + '/views');
  //app.use(i18n.init);

  //register helper as a locals function wrapped as mustache expects
  function setupLocals(req, res, next){
    // mustache helper
    res.locals.__ = function () {
      return function (text, render) {
        return i18n.__.apply(req, arguments);
      };
    };
    next();
  }
  //app.use(setupLocals);

  function loggedIn(req, res, next) {
    if (req.user) {
        next();
    } else {
      setTimeout(function(){
        res.redirect('/login');
      },4000);
    }
  }

  function safePath(req, res, next){
    if(req.params[0].indexOf("..") != -1){
      res.sendStatus(500);
    }else{
      next();
    }
  }

  //TODO add path to all folders
  app.post('/login',
    passport.authenticate('local', { successRedirect: '/index',
                                    failureRedirect: '/login?status=failed',
                                    failureFlash: false }));

  app.get('/logout',
    function(req, res){
      req.logout();
      res.redirect('/login');
    });

  app.get('/', function (req, res) {
    res.redirect('/index');
  })

  app.get('/login', i18n.init, setupLocals, function (req, res) {
    res.render('login.html')
  })

  app.get('/index', i18n.init, setupLocals, loggedIn, function (req, res) {
    res.render('index.html',{UserName:req.user.displayName});
    //res.sendFile(__dirname + '/views/index.html');
  })

  app.get('/session-infos', loggedIn, function (req, res) {
    var sessInfos = {};
    sessInfos.name = req.user.displayName;
    res.send(sessInfos);
  })


  ////////////////////// templates //////////////////////////////////////////
  app.get('/movies.html', i18n.init, setupLocals, loggedIn, function (req, res) {
    res.render('templates/movies.html');
  })
  app.get('/movie.html', i18n.init, setupLocals, loggedIn, function (req, res) {
    res.render('templates/movie.html');
  })
  app.get('/series.html', i18n.init, setupLocals, loggedIn, function (req, res) {
    res.render('templates/series.html');
  })
  app.get('/serie.html', i18n.init, setupLocals, loggedIn, function (req, res) {
    res.render('templates/serie.html');
  })
  app.get('/addvideo.html', i18n.init, setupLocals, loggedIn, function (req, res) {
    res.render('templates/addvideo.html');
  })
  app.get('/workers.html', i18n.init, setupLocals, loggedIn, function (req, res) {
    res.render('templates/workers.html');
  })
  app.get('/transcoding.html', i18n.init, setupLocals, loggedIn, function (req, res) {
    res.render('templates/transcoding.html');
  })
  app.get('/mediacontent.html', i18n.init, setupLocals, loggedIn, function (req, res) {
    res.render('templates/mediacontent.html');
  })
  app.get('/common.html', i18n.init, setupLocals, loggedIn, function (req, res) {
    res.render('templates/common.html');
  })
  app.get('/users.html', i18n.init, setupLocals, loggedIn, function (req, res) {
    res.render('templates/users.html');
  })
  app.get('/storage.html', i18n.init, setupLocals, loggedIn, function (req, res) {
    res.render('templates/storage.html');
  })
  app.get('/settings.html', i18n.init, setupLocals, loggedIn, function (req, res) {
    res.render('templates/settings.html');
  })

  //static files from node_modules
  app.get('/js/shaka/*', loggedIn, safePath, function (req, res) {
    res.sendFile(__dirname + '/node_modules/shaka-player/' + req.params[0]);
  })

  app.get('/js/socket.io/*', loggedIn, safePath, function (req, res) {
    res.sendFile(__dirname + '/node_modules/socket.io-client/dist/' + req.params[0]);
  })

  app.get('/css/material-icons/*', loggedIn, safePath, function (req, res) {
    res.sendFile(__dirname + '/node_modules/material-icons/css/' + req.params[0]);
  })

  // API key
  app.get('/moviedb/key', loggedIn, function (req, res) {
    
    res.send(settings.global.tmdb_api_key);
  })

  ////////////////// Media //////////////

  // Get media info until depth
  app.get('/media/:mediaId', loggedIn, async function (req, res) {
    var mediaId = req.params.mediaId;
    var lang = req.query.lang;
    var userId = 1;//TODO get userId

    //Set default lang
    if(!lang){
      lang = 'en';
    }
    var langId = await dbMgr.getLangsId(lang);
    let infos = await mediaMgr.getMediaInfos(parseInt(mediaId),langId, 0, userId, [])


    if(infos === null){
      res.status(404).send('No season found');
    }else{
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(infos));
    }
  });

  app.post('/media/:id/refresh', loggedIn, async function (req, res) {
    //let type = req.params.type;
    let id = parseInt(req.params.id);
    let output = await mediaMgr.refreshMediaById(id);

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(output));
  })
  // app.get('/media/:mediaId/*', safePath, async function (req, res) {
  //   //TODO improve performances by caching requests
  //   var mediaId = req.params.mediaId;
  //   var media = await dbMgr.getMedia(mediaId);
  //   var brick = await dbMgr.getBrick(media.brick_id);
  //   //var path = brick.brick_path+"/series/"+serie.original_name+" ("+serie.release_date.getFullYear().toString()+")/" + req.params[0];
  //   let path = brick.brick_path+"/series/"+media.path+"/" + req.params[0];
    
  //   res.setHeader('Access-Control-Allow-Origin', '*');//Compulsory for casting
  //   res.sendFile(path);
  // })

  app.delete('/media/:mediaId/mpd/:folder', loggedIn, async function (req, res) {
    if(req.user && req.user.permissions.has("manage_content")){ //TODO check rights
      //let type = req.params.type;
      let mediaId = parseInt(req.params.mediaId);
      let folder = req.params.folder;
      
      let result = await mediaMgr.removeMpd(mediaId, folder)

      if(result){
        res.sendStatus(200);
      }else{
        res.sendStatus(500);
      }
    }else{
      res.status(401).send("You don't have the permission to delete content");
    }
  })

  app.get('/media/:id/mpd_files', loggedIn, async function (req, res) {
    //let type = req.params.type;
    let id = parseInt(req.params.id);
    let output = {};
    output = await mediaMgr.getPlayerMpdFiles(id)

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(output));
  })

  app.get('/media/:id/mpd_files_resume', loggedIn, async function (req, res) {
    //let type = req.params.type;
    let id = parseInt(req.params.id);
    let output = await mediaMgr.getMediaMpdsSummary(id)

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(output));
  })

  app.get('/media/:id/mpd_file/:folderName', loggedIn, async function (req, res) {
    //let type = req.params.type;
    let id = parseInt(req.params.id);
    let folderName = req.params.folderName;
    let output = await mediaMgr.getPlayerMpdFile(id,folderName)

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(output));
  })

  app.post('/media/:id/mpd/:folderName/refresh', loggedIn, async function (req, res) {
    //let type = req.params.type;
    let id = parseInt(req.params.id);
    let folderName = req.params.folderName;
    let output = await mediaMgr.refreshMediaMpd(id,folderName);

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(output));
  })

  app.delete('/media/:mediaId/mpd/:folder/representation/:rep_id', loggedIn, async function (req, res) {
    if(req.user && req.user.permissions.has("manage_content")){
      //let type = req.params.type;
      let mediaId = parseInt(req.params.mediaId);
      let folder = req.params.folder;
      let rep_id = req.params.rep_id; // rep id is not safe, it changes on delete
      var safeHash = req.query.safe_hash; //Safer id to prevent the unwanted deletion of rep

      let result = await mediaMgr.removeRepresentation(mediaId, folder,rep_id,safeHash)

      if(result){
        res.sendStatus(200);
      }else{
        res.sendStatus(500);
      }
    }else{
      res.status(401).send("You don't have the permission to delete content");
    }
  })

  app.get('/brick/:brickid/*', safePath, async function (req, res) {
    var brickid = req.params.brickid;
    var brick = await dbMgr.getBrick(brickid);

    res.setHeader('Access-Control-Allow-Origin', '*');//Compulsory for casting
    res.sendFile(brick.brick_path+"/" + req.params[0]);
  })

  ////////////////// Series specific //////////////

  // get series
  app.get('/series', loggedIn, async function (req, res) {
    if(req.user){ //TODO check rights
      var lang = req.query.lang;
      var userId = 1;//TODO get userId

      //Set default lang
      if(!lang){
        lang = 'en';
      }
      var langId = await dbMgr.getLangsId(lang);
      let series = await mediaMgr.getMediaListByCategory(1, langId, userId, "")
      //let series = await serieMgr.getSeriesInfos(lang);

      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(series));
    }
  });

  app.get('/series/:mediaId/seasons', async function (req, res) {
    var mediaId = req.params.mediaId;
    var lang = req.query.lang;
    var userId = 1;//TODO get userId

    //Set default lang
    if(!lang){
      lang = 'en';
    }
    var langId = await dbMgr.getLangsId(lang);
    let sortKeyDepth = ["season_number","episode_number"]
    let infos = await mediaMgr.getChildrenMediaInfos(parseInt(mediaId),langId, 1, userId, sortKeyDepth)

    if(infos === null){
      res.status(404).send('No season found');
    }else{
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(infos));
    }

    //res.send(MovieDB_KEY);
  });

  app.get('/episode/id', loggedIn, async function (req, res) {
    if(req.user){ //TODO check rights
      let serieId = parseInt(req.query.serie_id);
      let seasonNb = parseInt(req.query.season_nb);
      let episodeNb = parseInt(req.query.episode_nb);

      var episodeId = await dbMgr.getEpisodeId(serieId,seasonNb,episodeNb);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({episode_id:episodeId}));
    }
  });

  // Add serie
  app.post('/series', loggedIn, async function (req, res) {
    if(req.user && req.user.permissions.has("add_media")){ //TODO check rights
      console.log("body",req.body);

      //For the moment only moviedb id
      if(req.body.moviedbId != null){

        // prepare response
        res.setHeader('Content-Type', 'application/json');

        //Check if serie already exists
        let mediaId = await serieMgr.findSerieFromMoviedbId(req.body.moviedbId);
        if(mediaId){
          res.status(200).send(JSON.stringify({id:mediaId}));
          return;
        }

        //The serie don't exist, create it
        console.log("Adding a new serie");
        serieId = await serieMgr.addSerieFromMovieDB(req.body.moviedbId);
        if(serieId !== null){
          res.status(200).send(JSON.stringify({id:serieId}));
        }else{
          console.error("Failed to add serie from ",req.body);
          res.status(500).send('Cannot create serie');
        }
      }else{
        res.status(400).send('Unknown request');
      }
    }else{
      res.status(401).send("You don't have the permission to add a serie");
    }
  })

  ////////////////// Movies specific //////////////
  app.get('/movies', loggedIn, async function (req, res) {
    if(req.user){ 
      var lang = req.query.lang;
      var userId = 1;//TODO get userId

      //Set default lang
      if(!lang){
        lang = 'en';
      }
      var langId = await dbMgr.getLangsId(lang);
      let movies = await mediaMgr.getMediaListByCategory(4, langId, userId, "")
      //let series = await serieMgr.getSeriesInfos(lang);

      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(movies));
    }
  });

  // Add movie
  app.post('/movies', loggedIn, async function (req, res) {
    if(req.user && req.user.permissions.has("add_media")){ //TODO check rights
      console.log("body",req.body);

      //For the moment only moviedb id
      if(req.body.moviedbId != null){
        try{
          // prepare response
          res.setHeader('Content-Type', 'application/json');

          //Check if movie already exists
          let mediaId = await movieMgr.findMovieFromMoviedbId(req.body.moviedbId);
          if(mediaId){
            res.status(200).send(JSON.stringify({id:mediaId}));
            return;
          }

          //The serie don't exist, create it
          console.log("Adding a new movie");

          let dbId = await movieMgr.addMovieFromMovieDB(req.body.moviedbId);
          res.status(201).send(JSON.stringify({id:dbId}));
        } catch (e) {
          console.error("Failing adding movie from TheMovieDB ",req.body.moviedbId,e);
          res.status(500).send('Cannot create movie: '+e.message);
        }
        

      }else{
        res.status(400).send('Unknown request');
      }
    }else{
      res.status(401).send("You don't have the permission to add a movie");
    }
  })
  
  ////////////////////// UPLOAD ///////////////////////////////

  // Handle uploads through Resumable.js
  let tmpUploadPath = settings.getUploadPath()+"/tmp"
  fsUtils.mkdirp(tmpUploadPath);
  resumable.setTargetFolder(settings.getUploadPath())

  // retrieve file id. invoke with /fileid?filename=my-file.jpg&size=158624&id=445
  app.get('/fileid', loggedIn, function(req, res){
    if(req.user){
      if(!req.query.filename || !req.query.size){
        return res.status(500).end('query parameter missing');
      }
      let name = req.query.filename+req.query.size;
      if(req.query.id){
        name += req.query.id;
      }
      // create md5 hash from filename
      res.end(
        crypto.createHash('md5')
        .update(name)
        .digest('hex')
      );
    }else{
      console.warn("Unlogged user try to get files")
    }
  });

  var busMiddleware = busboy({ highWaterMark: 2 * 1024 * 1024})
  app.post('/upload/media/:media_id', loggedIn, busMiddleware, async function(req,res){
    var id = parseInt(req.params.media_id);
    

    if(req.user && req.user.permissions.has("upload_content")){ //TODO check rights
      if(!id ){
        res.sendStatus(400);
        return;
      }
  
      let result = await resumable.postSequential(req);
      if(result.status == 201){
        var filename = path.basename(result.filename);
        transcodeMgr.addMedia(filename,result.original_filename,parseInt(id));
      }
      res.sendStatus(result.status);
    }else{
      res.sendStatus(403);
    }
  })

  // get last time an upload packet has been received
  app.get('/upload/last_time', loggedIn, function(req, res){
    if(req.user){
      let last_upload_infos = resumable.getLastUploadInfos();
      res.send(last_upload_infos);
    }else{
      console.warn("Unlogged user try to get /upload/last_time")
    }
  });

  // Handle status checks on chunks through Resumable.js
  app.get('/upload/:type', loggedIn, async function(req, res){
    var type = req.params.type;
    if(req.user){ //TODO check rights
      let result = await resumable.get(req);
      //console.log('GET', status);
      res.sendStatus(result.status);
    }
  });

  ////////////////// Workers  //////////////
  app.get('/workers', loggedIn, async function (req, res) {
    if(req.user){ //TODO check rights
      let workers = processesMgr.getLightWorkers();

      res.setHeader('Content-Type', 'application/json');
      //console.log(workers)
      res.send(JSON.stringify(workers));
    }
  });

  app.post('/workers', loggedIn, async function (req, res) {
    if(req.user && req.user.permissions.has("manage_workers")){
      var ip = req.body.ip;
      var port = req.body.port;
      if(ip && ip.length > 0 && port > 0){
        processesMgr.addWorker(ip,port);
        res.sendStatus(200)
      }else{
        console.warn("Cannot add worker with invalid ip and port"  )
        res.sendStatus(500)
      }
    }else{
      res.status(401).send("You don't have the permission to add workers")
    }
  });

  app.post('/workers/:id/status', loggedIn, async function (req, res) {
    if(req.user && req.user.permissions.has("manage_workers")){ //TODO check rights
      var id = req.params.id;
      var statusValue = req.body.status;
      processesMgr.enableWorkerFromId(id,statusValue);
      res.sendStatus(200)
    }else{
      res.status(401).send("You don't have the permission to change worker status")
    }
  });

  app.post('/workers/:id/connect', loggedIn, async function (req, res) {
    if(req.user && req.user.permissions.has("manage_workers")){ //TODO check rights
      var id = req.params.id;
      processesMgr.tryConnectWorker(id);
      res.sendStatus(200)
    }else{
      res.status(401).send("You don't have the permission to connect workers")
    }
  });
  

  app.delete('/workers/:id', loggedIn, async function (req, res) {
    if(req.user && req.user.permissions.has("manage_workers")){ //TODO check rights
      var id = req.params.id;
      if(processesMgr.removeWorker(id)){
        res.sendStatus(200)
      }else{
        res.sendStatus(500)
      }
    }else{
      res.sendStatus(401).send("You don't have the permission to remove workers")
    }
  });

    ////////////////// Users  //////////////

    //Get our own status
    app.get('/user/permissions', loggedIn, async function (req, res) {
      if(req.user){
        let permissions = await userMgr.getUserPermissions(req.user.id);
  
        res.setHeader('Content-Type', 'application/json');
        //console.log(workers)
        let output = {};
        for(let item of permissions.keys()){
          output[item] = true;
        }
        res.send(JSON.stringify(output));
      }else{
        res.sendStatus(401);
      }
    });

    app.get('/users', loggedIn, async function (req, res) {
      if(req.user && req.user.permissions.has("manage_users")){ //TODO check rights
        let users = await userMgr.getAllUserInfos();
  
        res.setHeader('Content-Type', 'application/json');
        //console.log(workers)
        res.send(JSON.stringify(users));
      }
    });
  
    //Add user
    app.post('/users', loggedIn, async function (req, res) {
      if(req.user && req.user.permissions.has("manage_users")){
        let username = req.body.username;
        let password = req.body.password;
        let role = req.body.role;
        try{
          let roleId = await dbMgr.getRoleIdByName(role)
          if(!roleId){
            console.warn("Cannot add user with unexisting role",role)
            res.status(400).send("unexisting role "+role)
            return;
          }
          await userMgr.addUser(username,password,roleId,255,"","")
          res.sendStatus(200);
        }catch(err){
          console.warn("Cannot add user:",err)
          res.status(400).send(err.message)
        }
      }else{
        res.status(401).send("You don't have the permission to add users")
      }
    });

    //Update user
    app.post('/users/:id', loggedIn, async function (req, res) {
      if(req.user && req.user.permissions.has("manage_users")){
        let userId = req.params.id;
        let username = req.body.username;
        let password = req.body.password;
        let role = req.body.role;

        if(!userId){
          res.status(400).send('No userId provided');
          return;
        }
        userId = parseInt(userId);

        try{
          if(password.length > 0){
            await userMgr.changeUserPwd(userId,password);
          }

          if(username.length > 0){
            await userMgr.changeUserName(userId,username);
          } 

          if(role.length > 0 && userId !== 1){//Prevent admin to change role
            let roleId = await dbMgr.getRoleIdByName(role)
            await userMgr.changeUserRole(userId,roleId);
          }
          res.sendStatus(200)
        }catch(err){
          console.warn("Cannot update user:",err)
          res.status(400).send(err)
        }
      }else{
        res.status(401).send("You don't have the permission to add users")
      }
    });
  
    app.delete('/users/:id', loggedIn, async function (req, res) {
      try{
        if(req.user && req.user.permissions.has("manage_users")){
          var id = parseInt(req.params.id);
          if(await userMgr.removeUser(id)){
            res.sendStatus(200)
          }else{
            res.sendStatus(500)
          }
        }else{
          res.sendStatus(401).send("You don't have the permission to remove users")
        }
      }catch(err){
        console.warn("Cannot remove user:",err)
        res.status(400).send(err.message)
      }
    });

  ////////////////// Bricks  //////////////

  app.get('/bricks', loggedIn, async function (req, res) {
    if(req.user && req.user.permissions.has("manage_bricks")){ //TODO check rights
      let bricks = await bricksMgr.getBricks();

      res.setHeader('Content-Type', 'application/json');
      //console.log(workers)
      res.send(JSON.stringify(bricks));
    }
  });

  //Add brick
  app.post('/bricks', loggedIn, async function (req, res) {
    if(req.user && req.user.permissions.has("manage_bricks")){
      let alias = req.body.alias;
      let path = req.body.path;
      let enabled = req.body.enabled;

      try{
        await bricksMgr.addBrick(alias,path,enabled)
        res.sendStatus(200);
      }catch(err){
        console.warn("Cannot add user:",err)
        res.status(400).send(err.message)
      }
    }else{
      res.status(401).send("You don't have the permission to add brick")
    }
  });

  //Update user
  app.post('/bricks/:id', loggedIn, async function (req, res) {
    if(req.user && req.user.permissions.has("manage_bricks")){
      let id = req.params.id;
      let alias = req.body.alias;
      let paths = req.body.paths;
      let enabled = req.body.enabled;

      if(!id){
        res.status(400).send('No id provided');
        return;
      }
      id = parseInt(id);

      try{
        if(alias.length > 0){
          await bricksMgr.updateBrickAlias(id,alias);
        }

        if(paths.length > 0){
          await bricksMgr.updateBrickPath(id,paths);
        } 

        await bricksMgr.updateBrickStatus(id,enabled);
        res.sendStatus(200)
      }catch(err){
        console.warn("Cannot update brick:",id,err)
        res.status(400).send(err)
      }
    }else{
      res.status(401).send("You don't have the permission to update brick")
    }
  });

  app.delete('/bricks/:id', loggedIn, async function (req, res) {
    try{
      if(req.user && req.user.permissions.has("manage_bricks")){
        var id = parseInt(req.params.id);
        await bricksMgr.removeBrick(id)
        res.sendStatus(200)
      }else{
        res.sendStatus(401).send("You don't have the permission to remove users")
      }
    }catch(err){
      console.warn("Cannot remove brick:",err)
      res.status(400).send(err.message)
    }
  });

  ////////////////// Settings  //////////////

  app.get('/settings', loggedIn, async function (req, res) {
    if(req.user && req.user.permissions.has("manage_settings")){ //TODO check rights
      await settings.pullSettings();

      res.setHeader('Content-Type', 'application/json');
      //console.log(workers)
      res.send(JSON.stringify(settings.global));
    }
  });

  //Update settings
  app.post('/settings', loggedIn, async function (req, res) {
    if(req.user && req.user.permissions.has("manage_settings")){
      try{
        let global = req.body;
        await settings.setGlobalSetting(global)
        res.sendStatus(200);
      }catch(err){
        console.warn("Cannot update settings:",err)
        res.status(400).send(err)
      }
    }else{
      res.status(401).send("You don't have the permission to update settings")
    }
  });

  ////////////////// Processes  //////////////

  app.get('/transcoding_tasks', loggedIn, async function (req, res) {
    if(req.user){ //TODO check rights
      let progressions = transcodeMgr.getProgressions();
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(progressions));
    }
  });

  app.post('/transcoding_tasks/:filename/stop', loggedIn, async function (req, res) {
    if(req.user && req.user.permissions.has("manage_transcoding")){ //TODO check rights
      var filename = req.params.filename;
      transcodeMgr.stopTask(filename);
      res.sendStatus(200)
    }else{
      res.status(401).send("You don't have the permission to stop tasks")
    }
  });

  app.post('/transcoding_tasks/:filename/start', loggedIn, async function (req, res) {
    if(req.user && req.user.permissions.has("manage_transcoding")){ //TODO check rights
      var filename = req.params.filename;
      transcodeMgr.startTask(filename);
      res.sendStatus(200)
    }else{
      res.status(401).send("You don't have the permission to start tasks")
    }
  });

  app.delete('/transcoding_tasks/:filename', loggedIn, async function (req, res) {
    if(req.user && req.user.permissions.has("manage_transcoding")){ //TODO check rights
      var filename = req.params.filename;
      if(transcodeMgr.removeOfflineTask(filename)){
        res.sendStatus(200)
      }else{
        res.sendStatus(500)
      }
    }else{
      res.status(401).send("You don't have the permission to remove tasks")
    }
  });


  /////////////////////// Notifications ///////////////////////////
  
  var wsWorkers = io.of('/notifications/workers');
  processesMgr.on('workerAdded', function(worker){
    wsWorkers.emit('workerAdded',processesMgr.getLightWorker(worker))
  });
  processesMgr.on('workerEnabled', function(worker){
    wsWorkers.emit('workerEnabled',worker.ip,worker.port)
  });
  processesMgr.on('workerDisabled', function(worker){
    wsWorkers.emit('workerDisabled',worker.ip,worker.port)
  });
  processesMgr.on('workerRemoved', function(worker){
    wsWorkers.emit('workerRemoved',worker.ip,worker.port)
  });
  processesMgr.on('workerStatus', function(ip,port,status){
    wsWorkers.emit('workerStatus',ip,port,status)
  });

  var wsTranscode = io.of('/notifications/transcoding');
  transcodeMgr.on('taskAdded', function(task){
    wsTranscode.emit('taskAdded',task)
  });
  transcodeMgr.on('taskUpdated', function(task){
    wsTranscode.emit('taskUpdated',task)
  });
  transcodeMgr.on('taskRemoved', function(filename){
    wsTranscode.emit('taskRemoved',filename)
  });
  

  // Restart failed or not finished add file tasks
  // as soon as there is a ffmpeg worker available
  processesMgr.on('workerAvailable', function(){
    transcodeMgr.loadAddFileTasks();
  });
    
  ///////// Start the server ///////
  server.listen(8080, function () {

    var host = server.address().address
    var port = server.address().port
    
    console.log("Streamy node listening at http://%s:%s", host, port)
  });

  // importer.importBrick('/data/streamy',"brick1");
  // importer.refreshBrickMetadata(0);
  // importer.refreshBrickData(0)
  // let dostuff = async function (){
  //   //mediaMgr.refreshBrickMedias(2);
  //   //importer.refreshBrickMetadata(2);
  //   importer.importBrick('/data/streamy',"brick1");
  //   //let success = await transcodeMgr.updateMpdAudioChannels("/data/upload/allsub.mpd")
  // }
  // setTimeout(dostuff, 1500, 'funky');
  
  // TODO properly shutdown
  // sessionStore.close();
}

startApp();