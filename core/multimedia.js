var SeriesMgr = require('./media/series.js');
var MoviesMgr = require('./media/movies');
var MovieDBMgr = require('./media/moviedb');
var MediaBase = require('./media/mediabase.js');

const MEDIA_CATEGORIES = {
    "SERIE":1,
    "MOVIE":4,
}
class MultiMediaMgr{
    constructor(dbmanager,settings,processesMgr){
        this.con = dbmanager;
        this.settings = settings
        this.cat_serie = 1;
        this.cat_movie = 4;
        this.registredMgr = new Map()

        this.mediaBase = new MediaBase(dbmanager,processesMgr)
        this.movieDBMgr = new MovieDBMgr(settings)
        this.serieMgr = new SeriesMgr(dbmanager,settings,this.mediaBase,this.movieDBMgr)
        this.movieMgr = new MoviesMgr(dbmanager,settings,this.mediaBase,this.movieDBMgr)

        this.registerMediaMgr(this.serieMgr,this.cat_serie)
        this.registerMediaMgr(this.movieMgr,this.cat_movie)
    }

    registerMediaMgr(mediaMgr, category){
        this.registredMgr.set(category,mediaMgr);
    }

    async addMediaFromTMDb(category_id, tmdbId, brickId=null){
        let specificMgr = this.registredMgr.get(category_id);
        return await specificMgr.addMediaFromTMDb(tmdbId,brickId);
    }

    async refreshMediaById(mediaId){
        let media = await this.con.getMedia(mediaId)
        if(!media){
            console.error("cannot refresh unexisting media ",mediaId)
            return null
        }

        if(!this.registredMgr.has(media.category_id)){
            console.error("Cannot refresh a media without specific manager")
            return null;
        }

        let specificMgr = this.registredMgr.get(media.category_id);
        return await specificMgr.refresh(media);
    }

    async refreshMediaMpd(id,folderName){
        return await this.mediaBase.refreshMediaMpd(id,folderName)
    }

    async removeRepresentation(mediaId, folder,rep_id,safeHash){
        return this.mediaBase.removeRepresentation(mediaId, folder,rep_id,safeHash)
    }

    async getMediaInfos(mediaId, langId, maxDepth, userId, sortKeyDepth){
        return await this.mediaBase.getMediaInfos(mediaId,langId, maxDepth, userId, sortKeyDepth)
    }

    async getChildrenMediaInfos(mediaId,langId, maxDepth, userId, sortKeyDepth){
        return await this.mediaBase.getChildrenMediaInfos(mediaId,langId, maxDepth, userId, sortKeyDepth)
    }

    async getMediaListByCategory(categoryId, langId, userId, orderby, ascending, count, offset, pattern){
        return await this.mediaBase.getMediaListByCategory(categoryId, langId, userId, orderby, ascending, count, offset, pattern)
    }

    async removeMpd(mediaId, folder){
        return await this.mediaBase.removeMpd(mediaId, folder);
    }

    async getPlayerMpdFiles(mediaId){
        return await this.mediaBase.getPlayerMpdFiles(mediaId);
    }

    async getMediaMpdsSummary(mediaId){
        return await this.mediaBase.getMediaMpdsSummary(mediaId);
    }

    async getPlayerMpdFile(id,folderName){
        return await this.mediaBase.getPlayerMpdFile(id,folderName);
    }

    getMediaBase(){
        return this.mediaBase;
    }
}

MultiMediaMgr.CATEGORIES = MEDIA_CATEGORIES

module.exports=MultiMediaMgr