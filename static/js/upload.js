class UploadMgr{
    constructor(){
        //Handle all resumable tasks
        this.resumables = new Map();
    }

    has(target){
        return this.resumables.has(target)
    }

    get(target, id = null){
        if(!id){
            return this.resumables.get(target)
        }else{
            //Reuse resumable if any already on the same target
            let r = null;
            if(this.has(target)){
                r = this.get(target);
            }else{
                r = this.create(target,id);
            }
            return r;
        }
    }

    create(target,id = 0){
        let r = new Resumable({
            target: target,
            chunkSize: 10*1024*1024,//10 MB chuncks
            simultaneousUploads:1,
            testChunks:false,
            throttleProgressCallbacks:1,
            generateUniqueIdentifier:function(file){
                return $.get("/upload/fileid?filename=" + encodeURI(file.name)+"&size="+file.size+"&id="+id);
            }
        });

        // Resumable.js isn't supported, fall back on a different method
        if(!r.support) location.href = '/some-default-uploader';
        this.resumables.set(target,r)
        return r;
    }
}

var uploadMgr = new UploadMgr();