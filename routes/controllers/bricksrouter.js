var express = require('express')
var Bricks = require('../../core/bricks');

var loggedIn = require('../middlewares/auth_mw').loggedIn
var safePath = require('../middlewares/utils_mw').safePath

/// Worker Router ///
class BricksRouter{

    /**
     * 
     * @param {Bricks} bricksMgr 
     */
    constructor(bricksMgr){
        this.bricksMgr = bricksMgr;
    }

    buildRouter(){
        var self = this;
        var router = express.Router();

        //User must be logged for all requests
        //router.use(loggedIn)
        
        router.get('/',loggedIn, async function (req, res) {
            if(req.user.permissions.has("manage_bricks")){
                let bricks = await self.bricksMgr.getBricks();

                res.setHeader('Content-Type', 'application/json');
                //console.log(workers)
                res.send(JSON.stringify(bricks));
            }
        });

        //Add brick
        router.post('/',loggedIn, async function (req, res) {
            if(req.user.permissions.has("manage_bricks")){
                let alias = req.body.alias;
                let path = req.body.path;
                let enabled = req.body.enabled;

                try{
                    await self.bricksMgr.addBrick(alias,path,enabled)
                    res.sendStatus(200);
                }catch(err){
                    console.warn("Cannot add user:",err)
                    res.status(400).send(err.message)
                }
            }else{
                res.status(401).send("You don't have the permission to add brick")
            }
        });

        //Update user
        router.post('/:id',loggedIn, async function (req, res) {
            if(req.user.permissions.has("manage_bricks")){
            let id = req.params.id;
            let alias = req.body.alias;
            let paths = req.body.paths;
            let enabled = req.body.enabled;

            if(!id){
                res.status(400).send('No id provided');
                return;
            }
            id = parseInt(id);

            try{
                if(alias.length > 0){
                await self.bricksMgr.updateBrickAlias(id,alias);
                }

                if(paths.length > 0){
                await self.bricksMgr.updateBrickPath(id,paths);
                } 

                await self.bricksMgr.updateBrickStatus(id,enabled);
                res.sendStatus(200)
            }catch(err){
                console.warn("Cannot update brick:",id,err)
                res.status(400).send(err)
            }
            }else{
                res.status(401).send("You don't have the permission to update brick")
            }
        });

        router.delete('/:id',loggedIn, async function (req, res) {
            try{
                if(req.user.permissions.has("manage_bricks")){
                    var id = parseInt(req.params.id);
                    await self.bricksMgr.removeBrick(id)
                    res.sendStatus(200)
                }else{
                    res.sendStatus(401).send("You don't have the permission to remove users")
                }
            }catch(err){
                console.warn("Cannot remove brick:",err)
                res.status(400).send(err.message)
            }
        });

        router.get('/:brickid/*', safePath, async function (req, res) {
            var brickid = req.params.brickid;
            var brick = await self.bricksMgr.getBrick(brickid);
        
            res.setHeader('Access-Control-Allow-Origin', '*');//Compulsory for casting
            res.sendFile(brick.brick_path+"/" + req.params[0]);
        })

        return router;
    }
}

module.exports = BricksRouter;