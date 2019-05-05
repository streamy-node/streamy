var fsutils = require('../utils/fsutils.js');

class SeriesMgr{
    constructor(dbmanager, settings, mediaMgr,movieDBMgr){
        this.con = dbmanager;
        this.langs = ["en-US","fr-FR"];
        this.settings = settings;
        this.mediaMgr = mediaMgr;
        this.moviedb = movieDBMgr;

        //Sets to prevent simultaneous identic requests
        this.current_series_creating = new Set();
    }

    init(){
    }

    async refreshContentTMDB(serieMedia){
        // Get media tmdb id
        let tmdbId = await this.con.findMoviedbIdFromSerie(serieMedia.id);
        
        if(tmdbId == null){
            console.error("Cannot refresh media "+serieMedia.original_name+" with unknown TMDB id");
            return;
        }

        // Fetch info from tmdb
        let tmdbContent = await this.fetchSerieContentFromTMDB(tmdbId);

        return await this._refreshContent(serieMedia.id,tmdbContent.infos,tmdbContent.images)
    }

    async refresh(serieMedia){
        await this.refreshContent(serieMedia)
        await this.mediaMgr.refreshMediaAllMpd(serieMedia,true);
    }

    async refreshContent(serieMedia){
        return await this.refreshContentTMDB(serieMedia);
    }
    async _refreshContent(mediaId, serieInfos,serieImages){

        if(!serieInfos){
            console.error("Cannot refresh content without series Infos")
            return;
        }

        //TODO manage multilang add english by default
        let langId = 1

        // Get database infos
        let dbSerieInfos = await this.mediaMgr.getMediaInfos(mediaId,langId, 0, null, [])
        let sortKeyDepth = ["season_number","episode_number"]
        let dbSeasonsInfos = await this.mediaMgr.getChildrenMediaInfos(mediaId,langId, 1, null, sortKeyDepth);
        let seriePath = dbSerieInfos.path;

        // Update episodes and seasons numbers
        if(dbSerieInfos.number_of_episodes < serieInfos.number_of_episodes){
            // Update episodes and seasons numbers
            await this.con.updateSerie(mediaId,
                serieInfos.number_of_seasons,
                serieInfos.number_of_episodes);
        }

        // Update main translations
        //TODO manage multilang add english by default
        if(!serieInfos.langs.en){
            console.error("Serie lang other than english not implemented")
            return null;
        }

        if(serieInfos.langs.en.title.length > 0 &&
            serieInfos.langs.en.overview.length > 0){
            await this.con.updateMediaTranslation(mediaId,langId,serieInfos.langs.en.title,
                serieInfos.langs.en.overview)
        }else{
            console.warn("Cannot refresh translation with empty values")
        }

        // Update seasons
        for(var i=0; i<serieInfos.seasons.length; i++){
            let seasonInfo = serieInfos.seasons[i];
            let seasonName = seasonInfo.langs[Object.keys(seasonInfo.langs)[0]].title
            let seasonPath = seriePath+"/"+this.generateSeasonSubPath(seasonInfo.season_number)
            let seasonMediaId = null;

            let dbSeason = null;
            for(let i=0; i < dbSeasonsInfos.length; i++){
                let season = dbSeasonsInfos[i]
                if(season.season_number == seasonInfo.season_number){
                    dbSeason = season;
                    break
                }
            }
            // If the season is already here
            if(dbSeason){
                seasonMediaId = dbSeason.media_id;
                if(seasonInfo.number_of_episodes > dbSeason.number_of_episodes){
                    console.log("Adding new episodes to season "+dbSerieInfos.original_name)
                    await this.con.updateSeason(seasonMediaId,dbSeason.season_number,seasonInfo.number_of_episodes)
                }
            }else{
                // The season is new
                console.log("Adding new season to "+dbSerieInfos.original_name)
                seasonMediaId = await this.con.insertMedia(seasonInfo.release_date,
                    0,
                    0,
                    seasonName,
                    dbSerieInfos.original_language,
                    "",
                    dbSerieInfos.brick_id,
                    0,
                    0,
                    seasonPath,
                    2,
                    mediaId);
    
                let seasonId = await this.con.insertSeason(seasonMediaId,seasonInfo.season_number,seasonInfo.number_of_episodes)

                //TODO manage multilang add english by default
                langId = 1
                if(!seasonInfo.langs.en){
                    console.error("Serie lang other than english not implemented")
                    return null;
                }
                await this.con.insertMediaTranslation(seasonMediaId,langId,seasonInfo.langs.en.title,
                    seasonInfo.langs.en.overview)
            }
            
            //Add episodes
            for(var j=0; j<seasonInfo.episodes.length; j++){
                let episode = seasonInfo.episodes[j];
                let easyName = dbSerieInfos.original_name+" S"+seasonInfo.season_number+"E"+episode.episode_number;
                let episodePath = seasonPath+"/"+this.generateEpisodeSubPath(episode.episode_number)
                
                if(dbSeason && dbSeason.children.length > j){
                    //Episode already existing, do nothing for now
                }else{
                    //New episode
                    let episodeMediaId = await this.con.insertMedia(episode.release_date,
                        episode.rating,
                        episode.rating_count,
                        episode.original_name,
                        serieInfos.original_language,
                        easyName,
                        dbSerieInfos.brick_id,
                        0,
                        1,
                        episodePath,
                        3,
                        seasonMediaId);
                    let episode_id = await this.con.insertEpisode(episodeMediaId,
                        episode.episode_number);
    
                    //TODO manage multilang add english by default
                    langId = 1
                    if(!episode.langs.en){
                        console.error("Serie lang other than english not implemented")
                        return null;
                    }
                    await this.con.insertMediaTranslation(episodeMediaId,langId,episode.langs.en.title,
                        episode.langs.en.overview)
                }
            }
        }     

        if(await this.mediaMgr.createFS(mediaId,serieInfos)){
            try{
                await this.downloadFanarts(mediaId,serieImages);
            }catch(err){
                console.error("Failed to download some fanarts");
            }
        }

        console.log("Serie refreshed: ",dbSerieInfos.original_name);
        return true;
    }
    
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
                try{
                    await this.downloadFanarts(serieMediaId,serieImages);
                }catch(err){
                    console.error("Failed to download some fanarts");
                }
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
        return "series/" + fsutils.cleanFileName(serie_name) + " ("+serie_release_date.getFullYear()+")"
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
        if(!imgId){
            return null;
        }
        return "https://image.tmdb.org/t/p/w"+size.toString()+imgId;
    }

    async fetchSerieContentFromTMDB(movieDBId){
        var serieContent = {};
        try{
            //Retreive infos from the movie db
            let tmdbInfos = await this.moviedb.tvInfo({"id":movieDBId,"langage":"en"});
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
                let tmdbseasonInfos = await this.moviedb.tvSeasonInfo({"id":movieDBId,"season_number":tmdbseason.season_number,"langage":"en"});
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
            serieContent.infos = serieInfos;
            serieContent.images = serieImages; 
            return serieContent;
        }catch(err){
            console.error("Failing fetch serie from TheMovieDB",movieDBId,err);
            return null
        }
    }

    async addFromMovieDB(movieDBId,brickId = null){
        //Check if serie already added
        let serieId = await this.con.findSerieFromMoviedbId(movieDBId);
        if(serieId){
            let errMsg = "Failing adding serie with TheMovieDB id already used"
            throw new Error(errMsg)
        }

        let tmdbContent = await this.fetchSerieContentFromTMDB(movieDBId);

        //Add serie
        let mediaId = await this.addSerie(tmdbContent.infos,tmdbContent.images,brickId);

        if(mediaId !== null){
            //Add link with moviedb to avoid ducplicates
            var sql = "INSERT INTO `series_moviedb` (`media_id`,`moviedb_id`)"+
            " VALUES("+mediaId+", "+movieDBId+")";
            await this.con.query(sql);

            //Add hint to be faster if you copy the serie folder to another streamy serv
            await this.mediaMgr.addHintInfos(mediaId,{tmdb_id:movieDBId});
        }

        return mediaId;
    }




}

module.exports=SeriesMgr