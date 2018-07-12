//const ProcessesMgr = require('./server/transcoding/ffmpegprocesses').FfmpegProcessManager;
const shortId = require('shortid');
var path = require('path');
var fsutils = require('../fsutils');
var Process = require('./ffmpegprocesses').Process;
var Hardware = require('./ffmpegprocesses').Hardware;

var MPD = require("./mpdutils").MPDFile;
var mpdUtils = require("./mpdutils").MPDUtils;

const Semaphore = require("await-semaphore").Semaphore;

class TranscoderManager{
    constructor(processManager,dbMgr, settings){
        this.processManager = processManager;
        this.dbMgr = dbMgr;
        this.settings = settings;
        this.mpdSemaphores = new Map();
    }

    async addEpisode(file,episodeId){
        this.addVideoFile(file,episodeId,null);
    }

    async addFilm(file,film_id){
        this.addVideoFile(file,null,film_id);
    }

    async addVideoFile(file,episodeId,filmId){
        var self = this;
        var filename = path.basename(file.path);

        //Check if file not already added
        var task = await this.dbMgr.getAddFileTask(filename);

        var workingFolder;
        if(!task){
            workingFolder = shortId.generate();
            //Add this file to insert tasks table (in case of shutdown to avoid to download again the file)
            var id = await this.dbMgr.insertAddFileTask(filename,workingFolder,episodeId,filmId);
        }else{
            workingFolder = task.working_folder;
        }

        // Create transcoding folder if not already done
        var absoluteWorkingFolder = this.settings.upload_path+"/"+workingFolder;
        if(! await fsutils.exists(absoluteWorkingFolder)){
            await fsutils.mkdirp(absoluteWorkingFolder);
        }
       
        let resolutions;
        if(filmId){
            resolutions = await this.dbMgr.getFilmsTranscodingResolutions();
        }else if(episodeId){
            resolutions = await this.dbMgr.getSeriesTranscodingResolutions();
        }else{
            console.error("TranscodeMgr: cannot transcode video without ids");
            return null;
        }
        
        if(!id){
            console.error("TranscodeMgr: Cannot add file in db ",file);
            return null;
        }

        var infos = await this.processManager.ffprobe(filename);
        if(infos === null){
            console.log("Cannot run ffprobe on file (maybe there are no workers ?)");
            return null;//return later?
        }

        // Get files already added to episode or movie folder (if any). Do not transcode again if already done
        var existingFiles = await this._getProcessedFiles(episodeId,filmId,workingFolder);

        if('streams' in infos){
            //Create tasks for each streams
            for(var i=0; i<infos.streams.length; i++){
                let stream = infos.streams[i];
                if(stream.codec_type === "video"){
                    this._addVideoFile(filename,stream,resolutions,workingFolder,existingFiles,
                        async function(workingdir,cmd,resolution){
                            //This callback is called when the transcoding of one stream succeed
                            var mpdId = await self.importDashStream(episodeId,filmId,workingdir,cmd.dashName,cmd.targetName);
                            
                            if(!mpdId){
                                console.error("Failed to create mdp entry in db ",workingdir);
                                return;
                            }

                            // add video
                            var id = await self.dbMgr.insertSerieVideo(mpdId,resolution.id);
                            if(id === null){
                                console.error("Failed to create video entry in db ",mpdId,resolution.id);
                            }
                                
                            console.log("Dash file updated: "+mpdId);
                    },async function(err){
                        console.log("Failed to add video file: "+err);
                    });

                }else if(stream.codec_type === "audio"){

                }else if(stream.codec_type === "subtitle"){

                }
            }

            //Split task done so remove it
            //await this.dbMgr.removeOfflineSplittingTasks(id);
        }else{
            console.error("Cannot split uploadded file: ",file.path);
        }
    }


