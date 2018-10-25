const shortId = require('shortid');
var path = require('path');

var fsutils = require('../fsutils');
var jsutils = require("../jsutils");

var Process = require('./ffmpegprocesses').Process;
var Hardware = require('./ffmpegprocesses').Hardware;

var MPD = require("./mpdutils").MPDFile;
var mpdUtils = require("./mpdutils").MPDUtils;

const Semaphore = require("await-semaphore").Semaphore;//TODO remove


class TranscoderManager{
    constructor(processManager,dbMgr, settings){
        this.processManager = processManager;
        this.dbMgr = dbMgr;
        this.settings = settings;
        this.mpdSemaphores = new Map();
        this.lastProgressions = {};
        this.lastProgressions.offline={};
        this.lastProgressions.live={};
    }

    getProgressions(){
        return this.lastProgressions;
    }

    async addMedia(file,original_name,mediaId,userId = null){
        this.convertFileToOfflineMpd(file,original_name,mediaId,userId);
    }

    async loadAddFileTasks(){
        let tasks = await this.dbMgr.getAddFileTasks();
        for(let i=0; i<tasks.length; i++){
            let task = tasks[i];
            await this.convertFileToOfflineMpd(task.file,task.original_name,task.media_id,task.user_id,task.working_folder);
        }
    }

    async convertFileToOfflineMpd(filename,original_name,mediaId,userId,workingFolderHint = null, isLive = false){

        //Check if a task for this file is not already added
        let task = await this.dbMgr.getAddFileTask(filename);

        //if it's a subtitle, take the last video folder (todo make a popup client side)
        let ext = path.extname(filename);
        if(ext === ".srt" || ext === ".vtt"){
            if(!workingFolderHint){
                let mpds = [];
                mpds = await this.dbMgr.getMdpFiles(mediaId);
                if(mpds.length > 0){
                    workingFolderHint = mpds[0].folder;
                }
            } 
        }

        //If task not existing, create and id
        let task_id = null;
        var workingFolder;
        if(!task){
            if(workingFolderHint && workingFolderHint.length>0){
                workingFolder = workingFolderHint;
            }else{
                workingFolder = shortId.generate();
            }
            //Add this file to insert tasks table (in case of shutdown to avoid to download again the file)
            task_id = await this.dbMgr.insertAddFileTask(filename,original_name,workingFolder,mediaId,userId);
        }else{
            workingFolder = task.working_folder;
            task_id = task.id;
        }

        if(!task_id){
            console.error("TranscodeMgr: Cannot add task in db ",filename);
            return null;
        }

        await this.convertFileToMpd(filename,original_name,mediaId,task_id,workingFolder,userId,false, true);
    }

    async generateLiveMpd(episodeId,original_name,filmId,workingFolder = null){

        //Get uploaded files to use for live transcoding
        let tasks = await this.dbMgr.getAddFileTaskByVideoId(filename);

        if(tasks.length == 0){
            console.error("Cannot generate live mpd without files");
            return false;
        }

         //For the moment take the first video file task
        let filename = null;
        for(let i=0; i<tasks.length; i++){
            let task = tasks[i];

            //check if it's not a video
            let ext = path.extname(task.file);
            if(ext === ".srt" || ext === ".vtt"){
                continue;
            }

            workingFolder = task.working_folder;
            filename = task.file;
        }

        if(filename === null){
            console.error("Cannot generate live mpd without video file");
            return false;
        }

        await this.convertFileToMpd(filename,original_name,episodeId,filmId,null,workingFolder);
    }

