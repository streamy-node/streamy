const bcrypt = require('bcrypt');
const saltRounds = 10;
const minimalPasswordLength = 8;
const failedAttempsPassout = 10;
const delayAttempsReset = 20000;
const passoutDurationMs = 30000;

class Users{
  constructor(dbManager){
    this.dbMgr = dbManager;
    this.totalFiledAttempts = 0;
    this.failedAttempts = 0;
    this.securePassout = false;
  }

  async addDefaultUsers(){
    if(!await this.hasUser('admin')){
      try{
        await this.addUser('admin','astreamy',1,255,"","");

        //The next users will be removed once the web interface allow to add users 
        await this.addUser('user','acooljedi',2,255,"","");
        await this.addUser('guest','apadawan',3,255,"","");
      }catch(err){
        console.error("Failed to add default users: "+err);
      }
    }
  }

  async hasUser(username){
    let id = await this.dbMgr.getUserId(username);
    if(!id){
      return false;
    }else{
      return true;
    }
  }

  async addUser(username, password, roleId, qosPriority, email, phone = null){
    try{
      if(password.length < minimalPasswordLength){
        throw ("Password too small: minimum "+minimalPasswordLength+" characters") 
      }
      //hash password
      let hashedPwd = await bcrypt.hash(password, saltRounds)
      let added = await this.dbMgr.insertUser(username, hashedPwd, roleId, qosPriority, email, phone = "");
      if(added){
        console.log("New user added "+username);
      }
    }catch(err){
      console.error("Failed to add user ",username);
      throw (err);
    }
  }

  async checkUserPasswordSecure(username, password){
    var self=this;
    if(this.securePassout){
      throw ("Too many invalid connections attemps, wait "+passoutDurationMs/1000+" seconds") 
    }
    let success = await this.checkUserPassword(username, password);
    if(!success){
      console.warn("Failed connection attempt! Total: "+this.totalFiledAttempts);
      this.failedAttempts++;
      this.totalFiledAttempts++;
      setTimeout(function(){
        self.failedAttempts--;
      },delayAttempsReset)
      if(this.failedAttempts > failedAttempsPassout){
        this.securePassout = true;
        console.warn("Authentification passing out");
        setTimeout(function(){
          console.warn("Authentification passing out finished");
          self.securePassout = false
        },passoutDurationMs);
      }
    }
    return success;
}

  async checkUserPassword(username, password){
      let dbPasswd = await this.dbMgr.getUserPasswordByName(username);
      if(!dbPasswd){
        return false;
      }
     return await bcrypt.compare(password, dbPasswd);
  }

  async getUserInfosByName(username){
    let id = await this.dbMgr.getUserId(username);
    if(!id){
      return null;
    }
    return await this.getUserInfos(id);
  }

  async getUserInfos(userId){
    let user = await this.dbMgr.getUser(userId);
    if(!user){
      return null;
    }
    let permissions = await this.dbMgr.getUserPermissions(userId);
    user.permissions = new Set();
    for(let i=0; i<permissions.length; i++){
      let permission = permissions[i];
      user.permissions.add(permission.name);
    }
    return user;
  }
}

module.exports = Users;