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
        this.lastProgressions.offline.series = {};
        this.lastProgressions.offline.films = {};
        this.lastProgressions.live.series = {};
        this.lastProgressions.live.films = {};
    }

    getProgressions(){
        return this.lastProgressions;
    }

    async addEpisode(file,episodeId){
        this.convertFileToOfflineMpd(file,episodeId,null);
    }

    async addFilm(file,film_id){
        this.convertFileToOfflineMpd(file,null,film_id);
    }

    async loadAddFileTasks(){
        let tasks = await this.dbMgr.getAddFileTasks();
        for(let i=0; i<tasks.length; i++){
            let task = tasks[i];
            await this.convertFileToOfflineMpd(task.file,task.episode_id,task.film_id);
        }
    }

    async convertFileToOfflineMpd(filename,episodeId,filmId,workingFolderHint = null, isLive = false){

        //Check if a task for this file is not already added
        let task = await this.dbMgr.getAddFileTask(filename);

        //if it's a subtitle, take the last video folder (todo make a popup client side)
        let ext = path.extname(filename);
        if(ext === ".srt" || ext === ".vtt"){
            if(!workingFolderHint){
                let mpds = [];
                if(episodeId){
                    mpds = await this.dbMgr.getSeriesMdpFiles(episodeId);
                }else if(filmId){
                    mpds = await this.dbMgr.getFilmsMdpFiles(filmId);
                }
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
            task_id = await this.dbMgr.insertAddFileTask(filename,workingFolder,episodeId,filmId);
        }else{
            workingFolder = task.working_folder;
            task_id = task.id;
        }

        if(!task_id){
            console.error("TranscodeMgr: Cannot add task in db ",filename);
            return null;
        }

        // let extension = path.extname(path.extnametask.file);
        // if(extension == ".srt"){
        //     this.addSubtitleFile(filename,episodeId,filmId,task_id);
        // }else{
        await this.convertFileToMpd(filename,episodeId,filmId,task_id,workingFolder,false, true);
        // }
    }

    async generateLiveMpd(episodeId,filmId,workingFolder = null){

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

        await this.convertFileToMpd(filename,episodeId,filmId,null,workingFolder);
    }

    async convertFileToMpd(filename,episodeId,filmId,task_id,workingFolder,live = false,splitProcessing = false){
        var self = this;

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

        //insertAddFileSubTask(task_id,command,done)
       
       
        // //Check if a task for this file is not already added
        // let task = await this.dbMgr.getAddFileTask(filename);

        // //If task not existing, create and id
        // let task_id = null;
        // var workingFolder;
        // if(!task){
        //     workingFolder = shortId.generate();
        //     //Add this file to insert tasks table (in case of shutdown to avoid to download again the file)
        //     task_id = await this.dbMgr.insertAddFileTask(filename,workingFolder,episodeId,filmId);
        // }else{
        //     workingFolder = task.working_folder;
        //     task_id = task.id;
        // }

        // if(!task_id){
        //     console.error("TranscodeMgr: Cannot add file in db ",filename);
        //     return null;
        // }

        // // Create target folder if not already done
        // var targetFolder = await this._getTargetFolder(episodeId,filmId);
        // var absoluteWorkingFolder = targetFolder+"/"+workingFolder;
        // if(! await fsutils.exists(absoluteWorkingFolder)){
        //     await fsutils.mkdirp(absoluteWorkingFolder);
        // }
        // Create target folder if not already done
        var targetFolder = await this._getTargetFolder(episodeId,filmId);
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
        if(filmId){
            resolutions = await this.dbMgr.getFilmsTranscodingResolutions();
        }else if(episodeId){
            resolutions = await this.dbMgr.getSeriesTranscodingResolutions();
        }else{
            console.error("TranscodeMgr: cannot transcode video without ids");
            return null;
        }


        let absoluteSourceFile = this.settings.upload_path+"/"+filename;
        var infos = await this.processManager.ffprobe(absoluteSourceFile);

        if(infos === null){
            self.updateProgressions(episodeId,filmId,0,1,type,"no worker available, cannot run ffprobe",type);
            console.log("Cannot run ffprobe on file (maybe there are no workers ?)");
            return null;//return later?
        }
        
        // Get files already added to episode or movie folder (if any). Do not transcode again if already done
        //var existingFiles = await this._getProcessedFiles(episodeId,filmId,workingFolder);

        if('streams' in infos){
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
                        // let command = subtask.command.replace(/_WORKING_FOLDER_/g,absoluteWorkingFolder);
                        // ffmpegCmds.push(command.replace(/_FILE_SRC_/g,absoluteSourceFile));
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

                    let cmd = await this._generateFfmpegCmd(absoluteSourceFile,absoluteWorkingFolder,dashName,infos,resolutions_,audios_channels_);
                    let subtaskId = await this.dbMgr.insertAddFileSubTask(task_id,JSON.stringify(cmd),false,absoluteWorkingFolder+"/"+dashName);
                    ffmpegCmds.push(cmd);
                    subTasksIds.push(subtaskId);   
                    idx++;
                }
            }else{ // Send as a single command
                //command
                let dashName = "all.mpd";
                //insertAddFileSubTask(task_id,command,done)
                ffmpegCmds.push(await this._generateFfmpegCmd(absoluteSourceFile,absoluteWorkingFolder,dashName,infos,resolutions,audios_channels));    
            }
            //command
            ///let dashName = "all.mpd";

            //insertAddFileSubTask(task_id,command,done)
            ///var ffmpegCmd = await this._generateFfmpegCmd(absoluteSourceFile,absoluteWorkingFolder,dashName,infos,resolutions,audios_channels);
            
            let mdpFileUpdated = false;
            var hasVideoOrAudio = false;
            self.updateProgressions(episodeId,filmId,0,3,type);

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
                            var mpdinfos = await self.getMPD(episodeId,filmId,workingFolder);
                        
                            //If not already in db, add it
                            if(!mpdinfos){
                                mpdId = await self.addMPD(episodeId,filmId,workingFolder,0);
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
                                    if(episodeId){
                                        id = await self.dbMgr.insertSerieVideo(mpdId,resolution.id);
                                    }else if(filmId){
                                        id = await self.dbMgr.insertFilmVideo(mpdId,resolution.id);
                                    }
                                    hasVideoOrAudio = true;
                                }else if(stream.codec_type == "audio"){
                                    let langInfos = await self.dbMgr.getLangFromIso639_2(stream.tags.language);
        
                                    if(!langInfos){
                                        console.error("Unknown lang code ",stream.tags.language);
                                        langInfos = {};
                                        langInfos.language_id = null;
                                    }
                                    if(episodeId){
                                        id = await self.dbMgr.insertSerieAudio(mpdId,langInfos.language_id,stream.channels);
                                    }else if(filmId){
                                        id = await self.dbMgr.insertFilmAudio(mpdId,langInfos.language_id,stream.channels);
                                    }
                                    hasVideoOrAudio = true;
                                }else if(stream.codec_type === "subtitle"){
                                    //subtitles_streams.push(stream);
                                    let langid = null;
                                    if(stream.tags.language.length === 3){
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
        
                                    if(episodeId){
                                        id = await self.dbMgr.insertSerieSubtitle(mpdId,langid,name);
                                    }else if(filmId){
                                        id = await self.dbMgr.insertFilmSubtitle(mpdId,lang_id,name);
                                    }
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
                                await self.dbMgr.setSerieMPDFileComplete(mpdId,1);
                                await self.setVideoMpdStatus(episodeId,filmId,1);
                            }
        
                            //Remove add file task
                            if(task_id){
                                await self.dbMgr.removeAddFileTask(task_id);
                            }
        
                            //Delete upload file
                            await fsutils.unlink(absoluteSourceFile);
                                
                            progressions[i] = 100;
                            self.updateProgressions(episodeId,filmId,jsutils.arrayGetMean(progressions),0,type);
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
                    self.updateProgressions(episodeId,filmId,jsutils.arrayGetMean(progressions),1,type,error_msg);
                },
                async function(msg){//On Progress
                    progressions[i] = msg.progression;
                    self.updateProgressions(episodeId,filmId,jsutils.arrayGetMean(progressions),2,type);
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
        let index = filename.indexOf("srt_");
        if(path.extname(filename) === ".vtt" || path.extname(filename) === ".srt" && index >= 0){
            let processableFilename = filename.substring(index);
            return this.extractProcessedSubtitleinfos(processableFilename);
        }else{
            console.error("extractUploadedSubtitleinfos failed: invalid extension ",filename)
        }
        return infos;
    }

    extractProcessedSubtitleinfos(filename){
        let infos = null;
        infos = {};
        //TODO use regexp
        infos.language = filename.substring(4,6);
        infos.title = filename.substring(7,filename.length-4);
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

    updateProgressions(episodeId,filmId,progression,state_code,type = "offline",message = null){
        let id = episodeId == null ? filmId : episodeId;
        let progressionFilter = progression;
        if(!progressionFilter){
            progressionFilter = 0;
        }
        if(episodeId){
            this.lastProgressions[type].series[id] = {progression:progressionFilter.toPrecision(3), state_code:state_code, msg:message};
        }else if(filmId){
            this.lastProgressions[type].films[id] = {progression:progressionFilter.toPrecision(3), state_code:state_code, msg:message};
        }

        //Clear from lastProgressions after 30 secs
        var self = this;
        if(state_code == 0){
            setTimeout(function(){
                if(episodeId){
                    delete self.lastProgressions[type].series[id];
                }else if(filmId){
                    delete this.lastProgressions[type].films[id];
                } 
            },30000);
        }
    }

    async _generateFfmpegCmd(filename,targetFolder,dashName,infos,resolutions,audios_channels){
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
        //let videoOutputIndex = 0;
        //let audioOutputIndex = 0;
        //let audioVideoIndex = 0;
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

                    //output_stream._video_index = videoOutputIndex;
                    output_stream.width = valid_resolutions[j].width;
                    output_stream.height = src_height*output_stream.width/src_width;
                    //output_stream.index = audioVideoIndex;
                    output_stream._src_index = stream.index;
                    output_streams.push(output_stream);
                    adaptation_index++;
                    // mappingArgs.push('-map');
                    // mappingArgs.push("0:"+stream.index);
                    //videoOutputIndex++;
                    //audioVideoIndex++;
                }
            }else if(stream.codec_type === "audio"){
                //stream._audio_index = audio_idx++;
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
                    let subInfos = this.extractUploadedSubtitleinfos(filename);
                    if(subInfos){
                        output_stream.tags = {};
                        output_stream.tags.language = subInfos.language;
                        output_stream.tags.title = subInfos.title;
                    }else{
                        output_stream.tags.language = null;
                        output_stream.tags.title = null;
                    }
                }

                output_streams.push(output_stream);
                    //_generateSubtitlePart
                    //globalIndex++;
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
        //Array.prototype.push.apply(args,mappingArgs);
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
                //stream.index = video_audio_index;
                stream._video_index = videoOutputIndex;
                let resolution = await this._getResolution(stream.width);
                let cmd_part = await this._generateX264Part(stream,resolution);
                Array.prototype.push.apply(video_audio_cmds,cmd_part);
                video_audio_mapping.push('-map');
                video_audio_mapping.push("0:"+stream._src_index);
                //video_audio_index++;
                videoOutputIndex++;
            }else if(stream.codec_type === "audio"){
                //stream.index = video_audio_index;
                stream._audio_index = audioOutputIndex;
                let cmd_part = await this._generateFdkaacPart(stream);
                Array.prototype.push.apply(video_audio_cmds,cmd_part);
                video_audio_mapping.push('-map');
                video_audio_mapping.push("0:"+stream._src_index);
                //video_audio_index++;
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

    // /**
    //  * Import dash files to streamy and return global mdp file id associated
    //  * @param {*} workingdir 
    //  * @param {*} cmd 
    //  */
    // async importDashStream(episodeId,filmId,workingdir,dashName){
    //     var dataFile = this.settings.upload_path+"/"+workingdir+"/"+dataFileName;
    //     var dashFile = this.settings.upload_path+"/"+workingdir+"/"+dashName;
    //     var targetFolder = await this._getTargetFolder(episodeId,filmId);
    //     var targetDataFile = targetFolder + "/"+workingdir+"/" + dataFileName;
    //     var targethDashFile = targetFolder + "/"+workingdir + "/" + dashName;
    //     var mergeDashFile = targetFolder + "/"+workingdir+ "/all.mpd";

    //     //create dir
    //     await fsutils.mkdirp(targetFolder+"/"+workingdir);

    //     //Moving file
    //     console.log("Moving file "+dataFile+" to "+targetDataFile);
    //     await fsutils.rename(dataFile,targetDataFile);
    //     console.log("Moving file "+dashFile+" to "+targethDashFile);
    //     await fsutils.rename(dashFile,targethDashFile);

    //     if(await this.updateMPDFile(targethDashFile,mergeDashFile)){
    //         console.log("Merge "+targethDashFile+" and "+mergeDashFile+" succeed");

    //         // add infos to db
    //         var mpdinfos = await this.getMPD(episodeId,filmId,workingdir);
    //         var mpdId = null

    //         //If not already in db, add it
    //         if(!mpdinfos){
    //             mpdId = await this.addMPD(episodeId,filmId,workingdir,0);
    //         }else{
    //             mpdId = mpdinfos.id;
    //         }

    //         return mpdId;
            
    //     }else{
    //         console.error("Failed to merge mdp files ",targethDashFile,mergeDashFile);
    //         return null;
    //     }
    // }

    //Not used
    // async updateMPDFile(targethDashFile,mergeDashFile){
    //     //To prevent multiple concurent update (due to awaits) of the same mpd file, use mutex
    //     var release = null;
    //     if(!this.mpdSemaphores.has(mergeDashFile)){
    //         this.mpdSemaphores.set(mergeDashFile,new Semaphore(1));
    //     }
    //     release = await this.mpdSemaphores.get(mergeDashFile).acquire();
    //     //Moving file
    //     var mergedMpd = await mpdUtils.mergeMpdFiles(targethDashFile,mergeDashFile);
    //     var saved = await mergedMpd.save(mergeDashFile+".tmp");
    //     if(saved){
    //         await fsutils.rename(mergeDashFile+".tmp",mergeDashFile);
    //         release();
    //         return true;
    //     }else{
    //         release();
    //         return false;
    //     }
    //     //TODO remove semaphore if not used
    // }

    async getMPD(episodeId,filmId,workingdir,type=0){
        var mpdinfos = null;
        if(episodeId){
            mpdinfos = await this.dbMgr.getSerieMpdFileFromEpisode(episodeId,workingdir,type);
        }else if(filmId){
            mpdinfos = await this.dbMgr.getFilmMpdFile(filmId,workingdir,type);
        }
        return mpdinfos;
    }

    async addMPD(episodeId,filmId,workingdir,complete,type=0){
        var mpdId = null;
        if(episodeId){
            mpdId = await this.dbMgr.insertSerieMPDFile(episodeId,workingdir,complete,type);
        }else if(filmId){
            mpdId = await this.dbMgr.insertFilmMPDFile(filmId,workingdir,complete,type);
        }
        return mpdId;
    }

    async setVideoMpdStatus(episodeId,filmId,hasMpd){
        let serieId = await this.dbMgr.getSerieIdFromEpisode(episodeId);
        let videoId = null;
        if(episodeId){
            videoId = await this.dbMgr.setSerieEpisodeHasMPD(episodeId,hasMpd);
            await this.dbMgr.setSerieHasMPD(serieId,hasMpd);
        }else if(filmId){
            videoId = await this.dbMgr.setFilmHasMPD(filmId,hasMpd);
        }
        return videoId;
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
    // async _addVideoStream(file,video_stream, target_resolutions,workingDir,existingFiles,episodeId,filmId){
    //     var original_resolution = await this._getResolution(video_stream.width);

    //     //Filter achievable resolution
    //     var validResolutions = [];
    //     for(var i=0; i<target_resolutions.length; i++){
    //         let target_resolution = target_resolutions[i];

    //         if(original_resolution.width >= target_resolution.width){
    //             validResolutions.push(target_resolution);
    //         }
    //     }

    //     //If the file has a too low resolution add it anyway (TODO add a setting for this)
    //     if(validResolutions.length == 0){
    //         validResolutions.push(original_resolution);
    //     }
        
    //     //Send transcoding commands
    //     for(var i=0; i<validResolutions.length; i++){
    //         let target_resolution = validResolutions[i];
    //         let cmd = await this._generateX264Command(file,video_stream,target_resolution,workingDir);

    //         //Check if command will produce already existing file in target folder
    //         // If it the case, skip this file
    //         if(cmd.targetName in existingFiles && cmd.dashName in existingFiles){
    //             continue;
    //         }
    //         this.launchOfflineTranscodingCommand(cmd,workingDir,
    //             async function(){
    //                 //This callback is called when the transcoding of one stream succeed
    //                 var mpdId = await self.importDashStream(episodeId,filmId,workingDir,cmd.dashName,cmd.targetName);

    //                 if(!mpdId){
    //                     console.error("Failed to create mdp entry in db ",workingDir);
    //                     return;
    //                 }

    //                 // add video
    //                 var id = null;
    //                 if(episodeId){
    //                     id = await self.dbMgr.insertSerieVideo(mpdId,target_resolution.id);
    //                 }else if(filmId){
    //                     id = await self.dbMgr.insertFilmVideo(mpdId,target_resolution.id);
    //                 }
    //                 if(id === null){
    //                     console.error("Failed to create video entry in db ",mpdId,target_resolution.id);
    //                 }
                        
    //                 console.log("Dash file updated: "+mpdId);

    //         },function(msg){});
    //     }
    // }
    async _generateSubtitlePart(stream){
        let lang = "00";

        if(stream.tags.language.length === 3){
            let langInfos = await this.dbMgr.getLangFromIso639_2(stream.tags.language);
            if(langInfos){
                lang = langInfos.iso_639_1
            }else{
                console.warn("_generateSubtitlePart unknown lang code: ",stream.tags.language," using undefined one");
            }
        }else if(stream.tags.language.length === 2){
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
        stream.target_folder+'/subs/srt_'+lang+"_"+stream.tags.title+".vtt"
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
    
    // async _generateX264Parts(stream,target_resolutions){
    //     let results = [];
    //     var original_resolution = await this._getResolution(stream.width);
    //     for(var i=0; i<target_resolutions.length; i++){
    //         let target_resolution = target_resolutions[i];

    //         if(original_resolution.width >= target_resolution.width){
    //             Array.prototype.push.apply(results, this._generateX264Part(target_resolution));
    //         }
    //     }
    //     return results;
    // }

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

    // async _addAudioStream(file,audio_stream,targetChannelsList,workingDir,existingFiles,episodeId,filmId){
    //     var self = this;
    //     //Send transcoding commands
    //     for(var i=0; i<targetChannelsList.length; i++){
    //         let targetChannels = targetChannelsList[i];
    //         let cmd = await this._generateFdkaacCommand(file,audio_stream,targetChannels,workingDir);

    //         //Check if command will produce already existing file in target folder
    //         // If it the case, skip this file
    //         if(cmd.targetName in existingFiles && cmd.dashName in existingFiles){
    //             console.log("Skipping already done transcoding for episode ",episodeId," file: ",cmd.targetName);
    //             continue;
    //         }

    //         this.launchOfflineTranscodingCommand(cmd,workingDir,
    //             async function(){
    //              //This callback is called when the transcoding of one stream succeed
    //              var mpdId = await self.importDashStream(episodeId,filmId,workingDir,cmd.dashName,cmd.targetName);
                            
    //              if(!mpdId){
    //                  console.error("Failed to create mdp entry in db ",workingDir);
    //                  return;
    //              }

    //             let langInfos = await self.dbMgr.getLangFromIso639_2(audio_stream.tags.language);
    //             let lang_id = null;

    //             if(!langInfos){
    //                 console.log("Unknown audio lang ...",);
    //             }else{
    //                 lang_id = langInfos.language_id;
    //             }

    //             var id = null;
    //             if(episodeId){
    //                 id = await self.dbMgr.insertSerieAudio(mpdId,lang_id,targetChannels);
    //             }else if(filmId){
    //                 id = await self.dbMgr.insertFilmAudio(mpdId,lang_id,targetChannels);
    //             }
    //             if(id === null){
    //                 console.error("Failed to create audio entry in db ",mpdId,target_resolution.id);
    //             }else{
    //                 console.log("Dash file updated: "+mpdId);
    //             }       
    //         },function(msg){});
    //     }
    // }

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

//     async _generateFdkaacCommand(inputfile,stream,target_channels,workingDir){
//         var output = {};

//         //Width determine resolution category
//         //width*height induce bitrate
//         let bitrate = await this.dbMgr.getAudioBitrate(target_channels);
        
//         var segmentduration = this.settings.global.segment_duration;
//         let langInfos = await this.dbMgr.getLangFromIso639_2(stream.tags.language);
//         let lang_639_1 = "unknown";

//         if(!langInfos){
//             console.log("Unknown lang ",stream.tags.language);
//         }else{
//             lang_639_1 = langInfos.iso_639_1;
//         }

//         output.targetName = "audio_aac_ch"+target_channels.toString()+"_"+lang_639_1+".mp4";
//         output.dashName = "audio_aac_ch"+target_channels.toString()+"_"+lang_639_1+".mpd";
//         output.args = [
//             '-i',
//             inputfile,
//             '-y',
//             '-vn',
//             '-sn',
//             '-c:a:'+stream.audio_index,
//             'libfdk_aac',
//             '-ac',
//             target_channels.toString(),
//             '-ab',
//             bitrate.toString()+"K",
//             '-use_timeline',
//             '0',
//             '-use_template',
//             '0',
//             '-single_file',
//             '1',
//             '-single_file_name',
//             output.targetName,
//             '-min_seg_duration',
//             segmentduration,
//             '-f',
//             'dash',
//             workingDir+"/"+output.dashName
//         ];
// //         /opt/ffmpeg/bin/ffmpeg -re -i ../output.mp4 -vn -sn -c:a libfdk_aac \
// // -ac 2 -ab 128k -vn \
// // -use_timeline 1 -use_template 1 -single_file 1 -single_file_name audio1.mp4 \
// // -f dash ./audio1.mpd

//         //-preset slow

//         return output;
//     }

    // sync checkHasMpd(){

    //     await self.setVideoMpdStatus(episodeId,filmId,1);
    // }
}

module.exports = TranscoderManager;