    async convertFileToMpd(filename,original_name,mediaId,task_id,workingFolder,user_id,live = false,splitProcessing = false){
        var self = this;

        //Retreive the target media
        let media = await this.dbMgr.getMedia(mediaId);
        if(!media){
            console.error("Cannot get media with id",mediaId)
            return null
        }

        //Check if there are sub tasks
        let subTasks = await this.dbMgr.getAddFileSubTasks(task_id);
        
        //Check if task partially done
        let isPartiallyDone = false;
        for(let i=0; i<subTasks.length; i++){
            let subtask = subTasks[i];
            subtask.command = JSON.parse(subtask.command);

            if(subtask.done === 1){
                isPartiallyDone = true;
            }
        }

        //If none of the tasks have been done, remove subtasks
        if(!isPartiallyDone){
            this.dbMgr.removeAddFileSubTasks(task_id);
        }

        // Create target folder if not already done
        var targetFolder = await this._getTargetFolder(media/*episodeId,filmId*/);
        var absoluteWorkingFolder = targetFolder+"/"+workingFolder;

        let type = "offline";
        if(live){
            type = "live";
        }

        //use a separate folder for live content
        if(live){
            absoluteWorkingFolder+="/live";
        }

        if(! await fsutils.exists(absoluteWorkingFolder)){
            await fsutils.mkdirp(absoluteWorkingFolder);
        }

        //Create subtitles folders
        if(! await fsutils.exists(absoluteWorkingFolder+"/subs")){
            await fsutils.mkdirp(absoluteWorkingFolder+"/subs");
        }
       
        //Get video resolutions
        let resolutions;
        resolutions = await this.dbMgr.getTranscodingResolutions(media.category_id);

        let absoluteSourceFile = this.settings.upload_path+"/"+filename;
        var infos = await this.processManager.ffprobe(absoluteSourceFile);

        if(infos === null){
            self.updateProgressions(media,0,1,type,"no worker available, cannot run ffprobe",type);
            console.log("Cannot run ffprobe on file (maybe there are no workers ?)");
            return null;//return later?
        }
        
        // Get files already added to episode or movie folder (if any). Do not transcode again if already done
        //var existingFiles = await this._getProcessedFiles(episodeId,filmId,workingFolder);

        if('streams' in infos){
            this._normalizeStreams(infos.streams)
            //Retreive global stream infos before creating tasks
            let audios_channels = this._getAudiosChannelsByLangs(infos.streams);

            let ffmpegCmds = [];
            let subTasksIds = [];
            let dashPartFiles = [];

            if(isPartiallyDone){ // Continue processing updating working folder and file src in command
                for(let k=0; k<subTasks.length; k++){
                    let subtask = subTasks[k];
                    if(subtask.done === 0){
                        // TODO think if path update is really necessary
                        ffmpegCmds.push(subtask.command);
                        subTasksIds.push(subtask.id);
                    }
                    dashPartFiles.push(subtask.output);
                }
            }else if(splitProcessing){ // Split command into subtasks
                let audioDone = false;
                let idx = 0;
                let audios_channels_;

                //Keep only reachable resolutions
                let bestVideoStream = this._getBestVideoStream(infos.streams);
                let valid_resolutions = await this._filterValidResolutions(bestVideoStream,resolutions);

                //Put higher resolution first
                valid_resolutions.sort(this.compareResolutions);
                valid_resolutions.reverse();

                for(let i = 0; i<valid_resolutions.length; i++){
                    let dashName;
                    let resolutions_ = [valid_resolutions[i]];
                    if(!audioDone){
                        audios_channels_ = audios_channels;
                        audioDone = true;
                    }else{
                        audios_channels_ = [];
                    }

                    dashName = "p"+idx.toString()+".mpd";
                    dashPartFiles.push(absoluteWorkingFolder+"/"+dashName);

                    let cmd = await this._generateFfmpegCmd(absoluteSourceFile,original_name,absoluteWorkingFolder,dashName,infos,resolutions_,audios_channels_);
                    let subtaskId = await this.dbMgr.insertAddFileSubTask(task_id,JSON.stringify(cmd),false,absoluteWorkingFolder+"/"+dashName);
                    ffmpegCmds.push(cmd);
                    subTasksIds.push(subtaskId);   
                    idx++;
                }
            }else{ // Send as a single command
                //command
                let dashName = "all.mpd";
                //insertAddFileSubTask(task_id,command,done)
                ffmpegCmds.push(await this._generateFfmpegCmd(absoluteSourceFile,original_name,absoluteWorkingFolder,dashName,infos,resolutions,audios_channels));    
            }

            let mdpFileUpdated = false;
            var hasVideoOrAudio = false;
            self.updateProgressions(media,0,3,type);

            let remainingCommands = ffmpegCmds.length;
            let hasError = false;
            let progressions = [];
            for(let i=0; i<ffmpegCmds.length; i++){
                progressions.push(0);
                this.launchOfflineTranscodingCommand(ffmpegCmds[i],absoluteWorkingFolder,
                    async function(){
                        //This callback is called when the transcoding of one stream succeed
                        remainingCommands--;


                        //If it's the last command
                        if(remainingCommands === 0){
                            //Parse main mpd file
                            //Merge subtask if needed
                            if(splitProcessing){

                                await mpdUtils.mergeMpdsToMpd(absoluteWorkingFolder+"/all.mpd",dashPartFiles);
                            }

                            //TODO remove part mpd

                            // add MPD file infos to db if not already done
                            var mpdId = null
                            var mpdinfos = await self.getMPD(mediaId,workingFolder);
                        
                            //If not already in db, add it
                            if(!mpdinfos){
                                mpdId = await self.addMPD(media.id,workingFolder,0);
                            }else{
                                mpdId = mpdinfos.id;
                            }
        
                            if(!mpdId){
                                console.error("Failed to create mdp entry in db ",absoluteWorkingFolder);
                                return;
                            }

                            let streams = [];
                            for(var k=0; k<ffmpegCmds.length; k++){
                                streams = streams.concat(ffmpegCmds[k].streams);
                            }

                            for(var j=0; j<streams.length; j++){
                                let stream = streams[j];
                                
                                // add video
                                var id = null;
                                if(stream.codec_type == "video"){
                                    let resolution = await self._getResolution(stream.width);
                                    id = await self.dbMgr.insertVideo(mpdId,resolution.id,user_id);
                                    hasVideoOrAudio = true;
                                }else if(stream.codec_type == "audio"){
                                    let langInfos = await self.dbMgr.getLangFromIso639_2(stream.tags.language);
        
                                    if(!langInfos){
                                        console.error("Unknown lang code ",stream.tags.language);
                                        langInfos = {};
                                        langInfos.language_id = null;
                                    }

                                    id = await self.dbMgr.insertAudio(mpdId,langInfos.language_id,null,stream.channels,user_id);
                                    hasVideoOrAudio = true;
                                }else if(stream.codec_type === "subtitle"){
                                    //subtitles_streams.push(stream);
                                    let langid = null;
                                    if(stream.tags.language && stream.tags.language.length === 3){
                                        let langInfos = await self.dbMgr.getLangFromIso639_2(stream.tags.language);
                                        if(!langInfos){
                                            console.error("Unknown lang code ",stream.tags.language);
                                        }else{
                                            langid = langInfos.language_id;
                                        }
                                    }else{
                                        langid = await self.dbMgr.getLangsId(stream.tags.language);
                                    }
        
                                    let name = stream.tags.title;
                                    if(!name){
                                        name = "";
                                    }
        
                                    id = await self.dbMgr.insertSubtitle(mpdId,langid,null,name,user_id);
                                }
        
                                if(id === null){
                                    console.error("Failed to create video entry in db "+absoluteWorkingFolder+" "+stream.codec_type);
                                }
                            }
        
                            //Add subtitles to mdp file
                            let subtitle_streams = await self.getAvailableVttStreams(absoluteWorkingFolder);
                            await mpdUtils.addStreamsToMpd(absoluteWorkingFolder+"/all.mpd",subtitle_streams,absoluteWorkingFolder+"/allsub.mpd");
        
                            //Mark mpd as complete if audio or video stream added
                            if(hasVideoOrAudio){
                                await self.dbMgr.setMPDFileComplete(mpdId,1);
                                await self.setMpdStatus(media.id,1);
                            }
        
                            //Remove add file task
                            if(task_id){
                                await self.dbMgr.removeAddFileTask(task_id);
                            }
        
                            //Delete upload file
                            await fsutils.unlink(absoluteSourceFile);
                                
                            progressions[i] = 100;
                            self.updateProgressions(media,jsutils.arrayGetMean(progressions),0,type);
                            console.log("Offline transcoding done for: "+absoluteWorkingFolder);
        
                        }else{
                            //Set subtask done (TODO move this before the if and tak care of the case we)
                            if(subTasksIds.length > 0){
                                await self.dbMgr.setAddFileSubTaskDone(subTasksIds[i]);
                            }
                        }
                },
                function(msg){//OnError
                    remainingCommands--;
                    hasError = true;
                    let error_msg = msg.msg;
                    if(!error_msg){
                        error_msg = null;
                    }
                    progressions[i] = msg.progression;
                    self.updateProgressions(media,jsutils.arrayGetMean(progressions),1,type,error_msg);
                },
                async function(msg){//On Progress
                    progressions[i] = msg.progression;
                    self.updateProgressions(media,jsutils.arrayGetMean(progressions),2,type);
                    if(!mdpFileUpdated){//Try to create the mdpfile with subtitle as soon as possible
                        // if(subtitles_streams.length > 0){
                        //     await mpdUtils.addStreamsToMpd(absoluteWorkingFolder+"/all.mpd",subtitles_streams,absoluteWorkingFolder+"/allsub.mpd");
                        //     mdpFileUpdated = true;
                        // }
                        
                    }
                });
            }
        }else{
            console.error("Cannot split uploadded file: ",file.path);
        }

    }

