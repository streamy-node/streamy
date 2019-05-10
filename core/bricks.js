var fsutils = require("./utils/fsutils")

class Bricks{
  constructor(dbManager){
    this.dbMgr = dbManager;
  }

  async getBricks(){
    let bricks = await this.dbMgr.getBricks();
    return bricks;
  }

  async getBrick(brickid){
    let brick = await this.dbMgr.getBrick(brickid);
    return brick;
  }

  async addBrick(alias,path,enabled = 1){
    if(! await fsutils.exists(path)){
        throw new Error("Folder not existing "+path)
    }
    if(alias.length == 0){
        throw new Error("Alias should not be empty")
    }
    if(enabled != 0 || enabled != 1){
        enabled = 0;
    }
    let bricks = await this.dbMgr.insertBrick(alias,path,enabled);
    return bricks;
  }

  async removeBrick(id){
    return await this.dbMgr.deleteBrick(id);
  }

  async updateBrickAlias(id, alias){
    if(alias.length == 0){
        throw new Error("Alias should not be empty")
    }
    return await this.dbMgr.updateBrickAlias(id, alias);
  }

  async updateBrickStatus(id, alias){
    return await this.dbMgr.updateBrickStatus(id, alias);
  }
  
  async updateBrickPath(id,path){
    if(! await fsutils.exists(path)){
        throw new Error("Folder not existing "+path)
    }
    return await this.dbMgr.updateBrickPath(id, path);
}

}

module.exports = Bricks;