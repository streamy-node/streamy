//var moviedb = require('./moviedb.js');
var fsutils = require('./fsutils.js');
var netutils = require('./netutils.js');
const Media = require('./media.js');

class MoviesMgr{
    constructor(dbmanager, settings, mediaMgr,moviedbMgr){
        this.con = dbmanager;
        this.langs = ["en-US","fr-FR"];
        this.settings = settings;
        this.mediaMgr = mediaMgr;
        this.moviedb = moviedbMgr
        //Sets to prevent simultaneous identic requests
        this.current_adding_movies = new Set();
    }

    init(){
    }
    
    async addMovie(movieInfos,fanarts,brickId = null,movieHints){
        //Check if movie is already in an adding state (the original name is suffiscient)
        if(this.current_adding_movies.has(movieInfos.original_name)){
            console.error("Already adding movie ",movieInfos.original_name);
            return null;
        }else{
            this.current_adding_movies.add(movieInfos.original_name);
        }

        try{ 
            //Check if new movie brick setted
            let targetBrickId = brickId;
            if(targetBrickId == null && this.settings.global.new_video_brick === null){
                console.error("No new video brick has been provided for new media");
                return null;
            }else if(targetBrickId == null){
                targetBrickId = this.settings.global.new_video_brick;
            }

            //Check if the brick is reachable
            var brick = await this.con.getBrick(targetBrickId);
            if(!("brick_path" in brick) || !await fsutils.exists(brick.brick_path)){
                console.error("Video brick not reachable ",brick.brick_path);
                return null;
            }

            let mediaPath = this.generateMoviePath(movieInfos.original_name,new Date(movieInfos.release_date))
            let mediaId = await this.con.insertMedia(movieInfos.release_date,
                movieInfos.rating,
                movieInfos.rating_count,
                movieInfos.original_name,
                movieInfos.original_language,
                movieInfos.original_name,
                brick.id,
                0,
                1,
                mediaPath,
                4);

            await this.con.insertMovie(mediaId);

            //TODO manage multilang add english by default
            let lang_id = 1
            if(!movieInfos.langs.en){
                console.error("Movie lang other than english not implemented")
                return null;
            }
            await this.con.insertMediaTranslation(mediaId,lang_id,movieInfos.langs.en.title,
                movieInfos.langs.en.overview)

            
            if(await this.mediaMgr.createFS(mediaId)){
                try{
                    await this.downloadFanarts(mediaId,fanarts);
                }catch(err){
                    console.error("Failed to download some fanarts");
                }
            }

            console.log("Movie added: ",movieInfos.original_name);
            this.current_adding_movies.delete(movieInfos.original_name);
            return mediaId;
            
        } catch (e) {
            console.error("Failing adding movie from TheMovieDB",movieInfos.original_name,e);
            this.current_adding_movies.delete(movieInfos.original_name);
            return null;
        }
    }

    generateMoviePath(name,release_date){
        return "movies/" + fsutils.cleanFileName(name) + " ("+release_date.getFullYear()+")"
    }

    async downloadFanarts(mediaId,fanarts){
        let media = await this.con.getMedia(mediaId);
        let brick = await this.con.getBrick(media.brick_id);
        
        if(brick === null || media === null){
            console.error("Cannot download fanart, cannot get media or brick");
            return false;
        }
        let path = brick.brick_path + "/" + media.path;
        
        let topImagesPromises = await this.mediaMgr.downloadFanartsToDir(path,fanarts)
                
        await Promise.all(topImagesPromises);
    }

    generateTMDBImageUrl(imgId,size){
        return "https://image.tmdb.org/t/p/w"+size.toString()+""+imgId;
    }

    async addMovieFromMovieDB(movieDBId,brickId = null){
        //Check if movie already added
        let mediaId = await this.findMovieFromMoviedbId(movieDBId);
        if(mediaId){
            let errMsg = "Failing adding movie with TheMovieDB id already used";
            console.error(errMsg);
            throw new Error(errMsg)
        }

        //Retreive infos from the movie db
        let tmdbInfos = await this.moviedb.movieInfo({"id":movieDBId,"language":"en"});
        var moviesInfos = {};
        moviesInfos.langs = {};
        moviesInfos.release_date = tmdbInfos.release_date;
        moviesInfos.rating = tmdbInfos.vote_average;
        moviesInfos.rating_count = tmdbInfos.vote_count;
        moviesInfos.original_name = tmdbInfos.original_title;
        moviesInfos.original_language = tmdbInfos.original_language;

        var fanarts = {};
        fanarts.fanart500 = this.generateTMDBImageUrl(tmdbInfos.poster_path,500);
        fanarts.fanart300 = this.generateTMDBImageUrl(tmdbInfos.poster_path,300);
        fanarts.fanart200 = this.generateTMDBImageUrl(tmdbInfos.poster_path,200);

        //Add english by default
        moviesInfos.langs.en = {};
        moviesInfos.langs.en.overview = tmdbInfos.overview;
        moviesInfos.langs.en.title = tmdbInfos.title

        //Add movie
        mediaId = await this.addMovie(moviesInfos,fanarts,brickId);

        if(mediaId !== null){
            //Add link with moviedb to avoid ducplicates
            var sql = "INSERT INTO `movies_moviedb` (`media_id`,`moviedb_id`)"+
            " VALUES("+mediaId+", "+movieDBId+")";
            await this.con.query(sql);

            //Add hint to be faster if you copy the films folder to another streamy serv
            await this.mediaMgr.addHintInfos(mediaId,{tmdb_id:movieDBId});
        }
        return mediaId;
    }

    async findMovieFromMoviedbId(movieDBId){
        if(!this.con.checkId(movieDBId)){
            return null;
        }
        var sql = "SELECT media_id FROM movies_moviedb "+
        " WHERE moviedb_id="+movieDBId;
        let result = await this.con.query(sql);
        if(result.length > 0){
            return result[0].media_id;
        }else{
            return null;
        }
    }


}

module.exports=MoviesMgr