    extractUploadedSubtitleinfos(filename){
        let infos = null;
        if(path.extname(filename) === ".vtt" || path.extname(filename) === ".srt"){
            return this.extractProcessedSubtitleinfos(filename);
        }else{
            console.error("extractUploadedSubtitleinfos failed: invalid extension ",filename)
        }
        return infos;
    }

    extractProcessedSubtitleinfos(filename){
        let infos = null;
        infos = {};
        //TODO use regexp
        // sometext_fr.vtt
        let baseName = filename.substring(0,filename.length-4);
        if(baseName.length > 4){
            infos.language = baseName.substring(baseName.length-2);
            infos.title = baseName.substring(0,baseName.length-3);
        }else{
            console.warn("Cannot extract subtitles info from it's name ",filename)
        }
        return infos;
    }

    async getAvailableVttStreams(absoluteWorkingFolder){
        let outputs = [];
        
        let files = await fsutils.readir(absoluteWorkingFolder+"/subs");
        for(let i=0; i<files.length; i++){
            let file = files[i];
            if(path.extname(file) === ".vtt"){
                let tags = this.extractProcessedSubtitleinfos(file);
                let stream = {};
                stream.tags = {};
                //TODO use regexp
                stream.codec_type = "subtitle";
                stream.tags.language = tags.language;
                stream.tags.title = tags.title;
                outputs.push(stream);
            }else{
                console.error("extractProcessedSubtitleinfos failed: invalid extension ",filename)
            }
        }
        return outputs;
    }

