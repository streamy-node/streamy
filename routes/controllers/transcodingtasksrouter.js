var express = require('express')
const TranscodeMgr = require('../../core/transcoding/transcodermanager');

var loggedIn = require('../middlewares/auth_mw').loggedIn

/// Worker Router ///
class TranscodingTasksRouter{

    /**
     * 
     * @param {TranscodeMgr} transcodeMgr 
     */
    constructor(transcodeMgr){
        this.transcodeMgr = transcodeMgr;
    }

    buildRouter(){
        var self = this;
        var router = express.Router();

        router.use(loggedIn);

        router.get('/', async function (req, res) {
            if(req.user){ //TODO check rights
                let progressions = self.transcodeMgr.getProgressions();
                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify(progressions));
            }
        });

        router.post('/:filename/stop', async function (req, res) {
            if(req.user.permissions.has("manage_transcoding")){ //TODO check rights
                var filename = req.params.filename;
                self.transcodeMgr.stopTask(filename);
                res.sendStatus(200)
            }else{
                res.status(401).send("You don't have the permission to stop tasks")
            }
        });

        router.post('/:filename/start', async function (req, res) {
            if(req.user.permissions.has("manage_transcoding")){ //TODO check rights
                var filename = req.params.filename;
                self.transcodeMgr.startTask(filename);
                res.sendStatus(200)
            }else{
                res.status(401).send("You don't have the permission to start tasks")
            }
        });

        router.delete('/:filename', async function (req, res) {
            if(req.user.permissions.has("manage_transcoding")){ //TODO check rights
                var filename = req.params.filename;
                if(self.transcodeMgr.removeOfflineTask(filename)){
                    res.sendStatus(200)
                }else{
                    res.sendStatus(500)
                }
            }else{
                res.status(401).send("You don't have the permission to remove tasks")
            }
        });

        return router;
    }
}
module.exports = TranscodingTasksRouter;