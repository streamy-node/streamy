var moviedb = require('./moviedb.js');
var fsutils = require('./fsutils.js');
var netutils = require('./netutils')
//var mkdirp = require('mkdirp');

class SeriesMgr{
    constructor(dbmanager, globalSettings){
        this.con = dbmanager;
        this.langs = ["en-US","fr-FR"];
        this.globalSettings = globalSettings;

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

    async _createSerieFS(serieId,serieInfos){
        try{
            //Check if addPath setted
            if(this.globalSettings.new_serie_brick === null){
                console.error("No series adding path has been provided");
                return null;
            }

            var brick = await this.con.getBrick(this.globalSettings.new_serie_brick);

            //Check if path exist
            if(!await fsutils.exists(this.addPath)){
                console.error("Series adding path not existing ",this.addPath);
                return null;
            }

            //Create serie folder
            let serieFolderTitle = serieInfos.original_name+" ("+infos.release_date.substring(0,4)+")";
            var seriePath = brick.path+'/'+serieFolderTitle;
            
            if(!await fsutils.exists(seriePath)){
                await fsutils.mkdirp(seriePath);
            }

            var sql = "INSERT INTO `series_locations` (`serie_id`,`brick_id`)"+
            " VALUES("+serieId+", '"+brick.id+"')";
            await this.con.query(sql);

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
                    var episodePath = episodeTitle+"/"+seasonTitle;
                    if(!await fsutils.exists(episodePath)){
                        await fsutils.mkdirp(episodePath);
                    }
                }
            }           
        } catch (e) {
            console.error("Failing adding serie from TheMovieDB",movieDBId,e);
            return null;
        }
    }

    async addSerie(serieInfos){
        //Check if serie is already in an adding state (the original name is suffiscient)
        if(this.current_series_creating.has(serieInfos.original_name)){
            console.error("Already adding serie ",serieInfos.original_name);
            return null;
        }else{
            this.current_series_creating.add(serieInfos.original_name);
        }

        try{ 
            // Add serie to database
            var serieId = null;
            var sql = "INSERT INTO `series` (`release_date`,`rating`,`rating_count`,"+
                "`number_of_seasons`,`number_of_episodes`,`original_name`,"+
                "`original_language`) "+
                " VALUES ('"+serieInfos.release_date+"', "+serieInfos.rating+", "+serieInfos.rating_count+
                ", "+serieInfos.number_of_seasons+", "+serieInfos.number_of_episodes+", '"+serieInfos.original_name.replace(/'/g,"\\'")+
                "', '"+serieInfos.original_language+"')";
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

            await _createSerieFS(serieId,serieInfos);

            console.log("Serie added: ",serieInfos.original_name);
            
        } catch (e) {
            console.error("Failing adding serie from TheMovieDB",serieInfos.original_name,e);
            this.current_series_creating.delete(serieInfos.original_name);
            return null;
        }

        this.current_series_creating.delete(serieInfos.original_name);
        return true;
    }

    async addFanartFromMovieDB(serieId,serieImages){//TODO
        //Find TMDB id

        var serieId = null;
        var sql = "INSERT INTO `series` (`release_date`,`rating`,`rating_count`,"+
            "`number_of_seasons`,`number_of_episodes`,`original_name`,"+
            "`original_language`) "+
            " VALUES ('"+serieInfos.release_date+"', "+serieInfos.rating+", "+serieInfos.rating_count+
            ", "+serieInfos.number_of_seasons+", "+serieInfos.number_of_episodes+", '"+serieInfos.original_name.replace(/'/g,"\\'")+
            "', '"+serieInfos.original_language+"')";
        var sqlres = await this.con.query(sql);
        var serieId = sqlres.insertId;
        
        try{
            //Download serie images
            await netutils.download("https://image.tmdb.org/t/p/w500/"+serieImages.fanart,"./fanart/fanart-500.jpg");
            await netutils.download("https://image.tmdb.org/t/p/w300/"+serieImages.fanart,"./fanart/fanart-300.jpg");
            await netutils.download("https://image.tmdb.org/t/p/w200/"+serieImages.fanart,"./fanart/fanart-200.jpg");

            for(var i=0; i<serieImages.seasons.length; i++){
                var season = serieImages.seasons[i];
                //Download seasons images
                await netutils.download("https://image.tmdb.org/t/p/w300/"+season.fanart,"./fanart/fanart-300.jpg");
                await netutils.download("https://image.tmdb.org/t/p/w200/"+season.fanart,"./fanart/fanart-200.jpg");
                
                for(var i=0; i<season.episodes.length; i++){
                    var episode = season.episodes[i];
                    await netutils.download("https://image.tmdb.org/t/p/w300/"+episode.fanart,"./fanart/fanart-300.jpg");
                    await netutils.download("https://image.tmdb.org/t/p/w200/"+episode.fanart,"./fanart/fanart-200.jpg");
                }
            }

        }catch(err){

        }
    }

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
            serieImages.fanart = tmdbInfos.poster_path;

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

                seasonImages.fanart = tmdbseasonInfos.poster_path;
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
                    episode_image.fanart = tmdbepisode.still_path;
                    episode_image.episode_number = tmdbepisode.episode_number;
                    seasonImages.episodes.push(episode_image);
                }
                serieInfos.seasons.push(season);
                serieImages.seasons.push(seasonImages);
            }

            let serieId = await this.addSerie(serieInfos);

            if(serieId !== null){
                //Add link with moviedb
                var sql = "INSERT INTO `series_moviedb` (`serie_id`,`moviedb_id`)"+
                " VALUES("+serieId+", "+movieDBId+")";
                await con.query(sql);
            }


            //Setup filesystem


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
            return result[0];
        }else{
            return null;
        }
    }


}

module.exports=SeriesMgr