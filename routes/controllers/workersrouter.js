var express = require("express");
const ProcessesMgr = require("../../core/transcoding/ffmpegprocesses")
  .FfmpegProcessManager;

var loggedIn = require("../middlewares/auth_mw").loggedIn;

/// Worker Router ///
class WorkersRouter {
  /**
   *
   * @param {ProcessesMgr} processesMgr
   */
  constructor(processesMgr) {
    this.processesMgr = processesMgr;
  }

  buildRouter() {
    var self = this;
    var router = express.Router();

    router.get("/", loggedIn, async function(req, res) {
      let workers = self.processesMgr.getLightWorkers();

      res.setHeader("Content-Type", "application/json");
      //console.log(workers)
      res.send(JSON.stringify(workers));
    });

    router.post("/", loggedIn, async function(req, res) {
      if (req.user && req.user.permissions.has("manage_workers")) {
        var ip = req.body.ip;
        var port = req.body.port;
        if (ip && ip.length > 0 && port > 0) {
          self.processesMgr.addWorker(ip, port);
          res.sendStatus(200);
        } else {
          console.warn("Cannot add worker with invalid ip and port");
          res.sendStatus(500);
        }
      } else {
        res.status(401).send("You don't have the permission to add workers");
      }
    });

    router.post("/:id/status", loggedIn, async function(req, res) {
      if (req.user && req.user.permissions.has("manage_workers")) {
        //TODO check rights
        var id = req.params.id;
        var statusValue = req.body.status;
        self.processesMgr.enableWorkerFromId(id, statusValue);
        res.sendStatus(200);
      } else {
        res
          .status(401)
          .send("You don't have the permission to change worker status");
      }
    });

    router.post("/:id/connect", loggedIn, async function(req, res) {
      if (req.user && req.user.permissions.has("manage_workers")) {
        //TODO check rights
        var id = req.params.id;
        self.processesMgr.tryConnectWorker(id);
        res.sendStatus(200);
      } else {
        res
          .status(401)
          .send("You don't have the permission to connect workers");
      }
    });

    router.delete("/:id", loggedIn, async function(req, res) {
      if (req.user && req.user.permissions.has("manage_workers")) {
        //TODO check rights
        var id = req.params.id;
        if (self.processesMgr.removeWorker(id)) {
          res.sendStatus(200);
        } else {
          res.sendStatus(500);
        }
      } else {
        res
          .sendStatus(401)
          .send("You don't have the permission to remove workers");
      }
    });
    return router;
  }
}

module.exports = WorkersRouter;
