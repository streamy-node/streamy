class MultiMediaMgr{
    constructor(dbmanager){
        this.con = dbmanager;
        this.registredMgr = new Map()
    }

    registerMediaMgr(mediaMgr, category){
        this.registredMgr.set(category,mediaMgr);
    }

    async refreshMediaById(mediaId){
        let media = await this.con.getMedia(mediaId)
        if(!media){
            console.error("cannot refresh unexisting media ",mediaId)
            return null
        }

        if(this.registredMgr.has(media.category_id)){
            let specificMgr = this.registredMgr.get(media.category_id);

            await specificMgr.refreshContent(media);
        }else{

        }
        
        //return await this.refreshMedia(media)
    }

}

module.exports=MultiMediaMgr