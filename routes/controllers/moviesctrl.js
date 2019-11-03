var DBStructure = require("../../core/dbstructure");
var MultiMediaMgr = require("../../core/multimedia");
//var loggedIn = require('../middlewares/auth_mw').loggedIn

var MediaBaseCtrl = require("./multimediabasectrl");

////////////////// Series specific //////////////
class MoviesCtrl extends MediaBaseCtrl {
  /**
   *
   * @param {DBStructure} dbMgr
   * @param {MultiMediaMgr} multimediaMgr
   */
  constructor(dbMgr, multimediaMgr) {
    super(MultiMediaMgr.CATEGORIES.MOVIE, dbMgr, multimediaMgr);
  }
}

module.exports = MoviesCtrl;
