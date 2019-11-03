var express = require("express");
var loggedIn = require("../middlewares/auth_mw").loggedIn;
var setupLocals = require("../middlewares/lang_mw").setupLocals;

class DefaultClient {
  constructor() {}

  buildRouter(i18n) {
    var router = express.Router();
    /// Setup main entry point ///
    router.get("/", function(req, res) {
      res.redirect("/index");
    });

    router.get("/login", i18n.init, setupLocals, function(req, res) {
      res.render("default/login.html");
    });

    router.get("/index", i18n.init, setupLocals, loggedIn, function(req, res) {
      res.render("default/index.html", { UserName: req.user.displayName });
    });

    ////////////////////// templates //////////////////////////////////////////
    router.get("/movies.html", i18n.init, setupLocals, loggedIn, function(
      req,
      res
    ) {
      res.render("default/templates/movies.html");
    });
    router.get("/movie.html", i18n.init, setupLocals, loggedIn, function(
      req,
      res
    ) {
      res.render("default/templates/movie.html");
    });
    router.get("/series.html", i18n.init, setupLocals, loggedIn, function(
      req,
      res
    ) {
      res.render("default/templates/series.html");
    });
    router.get("/serie.html", i18n.init, setupLocals, loggedIn, function(
      req,
      res
    ) {
      res.render("default/templates/serie.html");
    });
    router.get("/addvideo.html", i18n.init, setupLocals, loggedIn, function(
      req,
      res
    ) {
      res.render("default/templates/addvideo.html");
    });
    router.get("/workers.html", i18n.init, setupLocals, loggedIn, function(
      req,
      res
    ) {
      res.render("default/templates/workers.html");
    });
    router.get("/transcoding.html", i18n.init, setupLocals, loggedIn, function(
      req,
      res
    ) {
      res.render("default/templates/transcoding.html");
    });
    router.get("/mediacontent.html", i18n.init, setupLocals, loggedIn, function(
      req,
      res
    ) {
      res.render("default/templates/mediacontent.html");
    });
    router.get("/common.html", i18n.init, setupLocals, loggedIn, function(
      req,
      res
    ) {
      res.render("default/templates/common.html");
    });
    router.get("/users.html", i18n.init, setupLocals, loggedIn, function(
      req,
      res
    ) {
      res.render("default/templates/users.html");
    });
    router.get("/storage.html", i18n.init, setupLocals, loggedIn, function(
      req,
      res
    ) {
      res.render("default/templates/storage.html");
    });
    router.get("/settings.html", i18n.init, setupLocals, loggedIn, function(
      req,
      res
    ) {
      res.render("default/templates/settings.html");
    });
    return router;
  }
}

module.exports = DefaultClient;