    updateProgressions(media,progression,state_code,type = "offline",message = null){
        let id = media.id;
        let progressionFilter = progression;
        if(!progressionFilter){
            progressionFilter = 0;
        }

        this.lastProgressions[type][id] = {progression:progressionFilter.toPrecision(3), state_code:state_code, msg:message};

        //Clear from lastProgressions after 30 secs
        var self = this;
        if(state_code == 0){
            setTimeout(function(){
                delete self.lastProgressions[type][id];
            },30000);
        }
    }

    _normalizeStreams(streams){
        for(let i=0; i<streams.length; i++){
            let stream = streams[i];
            //Setup compatibility for different FFMPEG versions tags
            if(stream.tags.LANGUAGE){
                stream.tags["language"] =  stream.tags.LANGUAGE     
            }
        }
    }

    async _generateFfmpegCmd(filename,original_name,targetFolder,dashName,infos,resolutions,audios_channels){
        let output_streams = [];
        let args = [
            '-i',
            filename,
            '-y'
        ];

        let subArgs = [];
        let mappingArgs = [];
        
        let streamArgs = [];

        let adaptation_sets = 'id=0,streams=v ';
        let adaptation_index = 0;

        //Generate output streams
        let bestVideoStream = this._getBestVideoStream(infos.streams);
        for(var i=0; i<infos.streams.length; i++){
            let stream = infos.streams[i];

            if(stream.codec_type === "video" && bestVideoStream == stream){ //Take the best video stream
                let src_width = stream.width;
                let src_height = stream.height;

                let valid_resolutions = await this._filterValidResolutions(stream,resolutions);


                for(var j=0; j<valid_resolutions.length; j++){
                    let output_stream = {};// = jsutils.clone(stream);
                    output_stream.codec_type = stream.codec_type;
                    output_stream.title = stream.title;
                    output_stream.tags = stream.tags;
                    output_stream.r_frame_rate = stream.r_frame_rate;
                    output_stream.width = valid_resolutions[j].width;
                    output_stream.height = src_height*output_stream.width/src_width;
                    output_stream._src_index = stream.index;
                    output_streams.push(output_stream);
                    adaptation_index++;
                }
            }else if(stream.codec_type === "audio"){
                let tags = null;
                //If ffbrobe failed to get lang infos
                if(!stream.tags || !stream.tags.language){
                    tags = {};
                    tags.language = null;
                    tags.title = null;
                }

                //Check if we need to generate a stereo audio (for compatibility)
                if(audios_channels.size > 0){
                    let targetChannels = [stream.channels];
                    let minChannels = this._getLowerChannelByLang(stream,audios_channels);
                    if( stream.channels > 2 && (!minChannels || minChannels > 2 )){
                        targetChannels.push(2);
                    }
    
                    for(var k=0; k<targetChannels.length; k++){
                        let output_stream = {};//jsutils.clone(stream);
                        output_stream.codec_type = stream.codec_type;
                        output_stream.title = stream.title;
                        output_stream.tags = stream.tags;

                        output_stream._src_index = stream.index;
                        output_stream.channels = targetChannels[k];
    
                        if(tags){
                            output_stream.tags = tags;
                        }
    
                        output_streams.push(output_stream);
                        adaptation_sets+='id='+stream.index.toString()+",streams="+(adaptation_index).toString()+" ";
                        adaptation_index++;
                    }
                }
            }else if(stream.codec_type === "subtitle"){
                //Subtitle are not handled directly by ffmpeg in mpd file. So there is no adaptation set
                let output_stream = {};//jsutils.clone(stream);
                output_stream.codec_type = stream.codec_type;
                output_stream.title = stream.title;
                output_stream.tags = stream.tags;

                output_stream._src_index = stream.index;
                output_stream.target_folder = targetFolder;

                //If ffbrobe failed to get lang infos
                if(!output_stream.tags || !output_stream.tags.language){
                    //If the input is only a subtitle file, use filename to get lang
                    output_stream.tags.language = null;
                    output_stream.tags.title = null;
                    if(path.extname(filename) === ".vtt" || path.extname(filename) === ".srt"){
                        let subInfos = this.extractUploadedSubtitleinfos(original_name);
                        if(subInfos){
                            output_stream.tags = {};
                            output_stream.tags.language = subInfos.language;
                            output_stream.tags.title = subInfos.title;
                        }
                    }

                }
                output_streams.push(output_stream);
            }
        }

        let dashBaseName = dashName.slice(0,-4);

        let finalArgs = [
            '-adaptation_sets',
            adaptation_sets,
            '-use_timeline',
            '0',
            '-use_template',
            '1',
            '-min_seg_duration',
            this.settings.global.segment_duration,
            '-init_seg_name',
            "init-"+dashBaseName+"-$RepresentationID$.m4s",
            '-media_seg_name',
            "chunk-"+dashBaseName+"-$RepresentationID$-$Number%05d$.m4s",
            '-f',
            'dash',
            targetFolder+"/"+dashName
        ];

        //Get ffmpeg commands
        streamArgs = await this._generateStreamsArgs(output_streams);

        //Build complete command
        Array.prototype.push.apply(args,streamArgs);

        //If there is a video create mpd otherwise do not
        if(bestVideoStream){
            Array.prototype.push.apply(args,finalArgs);
        }
        
        return { args:args, streams:output_streams, targetName:targetFolder+"/"+dashName};
    }

