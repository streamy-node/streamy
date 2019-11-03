//var moviedb = require('./moviedb.js');
var fsutils = require("./utils/fsutils.js");

class Importer {
  constructor(dbMgr, multimediaMgr) {
    this.dbMgr = dbMgr;
    this.multimediaMgr = multimediaMgr;
    this.mediaMgr = multimediaMgr.getMediaBase();
  }

  async importBrick(brickPath, alias) {
    //Check if brick alias not already existing
    let brick = await this.dbMgr.getBrickByAliasOrPath(brickPath, alias);

    if (brick) {
      console.error(
        "Cannot import brick with the same name or path ",
        brickPath,
        alias
      );
      return false;
    }
    let brickId = await this.dbMgr.insertBrick(alias, brickPath, 1);
    if (!brickId) {
      console.error("Failed to insert brick ", alias, brickPath);
      return false;
    }
    if (!(await this.importBrickMedia(brickId))) {
      console.error("Failed to refresh metadata of " + brickId);
      return true; //brick had been created
    }

    await this.mediaMgr.refreshBrickMedias(brickId);
    console.log("Import done");
    return true;
  }

  async importBrickMedia(brickId) {
    let brick = await this.dbMgr.getBrick(brickId);

    if (!brick) {
      console.error("Cannot refresh an unexisting brick ", brickId);
      return false;
    }

    //check if path exists
    let brickPath = brick.brick_path;
    if (!(await fsutils.exists(brickPath))) {
      let error_msg = "Cannot import brick, path not found ";
      console.error(error_msg, brickPath);
      return false;
      //throw new Error(error_msg)
    }

    await this.importSeriesMetadata(brickId);

    return true;
  }

  async importSeriesMetadata(brickId) {
    let brick = await this.dbMgr.getBrick(brickId);
    if (!brick) {
      console.error(
        "Cannot importSeriesMetadata inside unexisting brick ",
        brickId
      );
      return false;
    }

    let path = brick.brick_path + "/series";

    if (!(await fsutils.exists(path))) {
      return false;
    }

    let seriesNames = await fsutils.readir(path);
    for (let i = 0; i < seriesNames.length; i++) {
      let serieFolder = seriesNames[i];
      let infoFile = path + "/" + serieFolder + "/.streamy/infos.json";
      if (await fsutils.exists(infoFile)) {
        let infos = await fsutils.parseJsonFile(infoFile);
        if (infos && infos.tmdb_id) {
          let mediaId = await this.multimediaMgr.addSerieFromTMDb(
            infos.tmdb_id,
            brickId
          );
          if (mediaId) {
            //console.log("Serie metadata imported "+serieFolder);
          } else {
            console.warn("Serie import failed " + serieFolder);
          }
        } else {
          console.warn(
            "Ignoring serie from folder " +
              serieFolder +
              " : invalid file .streamy/infos.json"
          );
        }
      } else {
        console.warn(
          "Ignoring serie from folder " +
            serieFolder +
            " : cannot find .streamy/infos.json file"
        );
      }
    }
  }
}

module.exports = Importer;
