var moviedb = require('./moviedb.js');
var fsutils = require('./fsutils.js');
var netutils = require('./netutils.js');
//var mkdirp = require('mkdirp');

class SeriesMgr{
    constructor(dbmanager, settings){
        this.con = dbmanager;
        this.langs = ["en-US","fr-FR"];
        this.settings = settings;

        //Sets to prevent simultaneous identic requests
        this.current_series_creating = new Set();
    }

    init(){
        // var sql = "CREATE TABLE IF NOT EXISTS series ("
        // " id int NOT NULL AUTO_INCREMENT,"
        // " release_date datetime NOT NULL,"
        // " rating decimal(3,1) NOT NULL DEFAULT '0.0',"
        // " rating_count int UNSIGNED NOT NULL DEFAULT '0',"
        // " nb_seasons TINYINT UNSIGNED (255) NOT NULL,"
        // " original_name VARCHAR(255),"
        // " path VARCHAR(255),"
        // " address VARCHAR(255),"
        // " PRIMARY KEY (id)"
        // ") ";

        // var sql = "CREATE TABLE IF NOT EXISTS series_descriptions ("
        // " id int NOT NULL AUTO_INCREMENT,"
        // " serie_id int NOT NULL,"
        // " release_date datetime NOT NULL,"
        // " rating decimal(3,1) NOT NULL DEFAULT '0.0',"
        // " rating_count int UNSIGNED NOT NULL DEFAULT '0',"
        // " nb_seasons TINYINT UNSIGNED (255) NOT NULL,"
        // " original_name VARCHAR(255),"
        // " path VARCHAR(255),"
        // " address VARCHAR(255)),"
        // " PRIMARY KEY (id),"
        // " FOREIGN KEY (serie_id) REFERENCES series(id) ON DELETE CASCADE"
        // ") ";
        // con.query(sql, function (err, result) {
        //   if (err) throw err;
        //   console.log("Table created");
        // });
    }

    async _getSeriePathById(serieId){
        var serie = await this.con.getSerie(serieId);
        return _getSeriePath(serie);
    }

    async _getSeriePath(serie){
        if(!serie.brick_id){
            return null;
        }
        var brick = await this.con.getBrick(serie.brick_id);
        let serieFolderTitle = serie.original_name+" ("+serie.release_date.getFullYear().toString()+")";
        return brick.path+'/series/'+serieFolderTitle;
    }

    async _createSerieFS(serieId,serieInfos){
        try{
            var serie = await this.con.getSerie(serieId);
            var seriePath = await this._getSeriePath(serie);
            var brick = await this.con.getBrick(serie.brick_id);

            //Check if addPath setted
            if(brick === null){
                console.error("Serie has no brick assigned");
                return null;
            }

            //Check if brick path exist
            if(!await fsutils.exists(brick.path)){
                console.error("Series adding path not existing ",brick.path);
                return null;
            }

            //Create serie folder
            if(!await fsutils.exists(seriePath)){
                await fsutils.mkdirp(seriePath);
            }

            //Create streamy folder
            if(!await fsutils.exists(seriePath+"/.streamy")){
                await fsutils.mkdirp(seriePath+"/.streamy");
            }

            //Create season and episodes folders
            for(var i=0; i<serieInfos.seasons.length; i++){
                let seasonInfo = serieInfos.seasons[i];

                let seasonTitle = "season_"+seasonInfo.season_number.toString();
                var seasonPath = seriePath+"/"+seasonTitle;
                if(!await fsutils.exists(seasonPath)){
                    await fsutils.mkdirp(seasonPath);
                }
                
                //Add episodes
                for(var j=0; j<seasonInfo.episodes.length; j++){
                    let episode = seasonInfo.episodes[j];
                    let episodeTitle = "episode_"+episode.episode_number.toString();
                    var episodePath = seasonTitle+"/"+episodeTitle;
                    if(!await fsutils.exists(episodePath)){
                        await fsutils.mkdirp(episodePath);
                    }
                }
            }           
        } catch (e) {
            console.error("Failing to create file system for ",serie.original_name);
            return null;
        }
        return true;
    }

