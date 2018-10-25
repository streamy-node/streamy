class VideoBlock{
    constructor(type,id){
        this.droppedFiles = null;
        this.getStreamsInfos = null;
        this.element = null;
        this.isBroken = false;
        this.type = type;
        this.id = id;
        this.hasMpd = false;
    }

    setHasMpd(val){
        this.hasMpd = val;
        this.setBroken(!val);
        this.hideProgression();
        this.setError(false);
    }

    launchVideoFromMpd(mdpFile){
        var windowObjectReference = window.open("js/light-player/index.html?mdp="+encodeURIComponent(mdpFile), "streamy player");
    }

    launchVideo(){
        var windowObjectReference = window.open("js/light-player/index.html?type="+this.type+"&id="+this.id.toString(), "Streamy player");
    }

    setBroken(value,status_color = nofile_color){
        this.isBroken = value;
        let $broken = this.element.find('.video_broken');

        $broken.css("color",status_color);

        if(value){
            $broken.removeClass('d-none');
        }else{
            $broken.addClass('d-none');
        } 
    }

    setError(value,status_color,message = null){
        let $verror = this.element.find('.video_error');

        $verror.css("color",status_color);

        if(value){
            if(message){
                $verror.attr("title","failed to add last file: "+message);
            }else{
                $verror.attr("title","failed to add last file");
            }
            
            $verror.removeClass('d-none');
        }else{
            $verror.addClass('d-none');
        } 
    }
    hideProgression(){
        let $progress = this.element.find('.video_progress');
        $progress.addClass('d-none');
    }

    showProgression(progression){
        let $progress = this.element.find('.video_progress');
        $progress.text(progression+"%");
        $progress.removeClass('d-none');
    }

    hideDownloadProgression(){
        let $progress = this.element.find('.download_progress');
        $progress.addClass('d-none');
    }

    showDownloadProgression(progression){
        let $progress = this.element.find('.download_progress');
        $progress.text(progression+"%");
        $progress.removeClass('d-none');
    }

    updateStatus(state,progression,msg = null){

        if(state == 0){
            this.setBroken(false);
            this.hideProgression();
            this.setError(false);
        }else if(state == 1){
            this.setError(true,transcoding_error_color,msg);
            this.hideProgression();
            if(!this.hasMpd) this.setBroken(true,nofile_color);
        }else if(state == 2){
            if(!this.hasMpd) this.setBroken(true,transcoding_color);
            this.showProgression(progression);
            this.setError(false);
        }else if(state == 3){
            if(!this.hasMpd) this.setBroken(true,waiting_color);
            this.showProgression(progression);
            this.setError(false);
        }
    }

    onPlayClick(){
        var self = this;
        self.launchVideo();
    }

    /**
     * @param {*} element element containing a box 
     * @param {*} type serie or films
     * @param {*} id episode id or film id
     */
    setup(element){
        let self = this;
        self.element = element;
        let $form = element.find('.box');

        let blocs = $form.find('.bloc-image');
        //setup play
        $form.find('.bloc-image').click(function(){
            self.onPlayClick();
        });

        let target = "/"+$form.attr('action')+"/"+$form.attr('video_id')
        var r = new Resumable({
            target: target,
            chunkSize: 10*1024*1024,
            simultaneousUploads:4,
            testChunks:false,
            throttleProgressCallbacks:1,
            generateUniqueIdentifier:this.generateId
        });

        // Resumable.js isn't supported, fall back on a different method
        if(!r.support) location.href = '/some-default-uploader';

        let browse = element.find('.browse'); // TODO change with name
        r.assignBrowse(browse);
        r.assignDrop(blocs);

        r.on('fileAdded', function(file, event){
            console.log("On file added ",file,event)
            r.upload()
        });
        r.on('fileSuccess', function(file, message){
            console.log("On file success ",file, message)
        });
        r.on('fileError', function(file, message){
            console.error("On file error ",file, message)
        });
        r.on('fileProgress', function(file){
            console.log("fileProgress ",file)
            self.showDownloadProgression(Math.floor(file.progress()*1000)/10)
        });
    }

    generateId(file){
        // generate id by asynchronously calling express endpoint
        return $.get("/fileid?filename=" + encodeURI(file.name));
    }
}
