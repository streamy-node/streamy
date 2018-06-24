var moviedb = require('./moviedb.js');
var fsutils = require('./fsutils.js');
//var mkdirp = require('mkdirp');

class SeriesMgr{
    constructor(dbmanager, addPath){
        this.con = dbmanager;
        this.langs = ["en-US","fr-FR"];
        this.addPath = addPath;

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

    async addSerie(serieInfos){
        //Check if serie is already in an adding state (the original name is suffiscient)
        if(current_series_creating.has(serieInfos.original_name)){
            console.error("Already adding serie ",serieInfos.original_name);
            return null;
        }else{
            current_series_creating.add(serieInfos.original_name);
        }

        try{ 
            // Add serie to database
            var sql = "INSERT INTO `series` (`release_date`,`rating`,`rating_count`,"
                "`number_of_seasons`,`number_of_episodes`,`original_name`,"
                "`original_language`) "
                " VALUES("+infos.release_date+", "+infos.rating+", "+infos.rating_count
                +", "+infos.number_of_seasons+", "+infos.number_of_episodes+", "+infos.original_name
                +", "+infos.original_language+")";

            
        } catch (e) {
            console.error("Failing adding serie from TheMovieDB",movieDBId,e);
            return null;
        }

        return true;
    }

    async addSerieTranslation(){

    }

    async addSerieFromMovieDB(movieDBId){
        //Retreive infos from the movie db
        let tmdbInfos = await moviedb.tvInfo({"id":movieDBId});
        var tmdbSeasonInfos = [];
        var serieInfos = {};
        serieInfos.seasons = [];
        serieInfos.release_date = tmdbInfos.first_air_date;
        serieInfos.rating = tmdbInfos.vote_average;
        serieInfos.rating_count = tmdbInfos.vote_count;
        serieInfos.number_of_seasons = tmdbInfos.number_of_seasons;
        serieInfos.number_of_episodes = tmdbInfos.number_of_episodes;
        serieInfos.original_name = tmdbInfos.original_name;
        serieInfos.original_language = tmdbInfos.original_language;

        for(var i=0; i<tmdbInfos.seasons.length; i++){
            var season = {};
            let tmdbseason = tmdbInfos.seasons[i];
            season.release_date = tmdbseason.air_date;
            season.season_number = tmdbseason.season_number;
            season.number_of_episodes = tmdbseason.episode_count;
            tmdbSeasonInfos.push(await moviedb.tvSeasonInfo({"tv_id":movieDBId,"season_number":season.season_number}));
        }

        let serieAdded = await addSerie(serieInfos);

        //Fill imdb tables for serie season and episodes

        //Download posters
        try{
            //Check if addPath setted
            if(this.addPath === null){
                console.error("No series adding path has been provided");
                return null;
            }
            //Check if path exist
            if(!await fsutils.exists(this.addPath)){
                console.error("Series adding path not existing ",this.addPath);
                return null;
            }

            //Retreive infos from the movie db
            let infos = await moviedb.tvInfo({"id":movieDBId});
            let serieFolderTitle = infos.original_name+" ("+infos.first_air_date.substring(0,4)+")";
            console.log("Adding serie ",serieFolderTitle);
            console.log("infos",infos);

            //Check if serie already exists
            if(await fsutils.exists(this.addPath+serieFolderTitle)){
                
            }

            // Create serie folder
            await fsutils.mkdirp(this.addPath+serieFolderTitle);
            // if (!fs.existsSync(dir)){
            //     fs.mkdirSync(dir);
            // }

            ;

            // Add serie to database
            var sql = "INSERT INTO `series` (`release_date`,`rating`,`rating_count`,"
                "`number_of_seasons`,`number_of_episodes`,`original_name`,"
                "`original_language`) "
                " VALUES("+infos.first_air_date+", "+infos.vote_average+", "+infos.vote_count
                +", "+infos.number_of_seasons+", "+infos.number_of_episodes+", "+infos.original_name
                +", "+infos.original_language+")";

            
        } catch (e) {
            console.error("Failing adding serie from TheMovieDB",movieDBId,e);
            return null;
        }


        // return new Promise((resolve, reject) => {
        //     for(var i=0; i<this.langs.length; i++){
        //         moviedb.getSerieById({"id":movieDBId},
        //         function(res){
        //             console.log("RESULT ",res);
        //             resolve(res.id)
        //         },
        //         function(err){
        //             console.log("RORO ",err);
        //             reject(err);
        //         });
        //     }
        // });
    }

    findSerieFromMoviedbId(movieDBId){
        return new Promise((resolve, reject) => {
            var sql = "SELECT serie_id FROM series_moviedb "
            " WHERE moviedb_id = "+movieDBId.toString();
            this.con.query(sql, function (err, result) {
                if (err) throw err;
                if(result.length > 0){
                    console.log("Serie found",result);
                    resolve(result.serie_id);
                }else{
                    resolve(null);
                }
            });
        });
    }


}

module.exports=SeriesMgr