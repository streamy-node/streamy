//////////// Nodejs base modules ////////////
var express = require("express");
var bodyParser = require("body-parser");
var app = express();

// Create sessions management
var session = require("express-session");
var MySQLStore = require("express-mysql-session")(session);

// Use consolidate to use mustache for multilang support
var consolidate = require("consolidate");

// Import top level managers
var MultiMediaMgr = require("./core/multimedia.js");
var DBStructure = require("./core/dbstructure.js");
var Settings = require("./core/settings.js");
var Users = require("./core/users");
var Bricks = require("./core/bricks");
var Importer = require("./core/importer.js");

// Import Transcoder/FFMpeg managers
const ProcessesMgr = require("./core/transcoding/ffmpegprocesses")
  .FfmpegProcessManager;
const TranscodeMgr = require("./core/transcoding/transcodermanager");

//Import middlewares
var langMW = require("./routes/middlewares/lang_mw"); // Langs
var authMW = require("./routes/middlewares/auth_mw"); // Authentification
var utilsMW = require("./routes/middlewares/utils_mw"); // Utils
var locales_path = __dirname + "/static/locales";
var i18n = langMW.i18n(locales_path);
// var setupLocals = langMW.setupLocals;
var loggedIn = authMW.loggedIn;
var safePath = utilsMW.safePath;

//include the routes file
const Seriesctrl = require("./routes/controllers/seriesctrl");
const Moviesctrl = require("./routes/controllers/moviesctrl");
const Mediactrl = require("./routes/controllers/mediactrl");
const UploadCtrl = require("./routes/controllers/uploadctrl");
const WorkersRouter = require("./routes/controllers/workersrouter");
const UsersRouter = require("./routes/controllers/usersrouter");
const BricksRouter = require("./routes/controllers/bricksrouter");
const SettingsRouter = require("./routes/controllers/settingsrouter");
const TranscodingTasksRouter = require("./routes/controllers/transcodingtasksrouter");
const AuthRouter = require("./routes/controllers/authrouter");

var loadConfig = require("./core/configuration");

