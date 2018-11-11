class DownloadStatus{
    constructor(type){
        //this.droppedFiles = null;
        this.element = null;
        this.type = type;
        this.resumable;
    }

    /**
     * @param {*} element element containing a box 
     */
    setup(element,target,id){
        var self = this;
        this.element = element;    
        
        let blocs = element.find('.drop_area');
  
        //Reuse resumable if any already on the same target
        let r = null;
        if(uploadMgr.has(target)){
            r = uploadMgr.get(target);
        }else{
            r = uploadMgr.create(target,id);
        }
        this.resumable = r;

        let browse = element.find('.browse'); // TODO change with name
        if(browse){
            r.assignBrowse(browse);
        }

        if(blocs){
            r.assignDrop(blocs);
        }

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

    cancelUpload(){
        if(this.resumable){
            this.resumable.cancel();
            this.showCancelUpload(false);
            this.hideDownloadProgression();
        }
    }

    showCancelUpload(enabled){
        let $elem = this.element.find('.cancel_upload');
        if(!enabled){
            $elem.addClass('d-none');
        }else{
            $elem.removeClass('d-none');
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

}
