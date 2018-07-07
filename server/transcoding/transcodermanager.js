//const ProcessesMgr = require('./server/transcoding/ffmpegprocesses').FfmpegProcessManager;
const Uuid = require('uuid/v4');
var path = require('path');
var fsutils = require('../fsutils');
var Process = require('./ffmpegprocesses').Process;
var Hardware = require('./ffmpegprocesses').Hardware;

class TranscoderManager{
    constructor(processManager,dbMgr, settings){
        this.processManager = processManager;
        this.dbMgr = dbMgr;
        this.settings = settings;
    }

    async addEpisode(file,episodeId){
        let resolutions = await this.dbMgr.getSeriesTranscodingResolutions();
        this.addFile(file,episodeId,null,resolutions);
    }

    async addFilm(file,film_id){
        let resolutions = await this.dbMgr.getFilmsTranscodingResolutions();
        this.addFile(file,null,film_id,resolutions);
    }

    async addFile(file,episodeId,film_id,resolutions){
        //Add this file to insert tasks table (in case of shutdown to avoid to download again the file)
        var workingFolder = Uuid();
        var filename = path.basename(file.path);
        var id = await this.dbMgr.insertAddFileTask(filename,workingFolder,episodeId,film_id);
        
        if(!id){
            console.error("TranscodeMgr: Cannot add file in db ",file);
        }

        var infos = await this.processManager.ffprobe(filename);

        if('streams' in infos){
            //Create tasks for each streams
            for(var i=0; i<infos.streams.length; i++){
                let stream = infos.streams[i];
                if(stream.codec_type === "video"){
                    this._addVideoFile(filename,stream,resolutions);

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
    async _addVideoFile(file,video_stream, target_resolutions){
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
            var cmd = await this._generateX264Command(file,video_stream,target_resolution);
            var hw = new Hardware(1,0,0,0);
            var process = new Process("ffmpeg",cmd.args,10,hw,true)
            .on('start',()=>{console.log("on start");})
            .on('stop',(restart)=>{console.log("on stop",restart);})
            .on('progression',(msg)=>{console.log("on progression ",msg);})
            .on('final',(msg)=>{console.log("on final",msg);});
            this.processManager.launchProcess(process);
        }
    }

    async _generateX264Command(inputfile,stream,target_resolution){
        var output = {};
        let original_resolution = await this._getResolution(stream.width);
        let bitrate = await this.dbMgr.getBitrate(target_resolution.resolution_id);

        var segmentduration = this.settings.global.segment_duration;
        var framerate = this._getFramerate(stream);
        var key_int = Math.floor(framerate * segmentduration);
        
        output.targetName = "video_h264_"+target_resolution.name+".mp4";
        output.dashName = "video_h264_"+target_resolution.name+".mpg";
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
            'main',
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
            output.dashName
        ];

        //Scale video if needed
        if(original_resolution.id !== target_resolution.id){
            output.args.splice(2,0,'-vf');
            output.args.splice(3,0,'scale='+target_resolution.width.toString()+":-1");
        }

        return output;
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