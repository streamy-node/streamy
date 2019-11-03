var passport = require("passport");
var LocalStrategy = require("passport-local").Strategy;
var UsersMgr = require("../../core/users");

/**
 *
 * @param {UsersMgr} userMgr
 */
exports.setupPassport = function setupPassport(userMgr) {
  var self = this;

  /// Setup auth
  passport.use(
    new LocalStrategy({ passReqToCallback: true }, async function(
      req,
      username,
      password,
      done
    ) {
      try {
        let address = req.headers["x-forwarded-for"];
        let authSuccess = await userMgr.checkUserPasswordSecure(
          username,
          password,
          address
        );
        if (!authSuccess) {
          //TODO remove this warning in case user tap his pwd in username
          console.warn(
            "User failed to authentificate: " + username.substring(0, 20)
          );
          done(null, false);
        } else {
          let user = await userMgr.getUserInfosByName(username);
          return done(null, user);
        }
      } catch (err) {
        console.error("Failed while authentificating: ", err);
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
    })
  );

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
    let user = await userMgr.getUserInfos(id);
    if (user) {
      cb(null, user);
    } else {
      cb(new Error("User " + id + " does not exist"));
    }
    userMgr.updateUserLastConnection(id);
    // users.findById(id, function (err, user) {
    //   if (err) { return cb(err); }
    //   cb(null, user);
    // });
  });

  return passport;
};

exports.loggedIn = function loggedIn(req, res, next) {
  if (req.user) {
    next();
  } else {
    setTimeout(function() {
      res.redirect("/login");
    }, 4000);
  }
};