    /**
     * Import dash files to streamy and return global mdp file id associated
     * @param {*} workingdir 
     * @param {*} cmd 
     */
    async importDashStream(episodeId,filmId,workingdir,dashName,dataFileName){
        var dataFile = this.settings.upload_path+"/"+workingdir+"/"+dataFileName;
        var dashFile = this.settings.upload_path+"/"+workingdir+"/"+dashName;
        var targetFolder = await this._getTargetFolder(episodeId,filmId);
        var targetDataFile = targetFolder + "/"+workingdir+"/" + dataFileName;
        var targethDashFile = targetFolder + "/"+workingdir + "/" + dashName;
        var mergeDashFile = targetFolder + "/"+workingdir+ "/all.mpd";

        //create dir
        await fsutils.mkdirp(targetFolder+"/"+workingdir);

        //Moving file
        console.log("Moving file "+dataFile+" to "+targetDataFile);
        await fsutils.rename(dataFile,targetDataFile);
        console.log("Moving file "+dashFile+" to "+targethDashFile);
        await fsutils.rename(dashFile,targethDashFile);

        if(await this.updateMPDFile(targethDashFile,mergeDashFile)){
            console.log("Merge "+targethDashFile+" and "+mergeDashFile+" succeed");

            // add infos to db
            var mpdinfos = await this.getMPD(episodeId,filmId,workingdir);
            var mpdId = null

            //If not already in db, add it
            if(!mpdinfos){
                mpdId = await this.addMPD(episodeId,filmId,workingdir);
            }else{
                mpdId = mpdinfos.id;
            }

            return mpdId;
            
        }else{
            console.error("Failed to merge mdp files ",targethDashFile,mergeDashFile);
            return null;
        }
    }

    async updateMPDFile(targethDashFile,mergeDashFile){
        //To prevent multiple concurent update (due to awaits) of the same mpd file, use mutex
        var release = null;
        if(!this.mpdSemaphores.has(mergeDashFile)){
            this.mpdSemaphores.set(mergeDashFile,new Semaphore(1));
        }
        release = await this.mpdSemaphores.get(mergeDashFile).acquire();
        //Moving file
        var mergedMpd = await mpdUtils.mergeMpdFiles(targethDashFile,mergeDashFile);
        var saved = await mergedMpd.save(mergeDashFile+".tmp");
        if(saved){
            await fsutils.rename(mergeDashFile+".tmp",mergeDashFile);
            release();
            return true;
        }else{
            release();
            return false;
        }
        //TODO remove semaphore if not used
    }

    async getMPD(episodeId,filmId,workingdir){
        var mpdinfos = null;
        if(episodeId){
            mpdinfos = await this.dbMgr.getSerieMpdFileFromEpisode(episodeId,workingdir);
        }else if(filmId){
            mpdinfos = await this.dbMgr.getFilmMpdFile(filmId,workingdir);
        }
        return mpdinfos;
    }

    async addMPD(episodeId,filmId,workingdir){
        var mpdId = null;
        if(episodeId){
            mpdId = await this.dbMgr.insertSerieMPDFile(episodeId,workingdir);
        }else if(filmId){
            mpdId = await this.dbMgr.insertFilmMPDFile(filmId,workingdir);
        }
        return mpdId;
    }
    //bricks.path as brick_path, series.original_name as serie_name, series.release_date as serie_release_date, series_seasons.season_number,  series_episodes.episode_number

    async _getTargetFolder(episodeId,filmId){
        var mainFolder;
        if(episodeId){
            var res = await this.dbMgr.getEpisodePath(episodeId);
            mainFolder = res.brick_path + "/series/" + res.serie_name + " ("+res.serie_release_date.getFullYear()+")/season_"+res.season_number.toString()+"/episode_"+res.episode_number.toString();
        }else if(filmId){
            var res = await this.dbMgr.getFilmPath(filmId);
            mainFolder = res.brick_path+"/films/"+res.original_name+" ("+films.serie_release_date.getFullYear()+")";
        }
        return mainFolder;
    }

    async _getProcessedFiles(episodeId,filmId,workingDir){
        var mainFolder = await this._getTargetFolder(episodeId,filmId);
        if(await fsutils.exists(mainFolder+"/"+workingDir)){
            return await fsutils.readir(mainFolder+"/"+workingDir);
        }else{
            return[];
        }
    }

    async _getBestResolution(episodeId,filmId){
        var mainFolder = await this._getTargetFolder(episodeId,filmId);
        return await fsutils.readir(mainFolder);
    }
    //////////
    
