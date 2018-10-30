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
var users = require('./server/users');
var MediaMgr = require('./server/media.js');
var SeriesMgr = require('./server/series.js');
var DBStructure = require('./server/dbstructure.js');
var Settings = require('./server/settings.js');

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
var multipart = require('connect-multiparty');
var crypto = require('crypto');

//Importer
var Importer = require('./server/importer.js')

// Notifications
var io = require('socket.io').listen(server);

if(process.argv.length <= 2){
  console.error("Moviedb key missing");
  process.exit(1);
}

console.log("API key: ",process.argv[2]);

//For local use
const MovieDB_KEY = process.argv[2];

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
  var mediaMgr = new MediaMgr(dbMgr,settings);
  var serieMgr = new SeriesMgr(dbMgr,settings,mediaMgr);

  var processesMgr = new ProcessesMgr();
  var transcodeMgr = new TranscodeMgr(processesMgr,dbMgr,settings);
  var importer = new Importer(dbMgr,transcodeMgr,serieMgr);

  processesMgr.setMinTimeBetweenProgresses(5000);//Min 5 sec between updates 
  processesMgr.addWorkersFromDB(dbMgr,true);
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
    function(username, password, done) {
      
      users.findByUsername( username, function (err, user) {
        if (err || !user || user.password !== password){
          failedConnectionAttempt++;
          console.warn("Failed connection attempts! "+failedConnectionAttempt);
          setTimeout(function(){
            done(null, false);
          },3000);
        }else{
          return done(null, user);
        }
        // if (err) { return done(err); }
        // if (!user) { return done(null, false); }
        // if (user.password !== password) { return done(null, false); }
        // return done(null, user);
      });
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

  passport.deserializeUser(function(id, cb) {
    users.findById(id, function (err, user) {
      if (err) { return cb(err); }
      cb(null, user);
    });
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
    res.sendFile(__dirname + '/views/templates/movies.html');// TODO mustache here
  })
  app.get('/series.html', i18n.init, setupLocals, loggedIn, function (req, res) {
    res.sendFile(__dirname + '/views/templates/series.html');// TODO mustache here
  })
  app.get('/serie.html', i18n.init, setupLocals, loggedIn, function (req, res) {
    res.render('templates/serie.html');
  })
  app.get('/addvideo.html', i18n.init, setupLocals, loggedIn, function (req, res) {
    res.sendFile(__dirname + '/views/templates/addvideo.html');// TODO mustache here
  })
  app.get('/workers.html', i18n.init, setupLocals, loggedIn, function (req, res) {
    res.render('templates/workers.html',req.lang);
  })
  app.get('/transcoding.html', i18n.init, setupLocals, loggedIn, function (req, res) {
    res.render('templates/transcoding.html',req.lang);
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
    res.send(MovieDB_KEY);
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

  app.get('/mpd_files/:id', loggedIn, async function (req, res) {
    //let type = req.params.type;
    let id = parseInt(req.params.id);
    let output = {};
    let category_id = await dbMgr.getMediaCategory(id)
    if(category_id == 3){
      output = await serieMgr.getMpdFiles(id)
    }else{
      output = await mediaMgr.getMpdFiles(id)
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(output));
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

  // Add serie
  app.post('/series', loggedIn, async function (req, res) {
    if(req.user){ //TODO check rights
      console.log("body",req.body);

      //For the moment only moviedb id
      if(req.body.moviedbId != null){

        // prepare response
        res.setHeader('Content-Type', 'application/json');

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
      res.status(401).send('You need to login');
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

  var multipartMiddleware = multipart({uploadDir:tmpUploadPath});
  var uploadErrorHandler = function(err, req, res, next) {
    resumable.cancelRequest(req);
    res.status(424).send('Request cancelled');
  }
  app.post('/upload/media/:media_id', loggedIn, multipartMiddleware, uploadErrorHandler, async function(req,res){
    var id = req.params.media_id;
    if(req.user){ //TODO check rights
      let result = await resumable.post(req, true);
      //console.log('POST', result.status, result.original_filename, result.identifier);
      //If the file has been received completly
      if(result.status == 201){
        var filename = path.basename(result.filename);
        transcodeMgr.addMedia(filename,result.original_filename,parseInt(id));
      }
      res.sendStatus(result.status);
    }
  })

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
    if(req.user){ //TODO check rights
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
      res.sendStatus(401)
    }
  });

  app.post('/workers/:id/status', loggedIn, async function (req, res) {
    if(req.user){ //TODO check rights
      var id = req.params.id;
      var statusValue = req.body.status;
      processesMgr.enableWorkerFromId(id,statusValue);
      res.sendStatus(200)
    }else{
      res.sendStatus(401)
    }
  });

  app.post('/workers/:id/connect', loggedIn, async function (req, res) {
    if(req.user){ //TODO check rights
      var id = req.params.id;
      processesMgr.tryConnectWorker(id);
      res.sendStatus(200)
    }else{
      res.sendStatus(401)
    }
  });
  

  app.delete('/workers/:id', loggedIn, async function (req, res) {
    if(req.user){ //TODO check rights
      var id = req.params.id;
      if(processesMgr.removeWorker(id)){
        res.sendStatus(200)
      }else{
        res.sendStatus(500)
      }
    }else{
      res.sendStatus(401)
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
    if(req.user){ //TODO check rights
      var filename = req.params.filename;
      transcodeMgr.stopTask(filename);
      res.sendStatus(200)
    }else{
      res.sendStatus(401)
    }
  });

  app.post('/transcoding_tasks/:filename/start', loggedIn, async function (req, res) {
    if(req.user){ //TODO check rights
      var filename = req.params.filename;
      transcodeMgr.startTask(filename);
      res.sendStatus(200)
    }else{
      res.sendStatus(401)
    }
  });

  app.delete('/transcoding_tasks/:filename', loggedIn, async function (req, res) {
    if(req.user){ //TODO check rights
      var filename = req.params.filename;
      if(transcodeMgr.removeOfflineTask(filename)){
        res.sendStatus(200)
      }else{
        res.sendStatus(500)
      }
    }else{
      res.sendStatus(401)
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

  //importer.importBrick('/data/streamy',"brick1");
  //importer.refreshBrickMetadata(0);
  importer.refreshBrickData(0)
  let dostuff = async function (){
    //let success = await transcodeMgr.updateMpdAudioChannels("/data/upload/allsub.mpd")

  }
  setTimeout(dostuff, 1500, 'funky');
  
  // TODO properly shutdown
  // sessionStore.close();
}

startApp();