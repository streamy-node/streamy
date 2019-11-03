const bcrypt = require("bcryptjs");
const saltRounds = 10;
const minimalPasswordLength = 8;
const failedAttempsPassout = 10;
const delayAttempsReset = 20000;
const passoutDurationMs = 30000;

class Users {
  constructor(dbManager) {
    this.dbMgr = dbManager;
    this.totalFiledAttempts = 0;
    this.failedAttempts = 0;
    this.securePassout = false;
    this.usersLastConnection = new Map();

    this.usersLastIps = new Map();
  }

  async addDefaultUsers() {
    if (!(await this.hasUser("admin"))) {
      try {
        await this.addUser("admin", "astreamy", 1, 255, "", "");

        //The next users will be removed once the web interface allow to add users
        //await this.addUser('user','acooljedi',2,255,"","");
        //await this.addUser('guest','apadawan',3,255,"","");
      } catch (err) {
        console.error("Failed to add default users: " + err);
      }
    }
  }

  async hasUser(username) {
    let id = await this.dbMgr.getUserId(username);
    if (!id) {
      return false;
    } else {
      return true;
    }
  }

  async addUser(username, password, roleId, qosPriority, email, phone = null) {
    try {
      if (password.length < minimalPasswordLength) {
        throw "Password too small: minimum " +
          minimalPasswordLength +
          " characters";
      }
      //hash password
      let hashedPwd = await bcrypt.hash(password, saltRounds);
      let userId = await this.dbMgr.insertUser(
        username,
        hashedPwd,
        roleId,
        qosPriority,
        email,
        (phone = "")
      );
      console.log("New user added " + username);
      return userId;
    } catch (err) {
      let errorMsg = err.sqlMessage;
      if (!errorMsg) {
        errorMsg = err;
      }
      console.error("Failed to add user ", username, err);
      throw new Error(errorMsg);
    }
  }

  async changeUserPwd(userId, newPwd) {
    await this.validateNewPassword(newPwd);
    let hashedPwd = await bcrypt.hash(newPwd, saltRounds);
    let status = await this.dbMgr.updateUserPassword(userId, hashedPwd);
  }

  async changeUserName(userId, name) {
    let status = await this.dbMgr.updateUserName(userId, name);
    if (status) {
      return true;
    } else {
      return false;
    }
  }

  async changeUserRole(userId, roleId) {
    let status = await this.dbMgr.updateUserRole(userId, roleId);
    if (status) {
      return true;
    } else {
      return false;
    }
  }

  async removeUser(userId) {
    return await this.dbMgr.deleteUser(userId);
  }

  async validateNewPassword(password) {
    if (password.length < minimalPasswordLength) {
      throw "Password too small: minimum " +
        minimalPasswordLength +
        " characters";
    }
  }

  checkAccountLeak(userId, ip) {
    if (!this.usersLastIps.has(userId)) {
      this.usersLastIps.set(userId, new Set([ip]));
    } else {
      let ips = this.usersLastIps.get(userId);
      ips.add(ip);
      if (ips.length > 1) {
        console.warn(
          "Account may have leaked, they are " +
            ips.size() +
            " different ips in one day"
        );
        return false;
      }
    }
    return true;
  }

  async checkUserPasswordSecure(username, password, ipAddress) {
    var self = this;
    if (this.securePassout) {
      throw "Too many invalid connections attemps, wait " +
        passoutDurationMs / 1000 +
        " seconds";
    }
    let success = await this.checkUserPassword(username, password);
    if (!success) {
      console.warn(
        "Failed connection attempt! Total: " + this.totalFiledAttempts
      );
      this.failedAttempts++;
      this.totalFiledAttempts++;
      setTimeout(function() {
        self.failedAttempts--;
      }, delayAttempsReset);
      if (this.failedAttempts > failedAttempsPassout) {
        this.securePassout = true;
        console.warn("Authentification passing out");
        setTimeout(function() {
          console.warn("Authentification passing out finished");
          self.securePassout = false;
        }, passoutDurationMs);
      }
    } else {
      // Check if this user has not leaked his address (Work only with reverse proxy)
      let id = await this.dbMgr.getUserId(username);
      success = this.checkAccountLeak(id, ipAddress);
    }

    return success;
  }

  async checkUserPassword(username, password) {
    let dbPasswd = await this.dbMgr.getUserPasswordByName(username);
    if (!dbPasswd) {
      return false;
    }
    return await bcrypt.compare(password, dbPasswd);
  }

  async getUserInfosByName(username) {
    let id = await this.dbMgr.getUserId(username);
    if (!id) {
      return null;
    }
    return await this.getUserInfos(id);
  }

  async getUserInfos(userId) {
    let user = await this.dbMgr.getUser(userId);
    if (!user) {
      return null;
    }
    user.permissions = await this.getUserPermissions(userId);
    return user;
  }

  async updateUserLastConnection(userId) {
    try {
      //Don't update if the last update was less than 1 minute ago
      if (this.usersLastConnection.has(userId)) {
        let lastTime = this.usersLastConnection.get(userId);
        let now = new Date();
        if (now - lastTime < 60000) {
          return;
        }
      }
      this.usersLastConnection.set(userId, new Date());
      await this.dbMgr.updateUserLastConnection(userId);
    } catch (err) {
      console.error("Failed to update last connection time for user " + userId);
    }
  }

  async getUserPermissions(userId) {
    let permissions = await this.dbMgr.getUserPermissions(userId);
    let permissionsSet = new Set();
    for (let i = 0; i < permissions.length; i++) {
      let permission = permissions[i];
      permissionsSet.add(permission.name);
    }
    return permissionsSet;
  }

  async getAllUserInfos(hidePwd = true) {
    let users = await this.dbMgr.getUsersExplicit();
    for (let user of users) {
      user.permissions = await this.getUserPermissions(user.id);
      if (hidePwd) {
        delete user.password;
      }
    }
    return users;
  }
}

module.exports = Users;
