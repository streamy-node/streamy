var DBStructure = require('../../core/dbstructure')
var MultiMediaMgr = require('../../core/multimedia')
var loggedIn = require('../middlewares/auth_mw').loggedIn

var MediaBaseCtrl = require('./multimediabasectrl')

////////////////// Series specific //////////////
class SeriesCtrl extends MediaBaseCtrl{

    /**
     * 
     * @param {DBStructure} dbMgr 
     * @param {MultiMediaMgr} multimediaMgr 
     */
    constructor(dbMgr, multimediaMgr){
        super(MultiMediaMgr.CATEGORIES.SERIE, dbMgr, multimediaMgr)
    }

    buildRouter(){
        var self = this;
        var router = super.buildRouter();

        // Add seasons getter
        router.get('/:mediaId/seasons', async function (req, res) {
            var mediaId = parseInt(req.params.mediaId);
            var lang = req.query.lang;
            var userId = 1;//TODO get userId

            if(isNaN(mediaId)){
                res.status(404).send('Invalid media Id');
                return
            }

            //Set default lang
            if(!lang){
            lang = 'en';
            }
            var langId = await self.dbMgr.getLangsId(lang);
            let sortKeyDepth = ["season_number","episode_number"]
            let infos = await self.multimediaMgr.getChildrenMediaInfos(parseInt(mediaId),langId, 1, userId, sortKeyDepth)
            
            if(infos === null){
            res.status(404).send('No season found');
            }else{
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(infos));
            }

        });

        router.get('episode/id', loggedIn, async function (req, res) {
            if(req.user){
            let serieId = parseInt(req.query.serie_id);
            let seasonNb = parseInt(req.query.season_nb);
            let episodeNb = parseInt(req.query.episode_nb);

            var episodeId = await self.dbMgr.getEpisodeId(serieId,seasonNb,episodeNb);
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({episode_id:episodeId}));
            }
        });

        return router;
    }
}

module.exports = SeriesCtrl; 