    async _generateStreamsArgs(streams){
        let video_audio_mapping = [];
        let video_audio_cmds = [];
        let subtitle_cmds = [];
        let global_command = [];

        let video_audio_index = 0;
        let videoOutputIndex = 0;
        let audioOutputIndex = 0;

         //Generate output streams
         for(var i=0; i<streams.length; i++){
            let stream = streams[i];
            stream.index = i;
            if(stream.codec_type === "video"){ //Take only first video stream
                stream._video_index = videoOutputIndex;
                let resolution = await this._getResolution(stream.width);
                let cmd_part = await this._generateX264Part(stream,resolution);
                Array.prototype.push.apply(video_audio_cmds,cmd_part);
                video_audio_mapping.push('-map');
                video_audio_mapping.push("0:"+stream._src_index);
                videoOutputIndex++;
            }else if(stream.codec_type === "audio"){
                stream._audio_index = audioOutputIndex;
                let cmd_part = await this._generateFdkaacPart(stream);
                Array.prototype.push.apply(video_audio_cmds,cmd_part);
                video_audio_mapping.push('-map');
                video_audio_mapping.push("0:"+stream._src_index);
                audioOutputIndex++;
            }else if(stream.codec_type == "subtitle"){
                let cmd_part = await this._generateSubtitlePart(stream);
                Array.prototype.push.apply(subtitle_cmds,cmd_part);
            }
        }

        Array.prototype.push.apply(global_command,subtitle_cmds);
        Array.prototype.push.apply(global_command,video_audio_mapping);
        Array.prototype.push.apply(global_command,video_audio_cmds);
        return global_command;
    }

