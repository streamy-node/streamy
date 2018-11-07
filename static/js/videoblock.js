//Handle all resumable tasks
var resumables = new Map();

class VideoBlock extends TranscodingStatus{
    constructor(type,id){
        super(id)
        this.droppedFiles = null;
        this.element = null;
        this.type = type;
    }

    launchVideoFromMpd(mdpFile){
        window.open("js/light-player/index.html?mdp="+encodeURIComponent(mdpFile), "streamy player");
    }

    launchVideo(){
        window.open("js/light-player/index.html?type="+this.type+"&id="+this.id.toString(), "Streamy player");
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

    onPlayClick(){
        var self = this;
        self.launchVideo();
    }

    /**
     * @param {*} element element containing a box 
     */
    setup(element){
        var self = this;
        super.setup(element);

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