    //Add info so that a new streamy server can quickly import a server
    async addHintInfos(serieId,infos){
        var serie = await this.con.getSerie(serieId);
        var seriePath = await this._getSeriePath(serie);

        //Check serie folder
        if(!await fsutils.exists(seriePath)){
            return false;
        }
        await fsutils.appendJson(seriePath+"/.streamy/infos.json",infos);
        return true;
    }
    
    async addSerie(serieInfos,serieImages,serieHints){
        //Check if serie is already in an adding state (the original name is suffiscient)
        if(this.current_series_creating.has(serieInfos.original_name)){
            console.error("Already adding serie ",serieInfos.original_name);
            return null;
        }else{
            this.current_series_creating.add(serieInfos.original_name);
        }

        try{ 
            //Check if new serie brick setted
            if(this.settings.global.new_video_brick === null){
                console.error("No new video brick has been provided");
                return null;
            }

            //Check if the brick is reachable
            var brick = await this.con.getBrick(this.settings.global.new_video_brick);
            if(!("path" in brick) || !await fsutils.exists(brick.path)){
                console.error("Video brick not reachable ",brick.path);
                return null;
            }

            // Add serie to database
            var serieId = null;
            var sql = "INSERT INTO `series` (`release_date`,`rating`,`rating_count`,"+
                "`number_of_seasons`,`number_of_episodes`,`original_name`,"+
                "`original_language`, `brick_id`) "+
                " VALUES ('"+serieInfos.release_date+"', "+serieInfos.rating+", "+serieInfos.rating_count+
                ", "+serieInfos.number_of_seasons+", "+serieInfos.number_of_episodes+", '"+serieInfos.original_name.replace(/'/g,"\\'")+
                "', '"+serieInfos.original_language+"', "+brick.id+")";
            var sqlres = await this.con.query(sql);
            var serieId = sqlres.insertId;
            //TODO manage multilang add english by default
            if(serieInfos.langs.en){
                sql = "INSERT INTO `series_translations` (`serie_id`,`lang_id`,`title`,"+
                "`overview`)"+
                " VALUES("+serieId+", 1, '"+serieInfos.langs.en.title.replace(/'/g,"\\'")+
                "', '"+serieInfos.langs.en.overview.replace(/'/g,"\\'")+"')";
                await this.con.query(sql);
            }

            //Add seasons
            for(var i=0; i<serieInfos.seasons.length; i++){
                let seasonInfo = serieInfos.seasons[i];
                sql = "INSERT INTO `series_seasons` (`serie_id`,`release_date`,`season_number`,`number_of_episodes`) "+
                " VALUES("+serieId+",'"+seasonInfo.release_date+"', "+seasonInfo.season_number+", "+seasonInfo.number_of_episodes+")";
                var sqlres = await this.con.query(sql);
                var season_id = sqlres.insertId;

                //TODO manage multilang add english by default
                if(seasonInfo.langs.en){
                    sql = "INSERT INTO `series_seasons_translations` (`season_id`,`lang_id`,`title`,"+
                    "`overview`)"+
                    " VALUES("+season_id+", 1, '"+seasonInfo.langs.en.title.replace(/'/g,"\\'")+
                    "', '"+seasonInfo.langs.en.overview.replace(/'/g,"\\'")+"')";
                    await this.con.query(sql);
                }
                
                //Add episodes
                for(var j=0; j<seasonInfo.episodes.length; j++){
                    let episode = seasonInfo.episodes[j];

                    sql = "INSERT INTO `series_episodes` (`season_id`,`episode_number`,`original_name`,`release_date`,`rating`,`rating_count`) "+
                        " VALUES("+season_id+","+episode.episode_number+", '"+ episode.original_name.replace(/'/g,"\\'")+
                        "', '"+episode.release_date+"', "+episode.rating+", "+episode.rating_count+")";
                    var sqlres = await this.con.query(sql);
                    var episode_id = sqlres.insertId;
                    //TODO manage multilang add english by default
                    if(episode.langs.en){
                        console.log(episode.langs.en.overview.replace(/'/g,"\\'").length);
                        sql = "INSERT INTO `series_episodes_translations` (`episode_id`,`lang_id`,`title`,"+
                            "`overview`)"+
                            " VALUES("+episode_id+", 1, '"+episode.langs.en.title.replace("'","\\'")+
                            "', '"+episode.langs.en.overview.replace(/'/g,"\\'")+"')";
                        await this.con.query(sql);
                    }
                }
            }

            if(await this._createSerieFS(serieId,serieInfos)){
                await this.downloadFanarts(serieId,serieImages);


                serieHints
            }

            console.log("Serie added: ",serieInfos.original_name);
            this.current_series_creating.delete(serieInfos.original_name);
            return serieId;
            
        } catch (e) {
            console.error("Failing adding serie from TheMovieDB",serieInfos.original_name,e);
            this.current_series_creating.delete(serieInfos.original_name);
            return null;
        }
    }

    async downloadFanarts(serieId,serieImages){

        try{
            var serie = await this.con.getSerie(serieId);
            var seriePath = await this._getSeriePath(serie);
            if(seriePath === null){
                console.error("Invalid serie path");
                return false;
            }

            //create fanart folder
            if(!await fsutils.exists(seriePath+"/fanart")){
                await fsutils.mkdirp(seriePath+"/fanart");
            }

            //Download serie images
            if("fanart500" in serieImages) await netutils.download(serieImages.fanart500,seriePath+"/fanart/img500.jpg",false);
            if("fanart300" in serieImages) await netutils.download(serieImages.fanart300,seriePath+"/fanart/img300.jpg",false);
            if("fanart200" in serieImages) await netutils.download(serieImages.fanart200,seriePath+"/fanart/img200.jpg",false);

            for(var i=0; i<serieImages.seasons.length; i++){
                var season = serieImages.seasons[i];
                var seasonFolder = seriePath + "/season_" + season.season_number.toString();
                //create fanart folder
                if(!await fsutils.exists(seasonFolder+"/fanart")){
                    await fsutils.mkdirp(seasonFolder+"/fanart");
                }

                //Download seasons images
                if("fanart500" in season) await netutils.download(season.fanart500,seasonFolder+"/fanart/img500.jpg",false);
                if("fanart300" in season) await netutils.download(season.fanart300,seasonFolder+"/fanart/img300.jpg",false);
                if("fanart200" in season) await netutils.download(season.fanart200,seasonFolder+"/fanart/img200.jpg",false);
                
                for(var i=0; i<season.episodes.length; i++){
                    var episode = season.episodes[i];
                    var episodeFolder = seasonFolder + "/episode_" + episode.episode_number.toString();

                    //create fanart folder
                    if(!await fsutils.exists(episodeFolder+"/fanart")){
                        await fsutils.mkdirp(episodeFolder+"/fanart");
                    }

                    if("fanart300" in episode) await netutils.download(episode.fanart300,episodeFolder+"/fanart/img300.jpg",false);
                    if("fanart200" in episode) await netutils.download(episode.fanart200,episodeFolder+"/fanart/img200.jpg",false);
                }
            }

        }catch(err){
            console.error("Failed to download fanart for serie ",serieId,err);
            return false;
        }
        return true;
    }

    generateTMDBImageUrl(imgId,size){
        return "https://image.tmdb.org/t/p/w"+size.toString()+""+imgId;
    }

    // async _getFanartImagesFromMovieDB(serieId,serieImages){//TODO
    //     //Find brick

    //     //Find TMDB id
    //     var serieId = null;
    //     var sql = "INSERT INTO `series` (`release_date`,`rating`,`rating_count`,"+
    //         "`number_of_seasons`,`number_of_episodes`,`original_name`,"+
    //         "`original_language`) "+
    //         " VALUES ('"+serieInfos.release_date+"', "+serieInfos.rating+", "+serieInfos.rating_count+
    //         ", "+serieInfos.number_of_seasons+", "+serieInfos.number_of_episodes+", '"+serieInfos.original_name.replace(/'/g,"\\'")+
    //         "', '"+serieInfos.original_language+"')";
    //     var sqlres = await this.con.query(sql);
    //     var serieId = sqlres.insertId;
        
    //     try{
    //         //Download serie images
    //         await netutils.download("https://image.tmdb.org/t/p/w500/"+serieImages.fanart,"./fanart/fanart-500.jpg");
    //         await netutils.download("https://image.tmdb.org/t/p/w300/"+serieImages.fanart,"./fanart/fanart-300.jpg");
    //         await netutils.download("https://image.tmdb.org/t/p/w200/"+serieImages.fanart,"./fanart/fanart-200.jpg");

    //         for(var i=0; i<serieImages.seasons.length; i++){
    //             var season = serieImages.seasons[i];
    //             //Download seasons images
    //             await netutils.download("https://image.tmdb.org/t/p/w300/"+season.fanart,"./fanart/fanart-300.jpg");
    //             await netutils.download("https://image.tmdb.org/t/p/w200/"+season.fanart,"./fanart/fanart-200.jpg");
                
    //             for(var i=0; i<season.episodes.length; i++){
    //                 var episode = season.episodes[i];
    //                 await netutils.download("https://image.tmdb.org/t/p/w300/"+episode.fanart,"./fanart/fanart-300.jpg");
    //                 await netutils.download("https://image.tmdb.org/t/p/w200/"+episode.fanart,"./fanart/fanart-200.jpg");
    //             }
    //         }

    //     }catch(err){

    //     }
    // }

    async addSerieFromMovieDB(movieDBId){
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
            let serieId = await this.addSerie(serieInfos,serieImages);

            if(serieId !== null){
                //Add link with moviedb
                var sql = "INSERT INTO `series_moviedb` (`serie_id`,`moviedb_id`)"+
                " VALUES("+serieId+", "+movieDBId+")";
                await this.con.query(sql);

                //Add hint to be faster if you copy the serie folder to another streamy serv
                await this.addHintInfos(serieId,{tmdb_id:movieDBId});
            }

            return serieId;

        } catch (e) {
            console.error("Failing adding serie from TheMovieDB",movieDBId,e);
            return null;
        }

        

        //Download posters
        // try{
        //     //Check if addPath setted
        //     if(this.addPath === null){
        //         console.error("No series adding path has been provided");
        //         return null;
        //     }
        //     //Check if path exist
        //     if(!await fsutils.exists(this.addPath)){
        //         console.error("Series adding path not existing ",this.addPath);
        //         return null;
        //     }

        //     //Retreive infos from the movie db
        //     let infos = await moviedb.tvInfo({"id":movieDBId});
        //     let serieFolderTitle = infos.original_name+" ("+infos.first_air_date.substring(0,4)+")";
        //     console.log("Adding serie ",serieFolderTitle);
        //     console.log("infos",infos);

        //     //Check if serie already exists
        //     if(await fsutils.exists(this.addPath+serieFolderTitle)){
                
        //     }

        //     // Create serie folder
        //     await fsutils.mkdirp(this.addPath+serieFolderTitle);
        //     // if (!fs.existsSync(dir)){
        //     //     fs.mkdirSync(dir);
        //     // }

        //     ;

        //     // Add serie to database
        //     var sql = "INSERT INTO `series` (`release_date`,`rating`,`rating_count`,"
        //         "`number_of_seasons`,`number_of_episodes`,`original_name`,"
        //         "`original_language`) "
        //         " VALUES("+infos.first_air_date+", "+infos.vote_average+", "+infos.vote_count
        //         +", "+infos.number_of_seasons+", "+infos.number_of_episodes+", "+infos.original_name
        //         +", "+infos.original_language+")";

            
        // } catch (e) {
        //     console.error("Failing adding serie from TheMovieDB",movieDBId,e);
        //     return null;
        // }

    }

    async findSerieFromMoviedbId(movieDBId){
        var sql = "SELECT serie_id FROM series_moviedb "
        " WHERE moviedb_id = "+movieDBId.toString();
        let result = await this.con.query(sql);
        if(result.length > 0){
            return result[0].serie_id;
        }else{
            return null;
        }
    }


}

module.exports=SeriesMgr