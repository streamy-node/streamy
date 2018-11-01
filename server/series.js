var moviedb = require('./moviedb.js');
var fsutils = require('./fsutils.js');
var netutils = require('./netutils.js');
const Media = require('./media.js');

class SeriesMgr{
    constructor(dbmanager, settings, mediaMgr){
        this.con = dbmanager;
        this.langs = ["en-US","fr-FR"];
        this.settings = settings;
        this.mediaMgr = mediaMgr;

        //Sets to prevent simultaneous identic requests
        this.current_series_creating = new Set();
    }

    init(){
    }

    //TODO use media getMpdFiles
    // async getMpdFiles(mediaId){
    //     let outputFiles = [];
    //     let media = await this.con.getMedia(mediaId)
    //     let mpdFiles = await this.con.getMdpFiles(mediaId);
        
    //     for(var i=0; i<mpdFiles.length; i++){
    //         let mpdfile = mpdFiles[i];
    //         //let path = "/brick/"+media.brick_id+"/data/season_"+serie.season_number.toString()+"/episode_"+serie.episode_number+"/"+mpdfile.folder+"/allsub.mpd";
    //         let path = "/brick/"+media.brick_id+"/"+media.path+"/"+mpdfile.folder+"/allsub.mpd";
    //         let title = media.original_name+" S"+media.season_number+"E"+media.episode_number.toString();
    //         outputFiles.push({filename:path,title:title});
    //     }
    //     return outputFiles;
    // }
    // generateEasyName(){

    // }
    
