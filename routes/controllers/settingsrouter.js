var express = require("express");
var SettingsMgr = require("../../core/settings.js");

var loggedIn = require("../middlewares/auth_mw").loggedIn;

/// Worker Router ///
class SettingsRouter {
  /**
   *
   * @param {SettingsMgr} settings
   */
  constructor(settings) {
    this.settings = settings;
  }

  buildRouter() {
    var self = this;
    var router = express.Router();

    router.use(loggedIn);

    router.get("/", async function(req, res) {
      if (req.user.permissions.has("manage_settings")) {
        //TODO check rights
        await self.settings.pullSettings();

        res.setHeader("Content-Type", "application/json");
        //console.log(workers)
        res.send(JSON.stringify(self.settings.global));
      }
    });

    //Update settings
    router.post("/", async function(req, res) {
      if (req.user.permissions.has("manage_settings")) {
        try {
          let global = req.body;
          await self.settings.setGlobalSetting(global);
          res.sendStatus(200);
        } catch (err) {
          console.warn("Cannot update settings:", err);
          res.status(400).send(err);
        }
      } else {
        res
          .status(401)
          .send("You don't have the permission to update settings");
      }
    });

    return router;
  }
}
module.exports = SettingsRouter;
