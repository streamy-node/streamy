//var moviedb = require('./moviedb.js');
var path = require('path');
var fsutils = require('./fsutils.js');
var netutils = require('./netutils.js');
var jsutils = require('./jsutils')

var MPDFile = require("./transcoding/mpdutils").MPDFile;
var mpdUtils = require("./transcoding/mpdutils").MPDUtils;

class MediaMgr{
    constructor(dbmanager,processManager){
        this.con = dbmanager;
        this.processManager = processManager;
        this.langs = ["en-US","fr-FR"];

        //Sets to prevent simultaneous identic requests
        this.current_series_creating = new Set();
    }

    async getPlayerMpdFiles(mediaId){
        let outputFiles = [];
        let media = await this.con.getMedia(mediaId)
        let mpdFiles = await this.con.getMdpFiles(mediaId);

        if(!media){
            return outputFiles;
        }
        
        for(var i=0; i<mpdFiles.length; i++){
            let mpdfile = mpdFiles[i];
            outputFiles.push(this.getPlayerMdp(media,mpdfile.folder));
        }
        return outputFiles;
    }

    getPlayerMdp(media, folder){
        let path = this.getMpdUrl(media, folder);
        let title = media.easy_name;
        if(title.length == 0){
            title = media.original_name;
        }
        return {filename:path,title:title};
    }

    getMpdUrl(media, folder){
        return "/brick/"+media.brick_id+"/"+media.path+"/"+folder+"/allsub.mpd";
    }

    async getPlayerMpdFile(mediaId, folder){
        let media = await this.con.getMedia(mediaId)

        if(!media){
            return null;
        }
        return this.getPlayerMdp(media,folder);
    }

    async getMediaFsFolders(media, exceptList, absolute = true){
        //Get brick
        let brick = await this.con.getBrick(media.brick_id);
        if(!brick){
            console.error("cannot refresh media on unknown brick ",media.brick_id);
            return null;
        }

        //Check if path exists
        let media_path = brick.brick_path + "/" + media.path;
        if(!await fsutils.exists(media_path)){
            console.error("Cannot refresh media path not found :",media_path)
            return null;
        }

        //Get subfolders
        let folders = await fsutils.readir(media_path);
        
        let folderAbs = [];
        folders.forEach(element => {
            if(exceptList && exceptList.indexOf(element)>=0){
                return
            }
            if(absolute){
                folderAbs.push(media_path+"/"+element)
            }else{
                folderAbs.push(element)
            }
        });
        return folderAbs;
    }

    async getFsMpdFolders(media,absolute = true){
        let folders = await this.getMediaFsFolders(media,["fanart",".streamy"],absolute);
        return folders;
    }

    async parseMpdFolder(absMpdfolder){
        //get mpd file
        let mpdFile = absMpdfolder+"/allsub.mpd"
        if(!await fsutils.exists(mpdFile)){
            console.warn("Mpd folder without mpd file:",absMpdfolder)
            return null;
        }

        let mpd = new MPDFile();
        if(!await mpd.parse(mpdFile)){
            console.warn("Ignoring folder with invalid mpd file:",mpdFile);
            return null;
        }
        return mpd;
    }

    async getMediaMpdsInfos(media){
        let parsedMpdFolders = [];
        let mpdFolders = await this.getFsMpdFolders(media,false);
        for(let i=0; i<mpdFolders.length; i++){
            let folder = mpdFolders[i];
            parsedMpdFolders.push(await this.getMpdInfos(media, folder));
        }
        return parsedMpdFolders;
    }

    async getMpdInfosByMediaId(mediaId, folder){
        let media = await this.con.getMedia(mediaId)
        if(!media){
            console.error("Unexisting media ",mediaId)
            return null;
        }
        return await this.getMpdInfos(media,folder);
    }

    async getMpdInfos(media, folder){
        let absPath = await this.getAbsolutePath(media)
        let mdpAbsfolder = absPath+"/"+folder;
        let mpd = await this.parseMpdFolder(mdpAbsfolder)
        //let mpdFolder = path.basename(mdpAbsfolder)
        let mpd_id = await this.con.getMpdIdFromMedia(media.id,folder);
        return {folder:folder,mpd:mpd,mpd_id:mpd_id};
    }

