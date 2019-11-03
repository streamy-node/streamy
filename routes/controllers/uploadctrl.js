var express = require("express");
var crypto = require("crypto");
const busboy = require("connect-busboy");
var path = require("path");
var fsUtils = require("../../core/utils/fsutils.js");

const DBStructure = require("../../core/dbstructure");
const SettingsMgr = require("../../core/settings");
const TranscodeMgr = require("../../core/transcoding/transcodermanager");

var loggedIn = require("../middlewares/auth_mw").loggedIn;

const Resumable = require("../../core/resumable-node.js");

var resumable = new Resumable();
var busMiddleware = busboy({ highWaterMark: 2 * 1024 * 1024 });

/// Media Controller ///
class UploadCtrl {
  /**
   *
   * @param {DBStructure} dbMgr
   * @param {SettingsMgr} settings
   * @param {TranscodeMgr} transcodeMgr
   */
  constructor(dbMgr, settings, transcodeMgr) {
    this.dbMgr = dbMgr;
    this.settings = settings;
    this.resumable = resumable;
    this.transcodeMgr = transcodeMgr;

    let tmpUploadPath = settings.getUploadPath() + "/tmp";
    fsUtils.mkdirp(tmpUploadPath);
    resumable.setTargetFolder(settings.getUploadPath());
  }

  buildRouter() {
    var self = this;
    var router = express.Router();
    // retrieve file id. invoke with /fileid?filename=my-file.jpg&size=158624&id=445
    router.get("/fileid", loggedIn, function(req, res) {
      if (!req.query.filename || !req.query.size) {
        return res.status(500).end("query parameter missing");
      }
      let name = req.query.filename + req.query.size;
      if (req.query.id) {
        name += req.query.id;
      }
      // create md5 hash from filename
      res.end(
        crypto
          .createHash("md5")
          .update(name)
          .digest("hex")
      );
    });

    router.post("/media/:media_id", loggedIn, busMiddleware, async function(
      req,
      res
    ) {
      var id = parseInt(req.params.media_id);

      if (req.user.permissions.has("upload_content")) {
        //TODO check rights
        if (!id) {
          res.sendStatus(400);
          return;
        }

        let result = await self.resumable.postSequential(req);
        if (result.status == 201) {
          var filename = path.basename(result.filename);
          self.transcodeMgr.addMedia(
            filename,
            result.original_filename,
            parseInt(id)
          );
        }
        res.sendStatus(result.status);
      } else {
        res.sendStatus(403);
      }
    });

    // get last time an upload packet has been received
    router.get("/last_time", loggedIn, function(req, res) {
      let last_upload_infos = self.resumable.getLastUploadInfos();
      res.send(last_upload_infos);
    });

    // Handle status checks on chunks through Resumable.js
    router.get("/:type", loggedIn, async function(req, res) {
      var type = req.params.type;
      let result = await self.resumable.get(req);
      //console.log('GET', status);
      res.sendStatus(result.status);
    });
    return router;
  }
}

module.exports = UploadCtrl;
