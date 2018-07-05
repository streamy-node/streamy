class UploadUtils{
    constructor(){
       this.isAdvancedUploadVar = null; 
    }

    isAdvancedUpload(){
        if(this.isAdvancedUploadVar === null){
            // https://css-tricks.com/drag-and-drop-file-uploading/
            var div = document.createElement('div');
            this.isAdvancedUploadVar = (('draggable' in div) || ('ondragstart' in div && 'ondrop' in div)) && 'FormData' in window && 'FileReader' in window; 
        }
        return this.isAdvancedUploadVar;
    }
}

var uploadUtils = new UploadUtils();