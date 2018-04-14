var express = require('express')
var cors = require('cors'); // Chrome cast
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var mysql = require('mysql');

var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var bodyParser = require('body-parser');
var users = require('./server/users');


//Lang
var mustache = require('mustache');
var i18n  = require('i18n');
var path = require('path');
var consolidate = require('consolidate');

//var helmet = require('helmet');

//Setup db
var dbOptions = {
  host: '127.0.0.1',
  port: 3306,
  user: 'streamy',
  password: 'pwd',
  database: 'streamy'
};
var dbConnection = mysql.createConnection(dbOptions);

dbConnection.connect(function(err) {
  if (err) {
    console.error("Cannot connect to db ",dbOptions,err);
    process.exit(1);
  }
  console.log("Connected to db :)");
});

// Setup lang
i18n.configure({
  locales: ['en', 'fr'],
  defaultLocale: 'en',
  queryParameter: 'lang',
  directory: path.join(__dirname, 'locales'),
  api: {
    '__': 'translate',  
    '__n': 'translateN' 
  },
});

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
  passport.authenticate('local', { successRedirect: '/dashboard',
                                   failureRedirect: '/login?status=failed',
                                   failureFlash: false }));

app.get('/logout',
  function(req, res){
    req.logout();
    res.redirect('/login');
  });

app.get('/', function (req, res) {
  res.redirect('/index.html');
})

app.get('/login', function (req, res) {
  res.render('login.html')
})

app.get('/index.html', loggedIn, function (req, res) {
  res.render('index.html',{UserName:req.user.displayName});
})

app.get('/dashboard2', function (req, res) {
  //Build movie list
  //Insert in content
  

  res.render('dashboard.mustache')
})

app.get('/movies', function (req, res) {
  //Build movie list
  //Insert in content
  

  res.render('dashboard.html',{Content:"<div id=plop> Movies {{NAME}} Here </div>"})
})

app.get('/series', function (req, res) {
  res.render('movies.html')
})

var server = app.listen(8080, function () {

	var host = server.address().address
  var port = server.address().port
  
	console.log("Streamy node listening at http://%s:%s", host, port)
})

// TODO properly shutdown
// sessionStore.close();