    async addSerie(serieInfos,serieImages,brickId = null,serieHints){
        //Check if serie is already in an adding state (the original name is suffiscient)
        if(this.current_series_creating.has(serieInfos.original_name)){
            console.error("Already adding serie ",serieInfos.original_name);
            return null;
        }else{
            this.current_series_creating.add(serieInfos.original_name);
        }

        try{ 
            //Check if new serie brick setted
            let targetBrickId = brickId;
            if(targetBrickId == null && this.settings.global.new_video_brick === null){
                console.error("No new video brick has been provided for new series");
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

            let seriePath = this.generateSeriePath(serieInfos.original_name,new Date(serieInfos.release_date))
            let serieMediaId = await this.con.insertMedia(serieInfos.release_date,
                serieInfos.rating,
                serieInfos.rating_count,serieInfos.original_name,
                serieInfos.original_language,
                "",
                brick.id,
                0,
                0,
                seriePath,
                1);
            let serieId = await this.con.insertSerie(serieMediaId,
                serieInfos.number_of_seasons,
                serieInfos.number_of_episodes);

            //TODO manage multilang add english by default
            let lang_id = 1
            if(!serieInfos.langs.en){
                console.error("Serie lang other than english not implemented")
                return null;
            }
            await this.con.insertMediaTranslation(serieMediaId,lang_id,serieInfos.langs.en.title,
                serieInfos.langs.en.overview)

            //Add seasons
            for(var i=0; i<serieInfos.seasons.length; i++){
                let seasonInfo = serieInfos.seasons[i];
                let seasonName = seasonInfo.langs[Object.keys(seasonInfo.langs)[0]].title
                let seasonPath = seriePath+"/"+this.generateSeasonSubPath(seasonInfo.season_number)
                //let easyName = serieInfos.original_name+" S"+seasonInfo.season_number;
                let seasonMediaId = await this.con.insertMedia(seasonInfo.release_date,
                    0,
                    0,
                    seasonName,
                    serieInfos.original_language,
                    "",
                    brick.id,
                    0,
                    0,
                    seasonPath,
                    2,
                    serieMediaId);

                let seasonId = await this.con.insertSeason(seasonMediaId,seasonInfo.season_number,seasonInfo.number_of_episodes)

                //TODO manage multilang add english by default
                lang_id = 1
                if(!seasonInfo.langs.en){
                    console.error("Serie lang other than english not implemented")
                    return null;
                }
                await this.con.insertMediaTranslation(seasonMediaId,lang_id,seasonInfo.langs.en.title,
                    seasonInfo.langs.en.overview)
                
                //Add episodes
                for(var j=0; j<seasonInfo.episodes.length; j++){
                    let episode = seasonInfo.episodes[j];
                    let easyName = serieInfos.original_name+" S"+seasonInfo.season_number+"E"+episode.episode_number;
                    let episodePath = seasonPath+"/"+this.generateEpisodeSubPath(episode.episode_number)
                    let episodeMediaId = await this.con.insertMedia(episode.release_date,
                        episode.rating,
                        episode.rating_count,
                        episode.original_name,
                        serieInfos.original_language,
                        easyName,
                        brick.id,
                        0,
                        1,
                        episodePath,
                        3,
                        seasonMediaId);
                    let episode_id = await this.con.insertEpisode(episodeMediaId,
                        episode.episode_number);

                    //TODO manage multilang add english by default
                    lang_id = 1
                    if(!episode.langs.en){
                        console.error("Serie lang other than english not implemented")
                        return null;
                    }
                    await this.con.insertMediaTranslation(episodeMediaId,lang_id,episode.langs.en.title,
                        episode.langs.en.overview)
                }
            }

            if(await this.mediaMgr.createFS(serieMediaId,serieInfos)){
                await this.downloadFanarts(serieMediaId,serieImages);
            }

            console.log("Serie added: ",serieInfos.original_name);
            this.current_series_creating.delete(serieInfos.original_name);
            return serieMediaId;
            
        } catch (e) {
            console.error("Failing adding serie from TheMovieDB",serieInfos.original_name,e);
            this.current_series_creating.delete(serieInfos.original_name);
            return null;
        }
    }

    generateEpisodePath(serie_name,serie_release_date,season_number,episode_number){
        return this.generateSeasonPath(serie_name,serie_release_date,season_number)+"/"+this.generateEpisodeSubPath(episode_number);
    }

    generateSeriePath(serie_name,serie_release_date){
        return "series/" + serie_name + " ("+serie_release_date.getFullYear()+")"
    }

    generateSeasonPath(serie_name,serie_release_date,season_number){
        return this.generateSeriePath(serie_name,serie_release_date)+"/"+this.generateSeasonSubPath(season_number)
    }

    generateSeasonSubPath(season_number){
        return "season_"+season_number.toString();
    }

    generateEpisodeSubPath(episode_number){
        return "episode_"+episode_number.toString();
    }

    async downloadFanarts(mediaId,serieImages){
        
        let media = await this.con.getMedia(mediaId);
        let brick = await this.con.getBrick(media.brick_id);
        
        if(brick === null || media === null){
            console.error("Cannot download fannart, cannot get media or brick");
            return false;
        }
        let path = brick.brick_path + "/" + media.path;

        
        let topImagesPromises = await this.mediaMgr.downloadFanartsToDir(path,serieImages)
        
        for(var i=0; i<serieImages.seasons.length; i++){
            var season = serieImages.seasons[i];
            var seasonFolder = path +"/"+this.generateSeasonSubPath(season.season_number);
            
            //Download seasons images
            this.mediaMgr.downloadFanartsToDir(seasonFolder,season)

            for(var e=0; e<season.episodes.length; e++){
                var episode = season.episodes[e];
                var episodeFolder = seasonFolder +"/"+ this.generateEpisodeSubPath(episode.episode_number);

                this.mediaMgr.downloadFanartsToDir(episodeFolder,episode)
            }
        }
        
        //Wait only for the first level
        await Promise.all(topImagesPromises);
    }

    generateTMDBImageUrl(imgId,size){
        return "https://image.tmdb.org/t/p/w"+size.toString()+""+imgId;
    }

    async addSerieFromMovieDB(movieDBId,brickId = null){
        //Check if serie already added
        let serieId = await this.findSerieFromMoviedbId(movieDBId);
        if(serieId){
            console.error("Failing adding serie with TheMovieDB id already used");
            return null
        }
        try{
            //Retreive infos from the movie db
            let tmdbInfos = await moviedb.tvInfo({"id":movieDBId,"langage":"en"});
            var serieInfos = {};
            serieInfos.langs = {};
            serieInfos.seasons = [];
            serieInfos.release_date = tmdbInfos.first_air_date;
            serieInfos.rating = tmdbInfos.vote_average;
            serieInfos.rating_count = tmdbInfos.vote_count;
            serieInfos.number_of_seasons = tmdbInfos.number_of_seasons;
            serieInfos.number_of_episodes = tmdbInfos.number_of_episodes;
            serieInfos.original_name = tmdbInfos.original_name;
            serieInfos.original_language = tmdbInfos.original_language;

            var serieImages = {};
            serieImages.seasons = [];
            serieImages.fanart500 = this.generateTMDBImageUrl(tmdbInfos.poster_path,500);
            serieImages.fanart300 = this.generateTMDBImageUrl(tmdbInfos.poster_path,300);
            serieImages.fanart200 = this.generateTMDBImageUrl(tmdbInfos.poster_path,200);

            //Add english by default
            serieInfos.langs.en = {};
            serieInfos.langs.en.overview = tmdbInfos.overview;//TODO split if > 765 octets
            serieInfos.langs.en.title = tmdbInfos.name

            for(var i=0; i<tmdbInfos.seasons.length; i++){
                var season = {};
                season.langs = {};
                season.episodes = [];

                var seasonImages = {};
                seasonImages.episodes = [];

                let tmdbseason = tmdbInfos.seasons[i];
                let tmdbseasonInfos = await moviedb.tvSeasonInfo({"id":movieDBId,"season_number":tmdbseason.season_number,"langage":"en"});
                season.release_date = tmdbseasonInfos.air_date;
                season.season_number = tmdbseasonInfos.season_number;
                season.number_of_episodes = tmdbseasonInfos.episodes.length;

                season.langs.en = {};
                season.langs.en.overview = tmdbseasonInfos.overview;
                season.langs.en.title = tmdbseasonInfos.name;

                seasonImages.fanart500 = this.generateTMDBImageUrl(tmdbseasonInfos.poster_path,500);
                seasonImages.fanart300 = this.generateTMDBImageUrl(tmdbseasonInfos.poster_path,300);
                seasonImages.fanart200 = this.generateTMDBImageUrl(tmdbseasonInfos.poster_path,200);
                seasonImages.season_number = tmdbseasonInfos.season_number;

                for(var j=0; j<tmdbseasonInfos.episodes.length; j++){
                    var tmdbepisode = tmdbseasonInfos.episodes[j];
                    var episode = {};
                    episode.langs = {};
                    episode.episode_number = tmdbepisode.episode_number;
                    episode.original_name = tmdbepisode.name;
                    episode.release_date = tmdbepisode.air_date;
                    episode.rating = tmdbepisode.vote_average;
                    episode.rating_count = tmdbepisode.vote_count;

                    episode.langs.en = {};
                    episode.langs.en.title = tmdbepisode.name;
                    episode.langs.en.overview = tmdbepisode.overview;
                    season.episodes.push(episode);

                    var episode_image = {};
                    episode_image.fanart200 = this.generateTMDBImageUrl(tmdbepisode.still_path,200);
                    episode_image.fanart300 = this.generateTMDBImageUrl(tmdbepisode.still_path,300);
                    episode_image.episode_number = tmdbepisode.episode_number;
                    seasonImages.episodes.push(episode_image);
                }
                serieInfos.seasons.push(season);
                serieImages.seasons.push(seasonImages);
            }

            //Add serie
            let mediaId = await this.addSerie(serieInfos,serieImages,brickId);

            if(mediaId !== null){
                //Add link with moviedb to avoid ducplicates
                var sql = "INSERT INTO `series_moviedb` (`media_id`,`moviedb_id`)"+
                " VALUES("+mediaId+", "+movieDBId+")";
                await this.con.query(sql);

                //Add hint to be faster if you copy the serie folder to another streamy serv
                await this.mediaMgr.addHintInfos(mediaId,{tmdb_id:movieDBId});
            }

            return mediaId;

        } catch (e) {
            console.error("Failing adding serie from TheMovieDB",movieDBId,e);
            return null;
        }
    }

    async findSerieFromMoviedbId(movieDBId){
        if(!this.con.checkId(movieDBId)){
            return null;
        }
        var sql = "SELECT media_id FROM series_moviedb "+
        " WHERE moviedb_id="+movieDBId;
        let result = await this.con.query(sql);
        if(result.length > 0){
            return result[0].media_id;
        }else{
            return null;
        }
    }


}

module.exports=SeriesMgr