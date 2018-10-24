var moviedb = require('./moviedb.js');
var fsutils = require('./fsutils.js');
var netutils = require('./netutils.js');

class MediaMgr{
    constructor(dbmanager, settings){
        this.con = dbmanager;
        this.langs = ["en-US","fr-FR"];
        this.settings = settings;

        //Sets to prevent simultaneous identic requests
        this.current_series_creating = new Set();
    }

    async getMpdFiles(mediaId){
        let outputFiles = [];
        let media = await this.con.getMedia(mediaId)
        let mpdFiles = await this.con.getMdpFiles(mediaId);
        
        for(var i=0; i<mpdFiles.length; i++){
            let mpdfile = mpdFiles[i];
            //let path = "/brick/"+media.brick_id+"/data/season_"+serie.season_number.toString()+"/episode_"+serie.episode_number+"/"+mpdfile.folder+"/allsub.mpd";
            let path = "/brick/"+media.brick_id+"/"+media.path+"/"+mpdfile.folder+"/allsub.mpd";
            let title = media.original_name;
            outputFiles.push({filename:path,title:title});
        }
        return outputFiles;
    }

    async getChildrenMediaInfos(mediaId,langId, maxDepth, userId, sortKeyDepth){
        try{
            let sortKey = null
            if(sortKeyDepth.length > 0){
                sortKey = sortKeyDepth[0]
            }
            
            let category = await this.con.getChildrenCategoryId(mediaId)
            let childrenMedia = await this.con.getMediaChildrenFull(mediaId,category, langId, userId, sortKey)

            if(maxDepth >= 1){
                
                let childrenPromises = []
                if(sortKeyDepth.length >= 1){
                    sortKeyDepth.shift()
                }

                for(var i=0; i<childrenMedia.length; i++){
                    childrenPromises.push(this.getChildrenMediaInfos(childrenMedia[i].id,langId,maxDepth-1,userId,sortKeyDepth));
                }
                
                //Wait all promises
                var children = await Promise.all(childrenPromises);
                for(var i=0; i<children.length; i++){
                    childrenMedia[i].children = children[i];
                }
            }
            return childrenMedia;
        }catch(err){
            console.error("getChildrenMediaInfos: ",err);
            return null;
        }
    }

    async getMediaInfos(mediaId,langId, maxDepth, userId, sortKeyDepth){
        try{
            let categoryId = await this.con.getMediaCategory(mediaId)
            let mediaFull = await this.con.getMediaFull(mediaId,categoryId,langId,userId)
            
            if(maxDepth >= 1){
                
                    let childCategory = await this.con.getChildrenCategoryId(media.id)

                    let childrenMedia = await this.con.getChildrenMediaInfos(mediaId,childCategory, langId, userId, sortKeyDepth)
                    mediaFull.children = childrenMedia
                        
                    return mediaFull;

            }else{
                return mediaFull;
            }
        }catch(err){
            console.error("getMediaInfos: ",err);
            return null;
        }
    }

    async getMediaListByCategory(categoryId,langId, userId, sortKey){
        let mediaFull = await this.con.getMediaFullList(categoryId, langId, userId, sortKey)
        return mediaFull;
    }

    async getAbsolutePath(mediaId){
        //TODO do it with on request with join
        var media = await this.con.getMedia(mediaId);
        var brick = await this.con.getBrick(media.brick_id);
        return brick.path + "/" +media.path
    }

    async createFS(mediaId){
        try{
            var media = await this.con.getMedia(mediaId);
            var brick = await this.con.getBrick(media.brick_id);
            var paths = await this.con.getMediaRecursivePaths(mediaId)

            //Check if addPath setted
            if(brick === null){
                console.error("Serie has no brick assigned");
                return null;
            }

            //Check if brick path exist
            if(!await fsutils.exists(brick.brick_path)){
                console.error("Series adding path not existing ",brick.brick_path);
                return null;
            }

            if(media.parent_id == null){
                //Create streamy folder on root media
                if(!await fsutils.exists(brick.brick_path+"/"+media.path+"/.streamy")){
                    await fsutils.mkdirp(brick.brick_path+"/"+media.path+"/.streamy");
                }
            }

            for(let i=0; i<paths.length; i++){
                //Create serie folder
                let path = paths[i];
                if(!await fsutils.exists(brick.brick_path+"/"+path)){
                    await fsutils.mkdirp(brick.brick_path+"/"+path);
                }

            }                  
        } catch (e) {
            console.error("Failing to create file system for ",serie.original_name,e);
            return null;
        }
        return true;
    }

    async downloadFanarts(mediaId,images){
        try{
            let media = await this.con.getMedia(mediaId);
            let brick = await this.con.getBrick(media.brick_id);
            
            if(brick === null || media === null){
                console.error("Cannot download fannart, cannot get absolute path");
                return false;
            }
            let path = brick.brick_path + "/" + media.path;

            return await this.downloadFanartsToDir(path,images)

        }catch(err){
            console.error("Failed to download fanart for media ",serieId,err);
            return false;
        }
    }

    async downloadFanartsToDir(absoluteMediaPath,images){
        try{            
            if(absoluteMediaPath.length == 0 ){
                console.error("Cannot download fannart, cannot get absolute path");
                return false;
            }

            //create fanart folder
            if(!await fsutils.exists(absoluteMediaPath+"/fanart")){
                await fsutils.mkdirp(absoluteMediaPath+"/fanart");
            }

            var downloads = [];
            if("fanart500" in images) downloads.push(netutils.download(images.fanart500,absoluteMediaPath+"/fanart/img500.jpg",false));
            if("fanart300" in images) downloads.push(netutils.download(images.fanart300,absoluteMediaPath+"/fanart/img300.jpg",false));
            if("fanart200" in images) downloads.push(netutils.download(images.fanart200,absoluteMediaPath+"/fanart/img200.jpg",false));

            if(downloads.length == 0){
                console.warn("No fanart images provided for ",absoluteMediaPath)
            }
            return downloads

        }catch(err){
            console.error("Failed to download fanart for media ",serieId,err);
            return false;
        }
    }

    //Add info so that a new streamy server can quickly import without db
    async addHintInfos(mediaId,infos){
        let path = await this.getAbsolutePath(mediaId)
        //Check serie folder
        if(!await fsutils.exists(path)){
            return false;
        }
        await fsutils.appendJson(path+"/.streamy/infos.json",infos);
        return true;
    }
}

module.exports=MediaMgr