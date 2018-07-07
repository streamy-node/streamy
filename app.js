// var netq = require('./server/netutils')
// netq.download("https://image.tmdb.org/t/p/w300/kqjL17yufvn9OVLyXYpvtyrFfak.jpg","./plop/fanart.jpg")

var express = require('express')
var cors = require('cors'); // Chrome cast
var session = require('express-session');
var formidable = require('formidable');
var MySQLStore = require('express-mysql-session')(session);


var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var bodyParser = require('body-parser');
var users = require('./server/users');
var SeriesMgr = require('./server/series.js');
var DBStructure = require('./server/dbstructure.js');
var Settings = require('./server/settings.js');

//Lang
var mustache = require('mustache');
var i18n  = require('i18n');
var path = require('path');
var consolidate = require('consolidate');


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

dbMgr.initialize(dbOptions,function(err) {
  if (err) {
    process.exit(1);
  }else{
    settings.pullSettings();
  }
});

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
var serieMgr = new SeriesMgr(dbMgr,settings);

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
passport.use(new LocalStrategy(
  function(username, password, done) {
    users.findByUsername( username, function (err, user) {
      if (err) { return done(err); }
      if (!user) { return done(null, false); }
      if (user.password !== password) { return done(null, false); }
      return done(null, user);
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


app.use(express.static('static'));
app.use(cors());
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
app.use(function (req, res, next) {
  // mustache helper
  res.locals.__ = function () {
    return function (text, render) {
      return i18n.__.apply(req, arguments);
    };
  };

  next();
});

function loggedIn(req, res, next) {
  if (req.user) {
      next();
  } else {
      res.redirect('/login');
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

// templates

app.get('/movies.html', function (req, res) {
  res.sendFile(__dirname + '/views/templates/movies.html');
})
app.get('/series.html', function (req, res) {
  res.sendFile(__dirname + '/views/templates/series.html');
})
app.get('/serie.html', function (req, res) {
  res.sendFile(__dirname + '/views/templates/serie.html');
})
app.get('/addvideo.html', function (req, res) {
  res.sendFile(__dirname + '/views/templates/addvideo.html');
})

// API key
app.get('/moviedb/key', function (req, res) {
  res.send(MovieDB_KEY);
})

// get series
app.get('/series', async function (req, res) {
  if(req.user){ //TODO check rights
    var lang = req.query.lang;
    //Set default lang
    if(!lang){
      lang = 'en';
    }

    let series = await serieMgr.getSeriesInfos(lang);

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(series));
  }
});

app.get('/series/:serieId', async function (req, res) {
  var serieId = req.params.serieId;
  var lang = req.query.lang;

  //Set default lang
  if(!lang){
    lang = 'en';
  }

  let infos = await serieMgr.getSerieInfos(parseInt(serieId),lang);

  if(infos === null){
    res.status(404).send('Serie not found');
  }else{
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(infos));
  }

  //res.send(MovieDB_KEY);
});

app.get('/series/:serieId/seasons', async function (req, res) {
  var serieId = req.params.serieId;
  var lang = req.query.lang;

  //Set default lang
  if(!lang){
    lang = 'en';
  }

  let infos = await serieMgr.getSeasonsEpisodesInfos(parseInt(serieId),lang);

  if(infos === null){
    res.status(404).send('No season found');
  }else{
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(infos));
  }

  //res.send(MovieDB_KEY);
});

//DEPRECATED use /series/:serieId/data/* instead
app.get('/data/series/:brickid/*', async function (req, res) {
  var brickid = req.params.brickid;
  var brick = await dbMgr.getBrick(brickid);
  res.sendFile(brick.path+"/series/" + req.params[0]);
})

app.get('/series/:serieId/data/*', async function (req, res) {
  //TODO improve performances by caching requests
  var serieId = req.params.serieId;
  var serie = await dbMgr.getSerie(serieId);
  var brick = await dbMgr.getBrick(serie.brick_id);
  var path = brick.path+"/series/"+serie.original_name+" ("+serie.release_date.getFullYear().toString()+")/" + req.params[0];
  res.sendFile(path);
})

// Upload files
app.post('/upload/:type', async function(req,res){
  if(req.user){ //TODO check rights
    var type = req.params.type;
    var form = new formidable.IncomingForm();
    form.uploadDir = settings.getUploadPath();
    form.keepExtensions = true;
    form.maxFileSize = 10 * 1024 * 1024 * 1024; // 10 Go
    form.multiples = true;

    var uploadInfos = {};
    uploadInfos.user = req.user;
    uploadInfos.id = null;
    uploadInfos.type = null;

    form.parse(req, function(err, fields, files) {
      console.log("Fields: ",fields);
      console.log("Files: ", files);
      uploadInfos.fields = fields;
      uploadInfos.files = files;
    });

    // form.onPart = function(part) {
    //   form.handlePart(part);
    // }
    form.on('field', function(name, value) {
      console.log("Field: ",name,value);
      if(name === "id"){
        uploadInfos.id = value;
      }else if(name === "type"){
        uploadInfos.type = value;
      }
    });

    //On upload starting
    form.on('fileBegin', function(name, file) {
      //TODO check name *.mp4, mkv, mp3 ...
      // TODO check if already updating
      // TODO create random folder to avoid colisions
      var uploadPath = form.uploadDir;
      file.path;
    });

    //One ulpoad done
    form.on('file', async function(name, file) {
      console.log('File uploaded ',name,file);

      //var fileType = "video";//TODO parse extension

      //Move file
      if(type === "series"){
        //var serie = await serieMgr.getSerie(uploadInfos.id);
        //Processing folder
      }

      //Move file to offline processing
    });

    //On upload done
    form.on('end', function() {
      if(type === "series"){

      }
      //Move file
      //Update db
      //Notify the client
      res.status(200).send();
    });

    form.on('error', function(err) {
      console.error("Failed to download file ",err);
      res.status(424).send("Upload failed!");
    });
  }else{
    console.warn("Unknown user is trying to upload files");
  }
});

// Add serie
app.post('/series', async function (req, res) {
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

var server = app.listen(8080, function () {

	var host = server.address().address
  var port = server.address().port
  
	console.log("Streamy node listening at http://%s:%s", host, port)
})

// TODO properly shutdown
// sessionStore.close();
