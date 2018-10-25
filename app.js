// var netq = require('./server/netutils')
// netq.download("https://image.tmdb.org/t/p/w300/kqjL17yufvn9OVLyXYpvtyrFfak.jpg","./plop/fanart.jpg")

var express = require('express')
//var cors = require('cors'); // Chrome cast
var session = require('express-session');
var formidable = require('formidable');
var MySQLStore = require('express-mysql-session')(session);


var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var bodyParser = require('body-parser');
var users = require('./server/users');
var MediaMgr = require('./server/media.js');
var SeriesMgr = require('./server/series.js');
var DBStructure = require('./server/dbstructure.js');
var Settings = require('./server/settings.js');

//Lang
var mustache = require('mustache');
var i18n  = require('i18n');
var path = require('path');
var consolidate = require('consolidate');

var fsUtils = require('./server/fsutils.js')

//Ffmpeg manager
const ProcessesMgr = require('./server/transcoding/ffmpegprocesses').FfmpegProcessManager;
const TranscodeMgr = require('./server/transcoding/transcodermanager');

//Upload
const Resumable = require('./server/resumable-node.js')
var resumable = new Resumable()
var multipart = require('connect-multiparty');
var crypto = require('crypto');


if(process.argv.length <= 2){
  console.error("Moviedb key missing");
  process.exit(1);
}

console.log("API key: ",process.argv[2]);

//For local use
const MovieDB_KEY = process.argv[2];
//var helmet = require('helmet');

//Setup db
var dbOptions = {
  host: '127.0.0.1',
  port: 3306,
  user: 'streamy',
  password: 'pwd',
  database: 'streamy',
  multipleStatements: true
};
//var dbConnection = mysql.createConnection(dbOptions).on;
var dbMgr = new DBStructure();
var settings = new Settings(dbMgr);
var appstarted = false;

dbMgr.initialize(dbOptions,async function(err) {
  if (err) {
    process.exit(1);
  }else{
    await settings.pullSettings();

    // This callback is called each time there is a reconnection
    // with the db
    if(!appstarted){
      startApp();
    }
  }
});

function startApp(){
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



  // setup managers
  var mediaMgr = new MediaMgr(dbMgr,settings);
  var serieMgr = new SeriesMgr(dbMgr,settings,mediaMgr);

  var processesMgr = new ProcessesMgr();
  var transcodeMgr = new TranscodeMgr(processesMgr,dbMgr,settings);

  //TODO add worker from config file and/or web page
  processesMgr.addWorkersFromDB(dbMgr,true);
  //processesMgr.addWorker("127.0.0.1",7000);

  // var con = mysql.createConnection({
  //   host: "127.0.0.1",
  //   user: "streamy",
  //   password: "pwd"
  // });

  // con.connect(function(err) {
  //   if (err) throw err;
  //   console.log("Connected!");
  // });

  //Https
  //var https = require('https');
  //var fs = require('fs');

  // Setup express based server
  // var ssl_options = {
  //   key: fs.readFileSync('privatekey.pem'),
  //   cert: fs.readFileSync('certificate.pem')
  // };

  /// Setup sessions
  var sessionStore = new MySQLStore({},dbMgr.getConnection());
  var sess = {
    secret : 'sup3rs3cur3',
    name : 'sessionId',
    store: sessionStore,
    resave: false,
    saveUninitialized: false
  };

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

  /// Setup express server
  var app = express()

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


  //Setup lang
  app.engine('html', consolidate.mustache); // Assign html to mustache engine
  app.set('view engine', 'html'); // Set default extension
  app.set('views', __dirname + '/views');
  app.use(i18n.init);

  app.use(express.json());

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
  app.use(setupLocals);

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

  app.get('/login', function (req, res) {
    res.render('login.html')
  })

  app.get('/index', loggedIn, function (req, res) {
    res.render('index.html',{UserName:req.user.displayName});
    //res.sendFile(__dirname + '/views/index.html');
  })

  app.get('/session-infos', loggedIn, function (req, res) {
    var sessInfos = {};
    sessInfos.name = req.user.displayName;
    res.send(sessInfos);
  })

  app.get('/progression-infos', loggedIn, function (req, res) {
    res.send(transcodeMgr.getProgressions());
  })

  // templates

  app.get('/movies.html', loggedIn, function (req, res) {
    res.sendFile(__dirname + '/views/templates/movies.html');// TODO template here
  })
  app.get('/series.html', loggedIn, function (req, res) {
    res.sendFile(__dirname + '/views/templates/series.html');// TODO template here
  })
  app.get('/serie.html', loggedIn, function (req, res) {
    res.sendFile(__dirname + '/views/templates/serie.html');// TODO template here
  })
  app.get('/addvideo.html', loggedIn, function (req, res) {
    res.sendFile(__dirname + '/views/templates/addvideo.html');// TODO template here
  })
  app.get('/workers.html', loggedIn, function (req, res) {
    res.render('templates/workers.html');
  })

  //static files from node_modules
  app.get('/js/shaka/*', loggedIn, safePath, function (req, res) {
    res.sendFile(__dirname + '/node_modules/shaka-player/' + req.params[0]);
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

  ////////////////// Workers  //////////////
  app.get('/workers', loggedIn, async function (req, res) {
    if(req.user){ //TODO check rights
      var lang = req.query.lang;
      var userId = 1;//TODO get userId

      //Set default lang
      if(!lang){
        lang = 'en';
      }

      let workers = processesMgr.getWorkers();

      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(workers));
    }
  });

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
        //Check if serie already added
        let serieId = await serieMgr.findSerieFromMoviedbId(req.body.moviedbId);

        // prepare response
        res.setHeader('Content-Type', 'application/json');
        if(serieId === null){
          //The serie don't exist, create it
          console.log("Adding a new serie");
          serieId = await serieMgr.addSerieFromMovieDB(req.body.moviedbId);
        }
        
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
  resumable.setTemporaryFolder(settings.getUploadPath())

  // retrieve file id. invoke with /fileid?filename=my-file.jpg
  app.get('/fileid', loggedIn, function(req, res){
    if(req.user){
      if(!req.query.filename){
        return res.status(500).end('query parameter missing');
      }
      // create md5 hash from filename
      res.end(
        crypto.createHash('md5')
        .update(req.query.filename)
        .digest('hex')
      );
    }else{
      console.warn("Unlogged user try to get files")
    }
  });

  var multipartMiddleware = multipart({uploadDir:tmpUploadPath});
  app.post('/upload/media/:media_id', loggedIn, multipartMiddleware, async function(req,res){
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

  

  //app.use(multipart()); // for upload

  var server = app.listen(8080, function () {

    var host = server.address().address
    var port = server.address().port
    
    console.log("Streamy node listening at http://%s:%s", host, port)
  });

  // Restart failed or not finished add file tasks
  // as soon as there is a ffmpeg worker available
  processesMgr.on('workerAvailable', function(){
    transcodeMgr.loadAddFileTasks();
  });

  appstarted = true;
  // TODO properly shutdown
  // sessionStore.close();
}