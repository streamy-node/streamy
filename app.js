// var netq = require('./server/netutils')
// netq.download("https://image.tmdb.org/t/p/w300/kqjL17yufvn9OVLyXYpvtyrFfak.jpg","./plop/fanart.jpg")

var express = require('express')
var cors = require('cors'); // Chrome cast
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var mysql = require('mysql');

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
var dbConnection = mysql.createConnection(dbOptions);
var dbMgr = new DBStructure(dbConnection);
var settings = new Settings(dbMgr);

dbConnection.connect(function(err) {
  if (err) {
    console.error("Cannot connect to db ",dbOptions,err);
    process.exit(1);
  }
  console.log("Connected to db :)");
  
  // Setup dbase
  dbMgr.initialize(function(error){
    if(error){
      console.error("Cannot setup the db ",dbOptions,err);
      process.exit(1);
    }else{
      settings.pullSettings();
    }
  });

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
var sessionStore = new MySQLStore({},dbConnection);
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

app.get('/serie', function (req, res) {
  //TODO
  //res.send(MovieDB_KEY);
})

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
