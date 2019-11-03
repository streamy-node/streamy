var express = require("express");

var DBStructure = require("../../core/dbstructure");
var MultiMediaMgr = require("../../core/multimedia");
var loggedIn = require("../middlewares/auth_mw").loggedIn;

/// Media Controller ///
class MediaCtrl {
  /**
   *
   * @param {DBStructure} dbMgr
   * @param {MultiMediaMgr} multimediaMgr
   */
  constructor(dbMgr, multimediaMgr) {
    this.dbMgr = dbMgr;
    this.multiMediaMgr = multimediaMgr;
  }

  buildRouter() {
    var self = this;
    var router = express.Router();

    // Get media info until depth
    router.get("/:mediaId", loggedIn, async function(req, res) {
      var mediaId = req.params.mediaId;
      var lang = req.query.lang;
      var userId = 1; //TODO get userId

      if (isNaN(mediaId)) {
        res.status(400).send("Invalid media id given");
        return;
      }

      //Set default lang
      if (!lang) {
        lang = "en";
      }
      var langId = await self.dbMgr.getLangsId(lang);
      let infos = await self.multiMediaMgr.getMediaInfos(
        parseInt(mediaId),
        langId,
        0,
        userId,
        []
      );

      if (infos === null) {
        res.status(404).send("No season found");
      } else {
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify(infos));
      }
    });

    router.post("/:id/refresh", loggedIn, async function(req, res) {
      //let type = req.params.type;
      let id = parseInt(req.params.id);
      let output = await self.multiMediaMgr.refreshMediaById(id);
      //let output = await mediaMgr.refreshMediaById(id);

      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify({}));
    });

    router.delete("/:mediaId/mpd/:folder", loggedIn, async function(req, res) {
      if (req.user && req.user.permissions.has("manage_content")) {
        //TODO check rights
        //let type = req.params.type;
        let mediaId = parseInt(req.params.mediaId);
        let folder = req.params.folder;

        let result = await self.multiMediaMgr.removeMpd(mediaId, folder);

        if (result) {
          res.sendStatus(200);
        } else {
          res.sendStatus(500);
        }
      } else {
        res.status(401).send("You don't have the permission to delete content");
      }
    });

    router.get("/:id/mpd_files", loggedIn, async function(req, res) {
      //let type = req.params.type;
      let id = parseInt(req.params.id);
      let output = {};
      output = await self.multiMediaMgr.getPlayerMpdFiles(id);

      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify(output));
    });

    router.get("/:id/mpd_files_resume", loggedIn, async function(req, res) {
      //let type = req.params.type;
      let id = parseInt(req.params.id);
      let output = await self.multiMediaMgr.getMediaMpdsSummary(id);

      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify(output));
    });

    router.get("/:id/mpd_file/:folderName", loggedIn, async function(req, res) {
      //let type = req.params.type;
      let id = parseInt(req.params.id);
      let folderName = req.params.folderName;
      let output = await self.multiMediaMgr.getPlayerMpdFile(id, folderName);

      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify(output));
    });

    router.post("/:id/mpd/:folderName/refresh", loggedIn, async function(
      req,
      res
    ) {
      //let type = req.params.type;
      let id = parseInt(req.params.id);
      let folderName = req.params.folderName;
      let output = await self.multiMediaMgr.refreshMediaMpd(id, folderName);

      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify(output));
    });

    router.delete(
      "/:mediaId/mpd/:folder/representation/:rep_id",
      loggedIn,
      async function(req, res) {
        if (req.user && req.user.permissions.has("manage_content")) {
          //let type = req.params.type;
          let mediaId = parseInt(req.params.mediaId);
          let folder = req.params.folder;
          let rep_id = req.params.rep_id; // rep id is not safe, it changes on delete
          var safeHash = req.query.safe_hash; //Safer id to prevent the unwanted deletion of rep

          let result = await self.multiMediaMgr.removeRepresentation(
            mediaId,
            folder,
            rep_id,
            safeHash
          );

          if (result) {
            res.sendStatus(200);
          } else {
            res.sendStatus(500);
          }
        } else {
          res
            .status(401)
            .send("You don't have the permission to delete content");
        }
      }
    );

    return router;
  }
}

module.exports = MediaCtrl;