    async getMPD(mediaId,workingdir){
        var mpdinfos = null;
        mpdinfos = await this.dbMgr.getMpdFileFromMedia(mediaId,workingdir);
        return mpdinfos;
    }

    async addMPD(mediaId,workingdir,complete,type=0){
        var mpdId = null;
        if(!mediaId ){
            console.error("Cannot add MPD with empty mediaId")
            return null
        }

        mpdId = await this.dbMgr.insertMPDFile(mediaId,workingdir,complete)
        return mpdId;
    }

    async setMpdStatus(mediaId,hasMpd){
        let media = await this.dbMgr.getMedia(mediaId);
        await this.dbMgr.setMediaHasMPD(mediaId,hasMpd);

        if(media.parent_id && hasMpd){
            await this.setMpdStatus(media.parent_id,hasMpd)
        }else{
            //TODO remove mpd if no child has it
        }
    }

    async _getTargetFolder(media){
        var mainFolder;
        //let media = await this.dbMgr.getMedia(mediaId);
        let brick = await this.dbMgr.getBrick(media.brick_id);
        return brick.brick_path +"/"+ media.path;
    }

    async _generateSubtitlePart(stream){
        let lang = "00";

        if(stream.tags.language && stream.tags.language.length === 3){
            let langInfos = await this.dbMgr.getLangFromIso639_2(stream.tags.language);
            if(langInfos){
                lang = langInfos.iso_639_1
            }else{
                console.warn("_generateSubtitlePart unknown lang code: ",stream.tags.language," using undefined one");
            }
        }else if(stream.tags.language && stream.tags.language.length === 2){
            lang = stream.tags.language;
        }

        return[
        '-map',
        '0:'+stream._src_index,
        '-c:0',
        'webvtt',
        '-flush_packets',
        1,
        '-f',
        "webvtt",
        stream.target_folder+'/subs/'+stream.tags.title+"_"+lang+".vtt"
        ];
        //'srt_'+stream.tags.language+"_"+stream.tags.title+".vtt"
    }
    async _filterValidResolutions(stream,target_resolutions){
        let ouputs = [];
        var original_resolution = await this._getResolution(stream.width);
        for(var i=0; i<target_resolutions.length; i++){
            let target_resolution = target_resolutions[i];

            if(original_resolution.width >= target_resolution.width){
                ouputs.push(target_resolution);
            }
        }
        return ouputs;
    }

