var express = require('express')
var Users = require('../../core/users');
var DBStructure = require('../../core/dbstructure')

var loggedIn = require('../middlewares/auth_mw').loggedIn

/// Worker Router ///
class UsersRouter{

    /**
     * @param {DBStructure} dbMgr
     * @param {Users} userMgr 
     */
    constructor(dbMgr, userMgr){
        this.dbMgr = dbMgr;
        this.userMgr = userMgr;
    }

    buildRouter(){
        var self = this;
        var router = express.Router();

        //Get our own status
        router.get('/permissions', loggedIn, async function (req, res) {
          let permissions = await self.userMgr.getUserPermissions(req.user.id);
          res.setHeader('Content-Type', 'application/json');
          //console.log(workers)
          let output = {};
          for(let item of permissions.keys()){
            output[item] = true;
          }
          res.send(JSON.stringify(output));

        });
  
        router.get('/', loggedIn, async function (req, res) {
          if(req.user.permissions.has("manage_users")){ //TODO check rights
            let users = await self.userMgr.getAllUserInfos();
      
            res.setHeader('Content-Type', 'application/json');
            //console.log(workers)
            res.send(JSON.stringify(users));
          }
        });
    
        //Add user
        router.post('/', loggedIn, async function (req, res) {
          if(req.user && req.user.permissions.has("manage_users")){
            let username = req.body.username;
            let password = req.body.password;
            let role = req.body.role;
            try{
              let roleId = await self.dbMgr.getRoleIdByName(role)
              if(!roleId){
                console.warn("Cannot add user with unexisting role",role)
                res.status(400).send("unexisting role "+role)
                return;
              }
              await self.userMgr.addUser(username,password,roleId,255,"","")
              res.sendStatus(200);
            }catch(err){
              console.warn("Cannot add user:",err)
              res.status(400).send(err.message)
            }
          }else{
            res.status(401).send("You don't have the permission to add users")
          }
        });
    
        //Update user
        router.post('/:id', loggedIn, async function (req, res) {
          if(req.user && req.user.permissions.has("manage_users")){
            let userId = req.params.id;
            let username = req.body.username;
            let password = req.body.password;
            let role = req.body.role;
    
            if(!userId){
              res.status(400).send('No userId provided');
              return;
            }
            userId = parseInt(userId);
    
            try{
              if(password.length > 0){
                await self.userMgr.changeUserPwd(userId,password);
              }
    
              if(username.length > 0){
                await self.userMgr.changeUserName(userId,username);
              } 
    
              if(role.length > 0 && userId !== 1){//Prevent admin to change role
                let roleId = await self.dbMgr.getRoleIdByName(role)
                await self.userMgr.changeUserRole(userId,roleId);
              }
              res.sendStatus(200)
            }catch(err){
              console.warn("Cannot update user:",err)
              res.status(400).send(err)
            }
          }else{
            res.status(401).send("You don't have the permission to add users")
          }
        });
      
        router.delete('/:id', loggedIn, async function (req, res) {
          try{
            if(req.user && req.user.permissions.has("manage_users")){
              var id = parseInt(req.params.id);
              if(await self.userMgr.removeUser(id)){
                res.sendStatus(200)
              }else{
                res.sendStatus(500)
              }
            }else{
              res.sendStatus(401).send("You don't have the permission to remove users")
            }
          }catch(err){
            console.warn("Cannot remove user:",err)
            res.status(400).send(err.message)
          }
        });
        return router;
      }
}

module.exports = UsersRouter; 