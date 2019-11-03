const EventEmitter = require("events");

class GLOBAL_SETTINGS {
  constructor() {
    this.new_video_brick = null;
    this.upload_brick = null;
  }
}
class SettingsMgr extends EventEmitter {
  constructor(con) {
    super();
    this.con = con;
    this.global = new GLOBAL_SETTINGS();
    this.upload_path = null;
  }

  async pullSettings() {
    var sql = "SELECT * FROM `global_settings`";
    var result = await this.con.query(sql);

    for (var i = 0; i < result.length; i++) {
      if (result[i].key === "new_video_brick") {
        this.global.new_video_brick = result[i].int;
      } else if (result[i].key === "upload_brick") {
        this.global.upload_brick = result[i].int;
        var uploadBrick = await this.con.getBrick(this.global.upload_brick);
        this.upload_path = uploadBrick.brick_path + "/upload";
      } else if (result[i].key === "segment_duration") {
        this.global.segment_duration = result[i].int;
      } else if (result[i].key === "encoder_h264_profile") {
        this.global.encoder_h264_profile = result[i].string;
      } else if (result[i].key === "encoder_h264_preset") {
        this.global.encoder_h264_preset = result[i].string;
      } else if (result[i].key === "tmdb_api_key") {
        this.global.tmdb_api_key = result[i].string;
      }
    }
    this.emit("setting_change", this.global);
  }

  getUploadPath() {
    return this.upload_path;
  }

  async setGlobalSetting(gsettings) {
    let id = await this.con.getBrick(gsettings.new_video_brick);
    if (!id) {
      throw new Error(
        "new_video_brick id not existing: ",
        gsettings.new_video_brick
      );
    }
    id = await this.con.getBrick(gsettings.upload_brick);
    if (!id) {
      throw new Error("upload_brick id not existing: ");
    }
    if (
      gsettings.segment_duration < 1 ||
      typeof gsettings.segment_duration != "number"
    ) {
      throw new Error("segment_duration should be above 0 ");
    }
    if (gsettings.encoder_h264_profile.length == 0) {
      throw new Error("encoder_h264_profile should not be empty ");
    }
    if (gsettings.encoder_h264_preset.length == 0) {
      throw new Error("encoder_h264_preset should not be empty ");
    }
    if (gsettings.tmdb_api_key.length == 0) {
      throw new Error("tmdb_api_key should not be empty ");
    }
    this.global = gsettings;
    await this.saveGlobalSettings();
    this.emit("setting_change", gsettings);
  }

  async saveGlobalSettings() {
    await this.con.updateGlobalSettingInt(
      "new_video_brick",
      this.global.new_video_brick
    );
    await this.con.updateGlobalSettingInt(
      "upload_brick",
      this.global.upload_brick
    );
    await this.con.updateGlobalSettingInt(
      "segment_duration",
      this.global.segment_duration
    );
    await this.con.updateGlobalSettingString(
      "encoder_h264_profile",
      this.global.encoder_h264_profile
    );
    await this.con.updateGlobalSettingString(
      "encoder_h264_preset",
      this.global.encoder_h264_preset
    );
    await this.con.updateGlobalSettingString(
      "tmdb_api_key",
      this.global.tmdb_api_key
    );
  }
}

module.exports = SettingsMgr;
