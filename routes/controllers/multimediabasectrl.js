var express = require("express");

var DBStructure = require("../../core/dbstructure");
var MultiMediaMgr = require("../../core/multimedia");
var loggedIn = require("../middlewares/auth_mw").loggedIn;

/// Media Controller ///
class MediaBaseCtrl {
  /**
   *
   * @param {MultiMediaMgr.CATEGORIES} category
   * @param {DBStructure} dbMgr
   * @param {MultiMediaMgr} multimediaMgr
   */
  constructor(category, dbMgr, multimediaMgr) {
    this.category = category;
    this.dbMgr = dbMgr;
    this.multimediaMgr = multimediaMgr;
  }

  buildRouter() {
    var self = this;
    var router = express.Router();

    // Get all videos list
    router.get("/", loggedIn, async function(req, res) {
      if (req.user) {
        var lang = req.query.lang;
        var count = parseInt(req.query.count);
        var offset = parseInt(req.query.offset);
        var orderby = req.query.orderby;
        var ascending = req.query.ascending == true;
        var pattern = req.query.pattern;
        var userId = 1; //TODO get userId

        //Set default lang
        if (!lang) {
          lang = "en";
        }
        var langId = await self.dbMgr.getLangsId(lang);
        let mediaList = await self.multimediaMgr.getMediaListByCategory(
          self.category,
          langId,
          userId,
          orderby,
          ascending,
          count,
          offset,
          pattern
        );

        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify(mediaList));
      }
    });

    // Add media
    router.post("/", loggedIn, async function(req, res) {
      if (req.user && req.user.permissions.has("add_media")) {
        //TODO check rights
        //For the moment only moviedb id
        if (req.body.moviedbId != null) {
          try {
            // prepare response
            res.setHeader("Content-Type", "application/json");

            let mediaId = await self.multimediaMgr.addMediaFromTMDb(
              self.category,
              req.body.moviedbId
            );

            if (mediaId) {
              res.status(200).send(JSON.stringify({ id: mediaId }));
            }
          } catch (e) {
            console.error(
              "Failing adding movie from TMDb ",
              req.body.moviedbId,
              e
            );
            res.status(500).send("Cannot create media: " + e.message);
          }
        } else {
          res.status(400).send("Unknown request");
        }
      } else {
        res.status(401).send("You don't have the permission to add a movie");
      }
    });

    return router;
  }
}

module.exports = MediaBaseCtrl;
