yaml = require("js-yaml");
fs = require("fs");

const PARAM_TYPES = Object.freeze({
  OBJECT: "object",
  STRING: "string",
  NUMBER: "number"
});

var checkParameter = function(param, elem, type) {
  if (!param in elem) {
    throw "Missing parameter " + param;
  } else if (!typeof value === type) {
    throw ("Parameter " + param + " has a wrong type: ",
    typeof value,
    " != ",
    type);
  }
  return true;
};

loadDBConfig = function(conf) {
  try {
    checkParameter("db", conf, PARAM_TYPES.OBJECT);
    checkParameter("host", conf.db, PARAM_TYPES.STRING);
    checkParameter("port", conf.db, PARAM_TYPES.NUMBER);
    checkParameter("password", conf.db, PARAM_TYPES.STRING);
    checkParameter("database", conf.db, PARAM_TYPES.STRING);
    if (conf.db.password === "pwd") {
      console.warn(
        "You are using a database with the default password! You should set your own!"
      );
    }
  } catch (e) {
    throw ("Failed to load db configuration : ", e);
  }
};

loadSessionConfig = function(conf) {
  try {
    checkParameter("session", conf, PARAM_TYPES.OBJECT);
    checkParameter("secret", conf.session, PARAM_TYPES.STRING);
    if (conf.session.secret === "pwd") {
      console.warn(
        "You are using cookie sessions with the default password! You should set your own!"
      );
    }
  } catch (e) {
    throw ("Failed to load db configuration : ", e);
  }
};

/**
 * Load configuration file. Throw exception on error
 */
loadConfig = function(config_file) {
  // Load config
  var conf = yaml.safeLoad(fs.readFileSync(config_file, "utf8"));
  loadDBConfig(conf);
  loadSessionConfig(conf);
  return conf;
};

module.exports = loadConfig;
