//Handle all resumable tasks
var resumables = new Map();

class VideoBlock{
    constructor(type,id){
        this.droppedFiles = null;
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
        window.open("js/light-player/index.html?mdp="+encodeURIComponent(mdpFile), "streamy player");
    }

    launchVideo(){
        window.open("js/light-player/index.html?type="+this.type+"&id="+this.id.toString(), "Streamy player");
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

    showProgression(progression,stopped = false){
        let $progress = this.element.find('.video_progress');
        $progress.text(progression+"%");
        $progress.removeClass('d-none');

        if(stopped){
            $progress.removeClass('progression_running');
            $progress.addClass('progression_stopped');
        }else{
            $progress.addClass('progression_running');
            $progress.removeClass('progression_stopped');
        }
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
        }else if(state == 4){
            if(!this.hasMpd) this.setBroken(true,waiting_color);
            this.showProgression(progression,true);
            this.setError(false);
        }
    }

    onPlayClick(){
        var self = this;
        self.launchVideo();
    }

    /**
     * @param {*} element element containing a box 
     */
    setup(element){
        var self = this;
        self.element = element;

        let $form = null;
        if(element.hasClass('box')){
            $form = element;
        }else{
            $form = element.find('.box');
        }
        

        let blocs = $form.find('.bloc-image');
        //setup play
        $form.find('.bloc-image').click(function(){
            self.onPlayClick();
        });

        let target = "/"+$form.attr('action')+"/"+this.id.toString()//$form.attr('video_id')
        
        //Reuse resumable if any already on the same target
        let r = null;
        if(resumables.has(target)){
            r = resumables.get(target);
        }else{
            r = new Resumable({
                target: target,
                chunkSize: 10*1024*1024,
                simultaneousUploads:4,
                testChunks:false,
                throttleProgressCallbacks:1,
                generateUniqueIdentifier:function(filename){
                    return self.generateId(filename)
                }
            });

            // Resumable.js isn't supported, fall back on a different method
            if(!r.support) location.href = '/some-default-uploader';

            resumables.set(target,r)
        }

        let browse = element.find('.browse'); // TODO change with name
        r.assignBrowse(browse);
        r.assignDrop(blocs);

        r.on('fileAdded', function(file, event){
            console.log("On file added ",file,event)
            r.upload();
            self.showCancelUpload(true);
        });
        r.on('fileSuccess', function(file, message){
            console.log("On file success ",file, message)
            self.showCancelUpload(false);
            self.hideDownloadProgression();
        });
        r.on('fileError', function(file, message){
            console.error("On file error ",file, message)
            self.showCancelUpload(false);
            self.hideDownloadProgression();
        });
        r.on('fileProgress', function(file){
            //console.log("fileProgress ",file)
            self.showDownloadProgression(Math.floor(file.progress()*1000)/10)
        });

        if(r.isUploading()){
            self.showCancelUpload(true);
        }

        //Link cancel upload button
        element.find(".cancel_upload").click(function(){
            r.cancel();
            self.showCancelUpload(false);
            self.hideDownloadProgression();
        });

        //Link media content button
        element.find(".mediacontent").attr("href","#mediacontent_"+this.id);
    }

    showCancelUpload(enabled){
        let $elem = this.element.find('.cancel_upload');
        if(!enabled){
            $elem.addClass('d-none');
        }else{
            $elem.removeClass('d-none');
        }
    }

    generateId(file){
        // generate id by asynchronously calling express endpoint
        return $.get("/fileid?filename=" + encodeURI(file.name)+"&size="+file.size+"&id="+this.id);
    }
}