// Entry point function
app.initialize = async function(config_file, io_notifications) {
  //Load configuration
  let config = null;
  try {
    config = loadConfig(config_file);
  } catch (e) {
    console.error("Failed to load config file: ", e);
    process.exit(1);
  }

  // Setup Database and load settings
  var dbMgr = new DBStructure();
  var settings = new Settings(dbMgr);

  // TODO put this conf inside on configuration file YAML
  let conf = {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database
  };

  // Wait for the database to be ready
  if (!(await dbMgr.initialize(conf))) {
    process.exit(1);
  }

  // Get all settings from the database
  await settings.pullSettings();

  /// Setup sessions ///
  var sessionStore = new MySQLStore({}, dbMgr.getConnection());
  var sess = {
    secret: config.session.secret,
    name: "sessionId",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    useConnectionPooling: true
    //cookie: {maxAge: 10000}
  };

  // Handle reconnection
  dbMgr.on("connected", function(connection) {
    sess.store = new MySQLStore({}, connection);
  });

  /// setup managers ///
  var processesMgr = new ProcessesMgr();
  var multiMediaMgr = new MultiMediaMgr(dbMgr, settings, processesMgr);
  var transcodeMgr = new TranscodeMgr(
    processesMgr,
    dbMgr,
    multiMediaMgr.getMediaBase(),
    settings
  );
  var importer = new Importer(dbMgr, multiMediaMgr);
  var userMgr = new Users(dbMgr);
  var bricksMgr = new Bricks(dbMgr);

  /// Setup Middleware ///
  var passport = authMW.setupPassport(userMgr);

  /// Add routers ///
  var mediactrl = new Mediactrl(dbMgr, multiMediaMgr);
  var seriesctrl = new Seriesctrl(dbMgr, multiMediaMgr);
  var moviesctrl = new Moviesctrl(dbMgr, multiMediaMgr);
  var uploadCtrl = new UploadCtrl(dbMgr, settings, transcodeMgr);
  var workersRouter = new WorkersRouter(processesMgr);
  var usersRouter = new UsersRouter(dbMgr, userMgr);
  var bricksRouter = new BricksRouter(bricksMgr);
  var settingsRouter = new SettingsRouter(settings);
  var transcodingTasksRouter = new TranscodingTasksRouter(transcodeMgr);
  var authRouter = new AuthRouter(passport);

  // Min 5 sec between progressions updates
  processesMgr.setMinTimeBetweenProgresses(5000);

  // Try to reach workers from database
  processesMgr.addWorkersFromDB(dbMgr, true);

  // Try to add default users if not already done
  userMgr.addDefaultUsers();

  //Setup lang
  app.engine("html", consolidate.mustache); // Assign html to mustache engine
  app.set("view engine", "html"); // Set default extension
  app.set("views", __dirname + "/views");
  //app.use(i18n.init);

  /// Setup more secure option in production
  if (app.get("env") === "production") {
    //minimale security
    app.disable("x-powered-by");
    app.set("trust proxy", 1); // trust first proxy
    app.use(helmet());
    sess.cookie.secure = true; // serve secure cookies
  }

  /// Setup express server ///
  //app.use(cors());
  app.use(express.static("static"));
  app.use(session(sess));
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(express.json());

  // Setup client
  const ClientRouter = require("./routes/clients/" + config.client_app.client);
  var clientRouter = new ClientRouter();

  //static files from node_modules
  app.get("/js/shaka/*", loggedIn, safePath, function(req, res) {
    res.sendFile(__dirname + "/node_modules/shaka-player/" + req.params[0]);
  });

  app.get("/js/socket.io/*", loggedIn, safePath, function(req, res) {
    res.sendFile(
      __dirname + "/node_modules/socket.io-client/dist/" + req.params[0]
    );
  });

  app.get("/js/mustache.min.js", loggedIn, function(req, res) {
    res.sendFile(__dirname + "/node_modules/mustache/mustache.min.js");
  });

  app.get("/css/material-icons/*", loggedIn, safePath, function(req, res) {
    res.sendFile(
      __dirname + "/node_modules/material-icons/css/" + req.params[0]
    );
  });

  // API key
  app.get("/moviedb/key", loggedIn, function(req, res) {
    res.send(settings.global.tmdb_api_key);
  });

  /// Add routers ///
  app.use("/", authRouter.buildRouter(locales_path));
  app.use("/media", mediactrl.buildRouter());
  app.use("/series", seriesctrl.buildRouter());
  app.use("/movies", moviesctrl.buildRouter());
  app.use("/upload", uploadCtrl.buildRouter());
  app.use("/workers", workersRouter.buildRouter());
  app.use("/users", usersRouter.buildRouter());
  app.use("/bricks", bricksRouter.buildRouter());
  app.use("/settings", settingsRouter.buildRouter());
  app.use("/transcoding_tasks", transcodingTasksRouter.buildRouter());
  app.use("/", clientRouter.buildRouter(i18n));

  app.setupNotifications(io_notifications, processesMgr, transcodeMgr);

  // Restart failed or not finished add file tasks
  // as soon as there is a ffmpeg worker available
  processesMgr.on("workerAvailable", function() {
    transcodeMgr.loadAddFileTasks();
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
};

app.setupNotifications = function(io, processesMgr, transcodeMgr) {
  /////////////////////// Notifications ///////////////////////////
  var wsWorkers = io.of("/notifications/workers");
  processesMgr.on("workerAdded", function(worker) {
    wsWorkers.emit("workerAdded", processesMgr.getLightWorker(worker));
  });
  processesMgr.on("workerEnabled", function(worker) {
    wsWorkers.emit("workerEnabled", worker.ip, worker.port);
  });
  processesMgr.on("workerDisabled", function(worker) {
    wsWorkers.emit("workerDisabled", worker.ip, worker.port);
  });
  processesMgr.on("workerRemoved", function(worker) {
    wsWorkers.emit("workerRemoved", worker.ip, worker.port);
  });
  processesMgr.on("workerStatus", function(ip, port, status) {
    wsWorkers.emit("workerStatus", ip, port, status);
  });

  var wsTranscode = io.of("/notifications/transcoding");
  transcodeMgr.on("taskAdded", function(task) {
    wsTranscode.emit("taskAdded", task);
  });
  transcodeMgr.on("taskUpdated", function(task) {
    wsTranscode.emit("taskUpdated", task);
  });
  transcodeMgr.on("taskRemoved", function(filename) {
    wsTranscode.emit("taskRemoved", filename);
  });
};

module.exports = app;
