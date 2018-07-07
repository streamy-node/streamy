var fs = require('fs');
var moviedb = require('./moviedb.js');
var mysql = require('mysql');

class DBStructure{
    constructor(){
        this.con = null;
        this.dboptions = null;
        this.langs = new Map();
    }

    initialize(dbOptions,onResult){
        var self = this;
        this.dboptions = dbOptions;
        this.handleDisconnect(()=>{
            // Setup dbase
            this.setup_database(function(error){
                if(error){
                    console.error("Cannot setup the db ",error);
                    onResult(error);
                }else{
                    self.loadLangs();
                    onResult();
                }
            });
        },(error)=>{
            onResult(error);
        });
    }

    async loadLangs(){
        if(this.langs.size == 0){ 
            var rawLangs = await this.getLangs();
            for(var i=0; i<rawLangs.length; i++){
                this.langs[rawLangs[i].iso_639_1] = rawLangs[i].id;
            }
        }
    }

    getConnection(){
        return this.con;
    }

    handleDisconnect(statuscb) {
        var self = this;
        this.con = mysql.createConnection(this.dboptions); // Recreate the connection, since
                                                        // the old one cannot be reused.

        this.con.connect(function(err) {              // The server is either down
            if(err) {                                     // or restarting (takes a while sometimes).
                if(statuscb) statuscb(err);
                setTimeout(self.handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
            }else{
                console.log("Connected to db :)");
                if(statuscb) statuscb();
            }                                    

        });                                    

        this.con.on('error', function(err) {
            console.log('db error', err);
            if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
                self.handleDisconnect(statuscb);                         // lost due to either server restart, or a
            } else {                                      // connnection idle timeout (the wait_timeout
                throw err;                                  // server variable configures this)
            }
        });
    }



    setup_database(onResult){
        var sql = fs.readFileSync('server/sql/init_db.sql').toString();
        this.con.query(sql, function (err, result) {
            if (err){
                if(err.errno === 1050){
                    console.log("Database already initialized");
                    if(onResult) onResult(null);
                }else{
                    console.log("Failed to setup db table: ",err," result: ",result);
                    if(onResult) onResult(err);
                }
            }else{
                console.log("DB initialized");
                if(onResult) onResult(null);
            }
        });
    }

    strdb(str){
        if(str === NULL){
            return "NULL"
        }else{
            return "'"+str.replace(/'/g,"\\'")+"'";
        }
    }

    async _import_genres(){ //TODO
        let tmdbMovieGenres = await moviedb.genreMovieList({"language":"en-US"});
        let tmdbSerieGenres = await moviedb.genreTvList({"language":"en-US"});
        for(var i=0; i<tmdbMovieGenres.length; i++){
            //let tvdbGenre = tmdbMovieGenres[i];
        }
    }

    query(sql){
        return new Promise((resolve, reject) => {
            this.con.query(sql, function (err, result) {
                if (err) reject(err);
                resolve(result);
            });
        });
    }

    async getLangs(){
        var sql = "SELECT * FROM `languages`";
        var results = await this.query(sql);

        if(results.length == 0 ){
            console.error("Cannot get langs ");
            return null;
        }else{
            return results;
        }
    }

    getLangsId(langCode){
        return this.langs[langCode];
    }
    // CREATE TABLE `languages` (
    //     `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
    //     `name` char(49) CHARACTER SET utf8 DEFAULT NULL,
    //     `iso_639_1` char(2) CHARACTER SET utf8 DEFAULT NULL,
    //     PRIMARY KEY (`id`),

    async getSeries(){
        var sql = "SELECT * FROM `series`";
        var results = await this.query(sql);

        return results;
    }

    async getSerie(serieId){
        var sql = "SELECT * FROM `series` WHERE id = "+serieId+"";
        var result = await this.query(sql);

        if(result.length == 0 ){
            console.error("Cannot get serie ",serieId);
            return null;
        }else{
            return result[0];
        }
    }

    // async getSeriesLightTranslations(lang){
    //     var sql = "SELECT * FROM `series` AS s "+
    //     "LEFT JOIN `series_translations` AS t  ON s.id = t.lang_id "+
    //     "LEFT JOIN `series_translations` AS t_en ON s.id = 1";
    //     var result = await this.query(sql);

    //     if(result.length == 0 ){
    //         console.error("Cannot get serie ",serieId);
    //         return null;
    //     }else{
    //         return result[0];
    //     }
    // }

    async getSerieTranslation(serieId,langCode){
        if(!this.checkId(serieId) || !this.checkId(langCode)){
            console.error("getSerieTranslation: Invalid entries ");
            return null;
        }

        var sql = "SELECT * FROM `series_translations`, `languages` WHERE serie_id = "+serieId+" AND series_translations.lang_id = "+langCode;
        var result = await this.query(sql);

        if(result.length == 0 ){
            return null;
        }else{
            return result[0];
        }
    }

    async getSerieSeasons(serieId,langCode){
        if(!this.checkId(serieId) || !this.checkId(langCode)){
            console.error("getSerieSeasons: Invalid entries ");
            return null;
        }

        var sql = "SELECT * FROM `series_seasons`, `series_seasons_translations`"
        +" WHERE series_seasons.serie_id = "+serieId+" AND series_seasons.id = season_id AND series_seasons_translations.lang_id = "+langCode
        +" ORDER BY series_seasons.season_number";
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results;
        }
    }