    // const PROCESS_STATUS = {
    //   NONE: 'NONE',
    //   QUEUED: 'QUEUED',
    //   RUNNING: 'RUNNING',
    //   WAITING: 'WAITING',
    //   STOPPED: 'STOPPED',
    //   TERMINATED: 'TERMINATED'
    // }
    /////
    async _addVideoFile(file,video_stream, target_resolutions,workingDir,existingFiles,onSuccess,onError){
        var original_resolution = await this._getResolution(video_stream.width);
 

        //Filter achievable resolution
        var validResolutions = [];
        for(var i=0; i<target_resolutions.length; i++){
            let target_resolution = target_resolutions[i];

            if(original_resolution.width >= target_resolution.width){
                validResolutions.push(target_resolution);
            }
        }

        //If the file has a too low resolution add it anyway (TODO add a setting for this)
        if(validResolutions.length == 0){
            validResolutions.push(original_resolution);
        }
        
        //Send transcoding commands
        for(var i=0; i<validResolutions.length; i++){
            let target_resolution = validResolutions[i];
            let cmd = await this._generateX264Command(file,video_stream,target_resolution,workingDir);

            //Check if command will produce already existing file in target folder
            // If it the case, skip this file
            if(cmd.targetName in existingFiles && cmd.dashName in existingFiles){
                continue;
            }

            var hw = new Hardware(1,0,0,0);
            var process = new Process("ffmpeg",cmd.args,10,hw,true)
            .on('start',()=>{console.log("on start "+workingDir+" "+cmd.targetName);})
            .on('stop',(restart)=>{console.log("on stop "+workingDir+" "+cmd.targetName,restart);})
            .on('progression',(msg)=>{console.log("on progression "+workingDir+" "+cmd.targetName,msg);})
            .on('final',(msg)=>{
                console.log("on final",msg);
                if(msg.code == 0){
                    console.log("File transcoded ",workingDir+" "+cmd.targetName);
                    onSuccess(workingDir,cmd,target_resolution);

                }else{
                    onError(msg);
                    console.error("Failed to transcode file ",cmd.targetName,msg)
                }
            });
            this.processManager.launchProcess(process);
        }
    }

    async _generateX264Command(inputfile,stream,target_resolution,workingDir){
        var output = {};
        //Width determine resolution category
        //width*height induce bitrate
        let original_resolution = await this._getResolution(stream.width);
        let bitrate = await this.computeBitrate(stream.width,stream.height,target_resolution.id);//await this.dbMgr.getBitrate(target_resolution.resolution_id);

        var segmentduration = this.settings.global.segment_duration;
        var framerate = this._getFramerate(stream);
        var key_int = Math.floor(framerate * segmentduration);

        output.targetName = "video_h264_"+target_resolution.name+".mp4";
        output.dashName = "video_h264_"+target_resolution.name+".mpd";
        output.args = [
            '-i',
            inputfile,
            '-y',
            '-an',
            '-sn',
            '-c:v',
            'libx264',
            '-b:v:0',
            bitrate.toString()+"K",
            '-profile',
            this.settings.global.encoder_h264_profile,
            '-preset',
            this.settings.global.encoder_h264_preset,
            '-keyint_min',
            key_int.toString(),
            '-g',
            key_int.toString(),
            '-b_strategy',
            '0',
            '-use_timeline',
            '1',
            '-use_template',
            '1',
            '-single_file',
            '1',
            '-single_file_name',
            output.targetName,
            '-f',
            'dash',
            workingDir+"/"+output.dashName
        ];
        //-preset slow

        //Scale video if needed
        if(original_resolution.id !== target_resolution.id){
            output.args.splice(2,0,'-vf');
            output.args.splice(3,0,'scale='+target_resolution.width.toString()+":-1");
        }

        return output;
    }

    async computeBitrate(video_width,video_height, target_resolution_id){
        //Return a bitrate according to total resolution (take care of 1920*800 resolutions)
        let resolutionBr = await this.dbMgr.getResolutionBitrate(target_resolution_id);
        var scaled_video_width = resolutionBr.width;
        var scaled_video_height = video_height*resolutionBr.width/video_width;
        var ratio_resolution = scaled_video_width*scaled_video_height/(resolutionBr.width*resolutionBr.height);
        return Math.floor(resolutionBr.bitrate*ratio_resolution);
    }

    async _getResolution(width){
        let resolutions = await this.dbMgr.getResolutions();
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

    _getFramerate(stream){
        let arrayOfStrings = stream.r_frame_rate.split('/');
        if(arrayOfStrings.length != 2){
            console.error("Invalid framerate: ",stream.r_frame_rate)
            return null;
        }
        return parseInt(arrayOfStrings[0])/parseInt(arrayOfStrings[1]);
    }
}

module.exports = TranscoderManager;