    compareResolutions(a,b) {
        if (a.width < b.width)
          return -1;
        if (a.width > b.width)
          return 1;
        return 0;
    }      

    _getBestVideoStream(streams){
        let bestStream = null;
        for(let i=0; i<streams.length; i++){
            let stream = streams[i];
            if(stream.codec_type === "video" && (!bestStream || bestStream.width < stream.width)){
                bestStream = stream;
            }
        }
        return bestStream;
    }

    async _generateX264Part(stream,target_resolution){
        let bitrate = await this.computeBitrate(stream.width,stream.height,target_resolution.id);//await this.dbMgr.getBitrate(target_resolution.resolution_id);
        var segmentduration = this.settings.global.segment_duration;
        var framerate = this._getFramerate(stream);
        var key_int = Math.floor(framerate * segmentduration);

        return [
            '-c:v:'+stream._video_index,
            'libx264',
            '-b:v:'+stream._video_index,
            bitrate.toString()+"K",
            '-profile:v:'+stream._video_index,
            this.settings.global.encoder_h264_profile,
            '-preset:v:'+stream._video_index,
            this.settings.global.encoder_h264_preset,
            '-keyint_min:v:'+stream._video_index,
            key_int.toString(),
            '-g:v:'+stream._video_index,
            key_int.toString(),
            '-pix_fmt:v:'+stream._video_index,
            'yuv420p',
            '-b_strategy:v:'+stream._video_index,
            '0',
            '-sc_threshold:v:'+stream._video_index,
            0,
            '-filter:v:'+stream._video_index,
            'scale='+target_resolution.width.toString()+":-2"
        ];
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
            '0',
            '-use_template',
            '0',
            '-single_file',
            '1',
            '-single_file_name',
            output.targetName,
            '-min_seg_duration',
            segmentduration,
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

    launchOfflineTranscodingCommand(cmd,workingDir,onSuccess,onError,onProgressions){//TODO 
        var hw = new Hardware(1,0,0,0);
        var process = new Process("ffmpeg",cmd.args,10,hw,true)
        .on('start',()=>{console.log("on start "+workingDir+" "+cmd.targetName);})
        .on('stop',(restart)=>{console.log("on stop "+workingDir+" "+cmd.targetName,restart);})
        .on('progression',(msg)=>{
            console.log("on progression "+workingDir+" "+cmd.targetName,msg);
            if(onProgressions) onProgressions(msg);
        })
        .on('final',(msg)=>{
            console.log("on final",msg);
            if(msg.code == 0){
                console.log("File transcoded ",workingDir+" "+cmd.targetName);
                onSuccess();

            }else{
                onError(msg);
                console.error("Failed to transcode file ",cmd.targetName,msg)
            }
        });
        this.processManager.launchProcess(process);

    }

    _getAudiosChannelsByLangs(streams){
        var outputs = new Map();
        for(var i=0; i<streams.length; i++){
            let stream = streams[i];
            if(stream.codec_type !== "audio"){
                continue;
            }
            if(!stream.tags){
                stream.tags = {};
            }
            let lang = stream.tags.language;
            if(! outputs.has(lang)){
                if(!lang){
                    lang = "unknown";
                }
                outputs.set(lang,new Set());
            }
            outputs.get(lang).add(stream.channels);
        }
        return outputs;
    }

    _getLowerChannelByLang(stream,audios_channels){
        if(!stream.tags.language){
            return null;
        }
        let channels = Array.from(audios_channels.get(stream.tags.language));
        return Math.min.apply(null, channels);
    }

    async _generateFdkaacPart(stream){
        let bitrate = await this.dbMgr.getAudioBitrate(stream.channels);
        return[
        '-c:a:'+stream._audio_index,
        'libfdk_aac',
        '-ac:'+stream.index,
        stream.channels.toString(),
        '-b:a:'+stream._audio_index,
        bitrate.toString()+"K",
        ];
    }
}

module.exports = TranscoderManager;