    async getSerieSeasonEpisodes(seasonId,langCode){
        if(!this.checkId(seasonId) || !this.checkId(langCode)){
            console.error("getFullSerieSeasons: Invalid entries ");
            return null;
        }

        var sql = "SELECT * FROM `series_episodes`, `series_episodes_translations`"
        +" WHERE series_episodes.season_id = "+seasonId+" AND series_episodes.id = episode_id AND series_episodes_translations.lang_id = "+langCode
        +" ORDER BY series_episodes.episode_number";
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results;
        }
    }

    async getSerieSeasonEpisodesFull(seasonId,langCode,userId){
        if(!this.checkId(seasonId) || !this.checkId(langCode)){
            console.error("getFullSerieSeasons: Invalid entries ");
            return null;
        }

        var sql = "SELECT e.*, t.lang_id, t.title, t.overview, p.user_id, p.episode_id, p.audio_lang, p.subtitle_lang, p.progression, p.last_seen FROM `series_episodes` AS e "+
        " LEFT JOIN `series_episodes_translations` AS t  ON e.id = t.episode_id AND t.lang_id = "+langCode+
        " LEFT JOIN `users_episodes_progressions` AS p ON p.user_id = "+userId+" AND e.id = p.episode_id"+
        " WHERE e.season_id = "+seasonId;
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results;
        }
    }

    /// Transcoding part
    async insertAddFileTask(file,target_folder,episode_id,film_id){
        if( (!this.checkId(episode_id) && !this.checkId(film_id)) || target_folder.length == 0 || file.length == 0 ){
            console.error("insertOfflineSplittingTasks: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `add_file_tasks` (`file`,`working_folder`,`episode_id`,`film_id`) "
        + " VALUES('"+file+"', '"+target_folder+"', "+episode_id+", "+film_id+")";
        var sqlres = await this.query(sql);
        var taskId = sqlres.insertId;

        return taskId;
    }

    async removeAddFileTask(id){
        var sql = "DELETE FROM `add_file_tasks`  "
        + " WHERE id = "+id+")";
        var sqlres = await this.query(sql);
        return sqlres;
    }


        // async getSeriesLightTranslations(lang){
    //     var sql = "SELECT * FROM `series` AS s "+
    //     "LEFT JOIN `series_translations` AS t  ON s.id = t.lang_id "+
    //     "LEFT JOIN `series_translations` AS t_en ON s.id = 1";
    //     var result = await this.query(sql);

    //     if(result.length == 0 ){
    //         console.error("Cannot get serie ",serieId);
    //         return null;
    //     }else{
    //         return result[0];
    //     }
    // }

    // CREATE TABLE `series_seasons` (
    //     `id` int NOT NULL AUTO_INCREMENT,
    //     `serie_id` int NOT NULL,
    //     `release_date` datetime NOT NULL,
    //     `season_number` int NOT NULL,
    //     `number_of_episodes` int NOT NULL,

    //     CREATE TABLE `series_seasons_translations` (
    //         `id` int NOT NULL AUTO_INCREMENT,
    //         `season_id` int NOT NULL,
    //         `lang_id` int(10) unsigned NOT NULL,
    //         `title` VARCHAR(255),
    //         `overview` VARCHAR(765),


    async getBrick(brickId){
        var sql = "SELECT `id`, `alias`, `path` FROM `bricks` WHERE `id`="+brickId+"";
        var result = await this.query(sql);

        if(result.length == 0 ){
            return null;
        }else{
            return result[0];
        }
    }

    async getSeriesTranscodingResolutions(){
        var sql = "SELECT serie_res.*, res.name, res.width FROM `series_transcoding_resolutions` AS serie_res, `resolutions` AS res "+
        " WHERE serie_res.resolution_id = res.id";
        var results = await this.query(sql);
        return results;
    }

    async getFilmsTranscodingResolutions(){
        var sql = "SELECT * FROM `films_transcoding_resolutions` AS serie_res, `resolutions` AS res "+
        " WHERE serie_res.resolution_id = res.id";
        var results = await this.query(sql);
        return results;
    }

    async getResolutions(){
        var sql = "SELECT * FROM `resolutions` "+
        " ORDER BY width";
        var results = await this.query(sql);
        return results;
    }

    async getBitrates(){
        var sql = "SELECT * FROM `resolutions_bitrates` "+
        " ORDER BY bitrate";
        var results = await this.query(sql);
        return results;
    }

    async getBitrate(resolutionId){
        var sql = "SELECT * FROM `resolutions_bitrates` "+
        " WHERE resolution_id = "+resolutionId.toString();
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results[0].bitrate;
        }
    }

    

    checkId(id){
        if (typeof id != "number") {
            console.error('checkId: serieId is not a number',id);
            return false;
        }
        return true;
    }

    checkLangCode(langCode){
        if(langCode.length != 2){
            console.error("checkLangCode: Invalid lang code provided, "+langCode,langCode.length);
            return false;
        }
        return true;
    }
}
module.exports=DBStructure