    async getMediaMpdsSummary(mediaId){

        let media = await this.con.getMedia(mediaId)
        if(!media){
            console.error("Unexisting media ",mediaId)
            return null;
        }
        let fsMpdsFolders = await this.getMediaMpdsInfos(media)
        let filesSummary = []
        fsMpdsFolders.forEach(function(element) {
            let mpdSumary = null;
            if(element.mpd){
                mpdSumary = element.mpd.getSummary();
            }
            filesSummary.push({folder:element.folder,mpd:mpdSumary,mpd_id:element.mpd_id})
        });
        return filesSummary;
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

    async getMediaListByCategory(categoryId,langId, userId, sortKey, count, offset){
        let mediaFull = await this.con.getMediaFullList(categoryId, langId, userId, sortKey, count, offset)
        return mediaFull;
    }

    async getAbsolutePathById(mediaId){
        //TODO do it with on request with join
        var media = await this.con.getMedia(mediaId);
        if(!media){
            return null;
        }
        var brick = await this.con.getBrick(media.brick_id);
        if(!brick){
            return null;
        }
        return brick.brick_path + "/" +media.path
    }

    async getAbsolutePath(media){
        var brick = await this.con.getBrick(media.brick_id);
        if(!brick){
            return null;
        }
        return brick.brick_path + "/" +media.path
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
            console.error("Failing to create file system for ",mediaId,e);
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
        let path = await this.getAbsolutePathById(mediaId)
        //Check serie folder
        if(!path || !await fsutils.exists(path)){
            return false;
        }
        await fsutils.appendJson(path+"/.streamy/infos.json",infos);
        return true;
    }

    async removeMpd(mediaId, mdpFolder){
        var media = await this.con.getMedia(mediaId);
        if(!media){
            console.error("removeMpd: Cannot find media ",mediaId);
            return null;
        }
        let mediaPath = await this.getAbsolutePath(media)
        if(!mediaPath){
            console.error("removeMpd: Cannot find media path ");
            return false;
        }

        let folders = await this.getFsMpdFolders(media,false);

        await this.con.removeMpdFromMedia(mediaId,mdpFolder);
        
        if(folders.indexOf(mdpFolder) >= 0){ //Safe check to remove only mpd dirs
            await fsutils.rmdirf(mediaPath+"/"+mdpFolder);
        }
        
        return true;
    }

    async addMPD(mediaId,mpdFolder,complete,userId=null){
        var mpdId = null;
        if(!mediaId ){
            console.error("Cannot add MPD with empty mediaId")
            return null
        }

        mpdId = await this.con.insertMPDFile(mediaId,mpdFolder,complete,userId)
        return mpdId;
    }

    async setMpdStatus(mediaId,hasMpd){
        let media = await this.con.getMedia(mediaId);

        if(media.has_mpd == hasMpd){
            return;
        }

        await this.con.setMediaHasMPD(mediaId,hasMpd);

        //Need recursion for parent
        if(media.parent_id){
            if(hasMpd){
                await this.setMpdStatus(media.parent_id,hasMpd)
            }else{
                //TODO remove mpd if no child has it
                this.con.get
            }
        }
    }

    async refreshBrickMedias(brickId){
        //Get brick
        let brick = await this.con.getBrick(brickId);
        if(!brick){
            console.error("cannot refresh unexisting brick ",brickId);
            return false;
        }
        let mediaList = await this.con.getMediaUsingMpdOnBrick(brickId);
        for(let i=0; i<mediaList.length; i++){
            await this.refreshMedia(mediaList[i]);
        }
        console.log("Brick refreshed: "+brickId);
    }

    async refreshMediaById(mediaId){
        let media = await this.con.getMedia(mediaId)
        if(!media){
            console.error("cannot refresh unexisting media ",mediaId)
            return null
        } 
        return await this.refreshMedia(media)
    }

    async refreshMedia(media){
        let mpdsInfos = [];
        let mpdFolders = await this.getFsMpdFolders(media,false);
        for(let i=0; i<mpdFolders.length;i++){
            let mpdFolder = mpdFolders[i];
            let mpdInfo = await this.refreshMediaMpd(media.id,mpdFolder);
            if(mpdInfo){
                mpdsInfos.push(mpdInfo);
            }
        }
        return mpdsInfos;
    }

    async refreshMediaMpd(mediaId, mdpFolder){

        let mpdInfos = await this.getMpdInfosByMediaId(mediaId,mdpFolder);
        if(!mpdInfos){
            console.error("Failed to update mpd metadata",mediaId)
            return null;
        }

        if(!mpdInfos.mpd_id){
            if(!mpdInfos.mpd){
                return null;
            }
            mpdInfos.mpd_id = await this.addMPD(mediaId,mdpFolder,1);
        }

        if(!mpdInfos.mpd_id){
            console.error("Failed to create mpd ",mediaId,mdpFolder)
            return null;
        }
        let mpdId = mpdInfos.mpd_id;

        //Upgrade mpd if necessary
        if(!mpdInfos.mpd.sanity.isSane){
            console.log("Mpd upgraded ",mpdInfos.mpd_id)
            await mpdUtils.upgradeMpd(this.processManager,mpdInfos.mpd)
        }
        
        let summary = mpdInfos.mpd.getSummary();

        //Clear infos from db
        await this.con.removeMpdVideosInfos(mpdInfos.mpd_id)
        await this.con.removeMpdAudioInfos(mpdInfos.mpd_id)
        await this.con.removeMpdSubtitleInfos(mpdInfos.mpd_id)

        //Add infos back
        let hasVideoOrAUdio = false;
        for(let i=0; i<summary.representations.length; i++){
            let repInfos = summary.representations[i];
            try{
                if(repInfos.contentType === "video"){
                    let resolution = await this._getResolution(repInfos.width);
                    await this.con.insertVideo(mpdId,resolution.id,null); 
                    hasVideoOrAUdio = true;  
                }else if(repInfos.contentType === "audio"){
                    let langid = null;
                    let langInfos = await this.con.getLangFromString(repInfos.lang)
                    if(langInfos){
                        langid = langInfos.id;
                    }
                    await this.con.insertAudio(mpdId,langid,null,repInfos.channels,null);
                    hasVideoOrAUdio = true;  
                }else if(repInfos.contentType === "text"){
                    let langid = null;
                    let langInfos = await this.con.getLangFromString(repInfos.lang)
                    if(langInfos){
                        langid = langInfos.id;
                    }
                    await this.con.insertSubtitle(mpdId,langid,null);
                }
            }catch(err){
                console.log("Failed to insert mpd metadata ",err);
            }
        }

        if(hasVideoOrAUdio){
            this.setMpdStatus(mediaId,true);
        }else{
            this.setMpdStatus(mediaId,false);
        }
        
        return mpdInfos;
    }

    async removeRepresentation(mediaId, mdpFolder, repId, safeHash=null){
        try{
            var media = await this.con.getMedia(mediaId);
            if(!media){
                console.error("removeRepresentation: Cannot find media ",mediaId);
                return null;
            }
            let mediaPath = await this.getAbsolutePath(media)
            if(!mediaPath){
                console.error("removeRepresentation: Cannot find media path ");
                return false;
            }

            let mpdInfos = await this.getMpdInfos(media,mdpFolder);

     
            //Check if the safe hash is correct
            let files = await mpdInfos.mpd.getRepresentationFiles(repId,safeHash);
            if(!files){
                return false;
            }
            
            //Remove files from file system
            fsutils.unlinkFiles(files);

            //Remove from the mpd file
            let succeed = mpdInfos.mpd.removeRepresentation(repId,safeHash);
            if(succeed){
                mpdInfos.mpd.save(mpdInfos.mpd.location);
            }
            //Update bdd
            await this.refreshMediaMpd(mediaId, mdpFolder);

            return true;
        }catch(err){
            console.log("Failed to remove representation ",mediaId, mdpFolder, repId,err)
            return false;
        }
    }

    // Findout where to put this function
    async _getResolution(width){
        let resolutions = await this.con.getResolutions();
        for(var i=0; i<resolutions.length; i++){
            if(width<resolutions[i].width){
                if(i==0){
                    return null;
                }
                return resolutions[i-1];
            }
        }
        //If no resolution match send the larger one
        return resolutions[resolutions.length-1];
    }


}

module.exports=MediaMgr