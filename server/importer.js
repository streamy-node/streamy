//var moviedb = require('./moviedb.js');
var fsutils = require('./fsutils.js');

var MPD = require("./transcoding/mpdutils.js").MPDFile;
//var mpdUtils = require("./mpdutils").MPDUtils;


class Importer{
    constructor(dbMgr, transcoderMgr, seriesMgr){
        this.dbMgr = dbMgr;
        this.seriesMgr = seriesMgr;
        this.trMgr = transcoderMgr; // for converting width to resolution
    }

    async importBrick(brickPath,alias){
        //Check if brick alias not already existing
        let brick = await this.dbMgr.getBrickByAliasOrPath(brickPath,alias);

        if(brick){
            console.error("Cannot import brick with the same name or path ",brickPath,alias)
            return false;
        }
        brick = await this.dbMgr.insertBrick(alias,brickPath,1);
        if(!brick){
            console.error("Failed to insert brick ",alias,brickPath );
            return false;
        }
        if(!await this.refreshBrickMetadata(brick.id)){
            console.error("Failed to refresh metadata of "+brick.id);
            return true; //brick had been created
        }

        await this.refreshBrickData(brick.id);
        console.log("Import done");
        return true;
    }

    async refreshBrickMetadata(brickId){
        let brick = await this.dbMgr.getBrick(brickId);

        if(!brick){
            console.error("Cannot refresh an unexisting brick ",brickId)
            return false;
        }

        //check if path exists
        let brickPath = brick.brick_path;
        if(!await fsutils.exists(brickPath)){
            let error_msg = "Cannot import brick, path not found ";
            console.error(error_msg,brickPath);
            return false;
            //throw new Error(error_msg)
        }

        //Check if series folder exist
        
       
        await this.importSeriesMetadata(brickId);

        return true;
    }

    async importSeriesMetadata(brickId){
        let brick = await this.dbMgr.getBrick(brickId);
        if(!brick){
            console.error("Cannot importSeriesMetadata inside unexisting brick ",brickId)
            return false;
        }

        let path = brick.brick_path+"/series";

        if(!await fsutils.exists(path)){
            return false;
        }

        let seriesNames = await fsutils.readir(path);
        for(let i=0; i<seriesNames.length; i++){
            let serieFolder = seriesNames[i];
            let infoFile = path+"/"+serieFolder+"/.streamy/infos.json";
            if(await fsutils.exists(infoFile)){
                let infos = await fsutils.parseJsonFile(infoFile);
                if(infos && infos.tmdb_id){
                    let mediaId = await this.seriesMgr.addSerieFromMovieDB(infos.tmdb_id,brickId);
                    if(mediaId){
                        console.log("Serie metadata imported "+serieFolder);
                    }else{
                        console.warn("Serie import failed "+serieFolder); 
                    }
                }else{
                    console.warn("Ignoring serie from folder "+serieFolder+" : invalid file .streamy/infos.json")                   
                }
            }else{
                console.warn("Ignoring serie from folder "+serieFolder+" : cannot find .streamy/infos.json file")
            }
        }
    }

    async refreshBrickData(brickId){
        //Get brick
        let brick = await this.dbMgr.getBrick(brickId);
        if(!brick){
            console.error("cannot refresh unexisting brick ",brickId);
            return false;
        }
        let media = await this.dbMgr.getMediaUsingMpdOnBrick(brickId);
        for(let i=0; i<media.length; i++){
            await this.refreshMedia(media[i]);
        }
        console.log("Brick refreshed: "+brickId);
    }

    async refreshMedia(media){
        //Get brick
        let brick = await this.dbMgr.getBrick(media.brick_id);
        if(!brick){
            console.error("cannot refresh media on unknown brick ",media.brick_id);
            return false;
        }

        //Check if path exists
        let media_path = brick.brick_path + "/" + media.path;
        if(!await fsutils.exists(media_path)){
            console.error("Cannot refresh media path not found :",media_path)
            return false;
        }

        //Get subfolders
        let mpdFolders = await fsutils.readir(media_path);
        for(let i=0; i<mpdFolders.length; i++){
            let mdpfolder = mpdFolders[i];

            //Check the folder name
            if(mdpfolder === "fanart"){
                continue;
            }

            if(mdpfolder == "EpBGC9DSB"){
                console.log("STOP")
            }

            //get mpd file
            let mpdFile = media_path+"/"+mdpfolder+"/allsub.mpd"
            if(!await fsutils.exists(mpdFile)){
                console.warn("Ignoring folder without mpd file:",mpdFile)
                continue;
            }

            // Parse mpd infos out
            let mpd = new MPD();
            if(!await mpd.parse(mpdFile)){
                console.warn("Ignoring folder with invalid mpd file:",mpdFile)
                continue;
            }

            if(!mpd.sanity.isSane){
                console.log("Upgrading mpd file "+mpdFile);
                await this.trMgr.upgradeMpd(mpd);
            }
            
            //Get all representations
            let repsInfos = mpd.getAllRepresentationsInfos();
            
            //If there is no video or audio representation pass to newt
            let hasVideoOrAudio = false
            for(let i=0; i<repsInfos.length; i++){
                let type = repsInfos[i].contentType;
                if(type === "video" || type === "audio"){
                    hasVideoOrAudio = true;
                    break;
                }
            }
            if(!hasVideoOrAudio){
                console.warn("Ignoring folder with mpd file without audio or video:",media_path+"/"+mpdFile)
                continue;
            }

            //Check if mpd already in db or create it
            let mpdId = null;
            let mpdinfos = await this.dbMgr.getMpdFileFromMedia(media.id,mdpfolder);
            if(!mpdinfos){
                mpdId = await this.trMgr.addMPD(media.id,mdpfolder,1);
            }else{
                mpdId = mpdinfos.id;
            }
            this.trMgr.setMpdStatus(media.id,true);
            
            //Add mpd stream infos to database
            for(let i=0; i<repsInfos.length; i++){
                let repInfos = repsInfos[i];

                try{
                    if(repInfos.contentType === "video"){
                        let resolution = await this.trMgr._getResolution(repInfos.width);
                        await this.dbMgr.insertVideo(mpdId,resolution.id,null);   
                    }else if(repInfos.contentType === "audio"){
                        let langid = null;
                        let langInfos = await this.dbMgr.getLangFromString(repInfos.lang)
                        if(langInfos){
                            langid = langInfos.id;
                        }
                        await this.dbMgr.insertAudio(mpdId,langid,null,repInfos.channels,null);
                    }else if(repInfos.contentType === "text"){
                        let langid = null;
                        let langInfos = await this.dbMgr.getLangFromString(repInfos.lang)
                        if(langInfos){
                            langid = langInfos.id;
                        }
                        let infos = this.trMgr.extractUploadedSubtitleinfos(repInfos.baseURL)
                        if(infos){
                            await this.dbMgr.insertSubtitle(mpdId,langid,null,infos.title,null);
                        }
                    }
                }catch(err){
                    console.log("err",err);
                }
            }
        }
        console.log("Media refreshed ",media.id)
        return true;
    }
}

module.exports = Importer;