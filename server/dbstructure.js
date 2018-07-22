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

    async getLangFromIso639_2(langCode){
        var sql = "SELECT * FROM `languages`,`languages_iso_639_2` WHERE languages.id = languages_iso_639_2.language_id AND iso_639_2 = '"+langCode+"'";
        var result = await this.query(sql);

        if(result.length == 0 ){
            console.error("Cannot lang from 639_2 norme ",langCode);
            return null;
        }else{
            return result[0];
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

    async getEpisodePath(episodeId){
        if(!this.checkId(episodeId) ){
            console.error("getEpisodePath: Invalid entries ");
            return null;
        }

        var sql = "SELECT bricks.path as brick_path, series.original_name as serie_name, series.release_date as serie_release_date, season.season_number,  ep.episode_number"
        +" FROM `series_episodes` AS ep, `series_seasons` AS season, `series`, `bricks` "
        +" WHERE ep.id = "+episodeId+" and ep.season_id = season.id AND season.serie_id = series.id AND bricks.id = series.brick_id";
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results[0];
        }
    }

    async getSeriesMdpFiles(episodeId){
        if(!this.checkId(episodeId)){
            console.error("getEpisodeStreams: Invalid entries ");
            return null;
        }

        var sql = "SELECT * FROM `series_mpd_files` AS mdp "+
        " WHERE mdp.episode_id = "+episodeId;
        var results = await this.query(sql);

        return results;
    }

    async getSeriesVideos(mdpId){
        if(!this.checkId(mdpId)){
            console.error("getSeriesVideos: Invalid entries ");
            return null;
        }

        var sql = "SELECT * FROM `series_videos` AS videos "+
        " WHERE videos.mpd_id = "+mdpId;
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results;
        }
    }

    async getSeriesAudios(mdpId){
        if(!this.checkId(mdpId)){
            console.error("getSeriesAudios: Invalid entries ");
            return null;
        }

        var sql = "SELECT * FROM `series_audios` AS s "+
        " WHERE s.mpd_id = "+mdpId;
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results;
        }
    }  

    async getSeriesSrts(mdpId){
        if(!this.checkId(mdpId)){
            console.error("getSeriesSrts: Invalid entries ");
            return null;
        }

        var sql = "SELECT * FROM `series_srts` AS s "+
        " WHERE s.mpd_id = "+mdpId;
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results;
        }
    }   

    async getSerieMpdFileFromEpisode(episodeId,workingDir){
        if(!this.checkId(episodeId) && workingDir.length > 0 ){
            console.error("getSerieMpdFileFromEpisode: Invalid entries ");
            return null;
        }
        var sql = "SELECT * "
        +" FROM `series_mpd_files` "
        +" WHERE series_mpd_files.episode_id = "+episodeId+" AND folder = '"+workingDir+"'";
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results[0];
        }
    }

    async insertSerieMPDFile(episode_id,folder,complete){
        if( (!this.checkId(episode_id) || folder.length && 0)){
            console.error("insertSerieMPDFile: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `series_mpd_files` (`episode_id`,`folder`,`complete`) "
        + " VALUES("+episode_id+", '"+folder+"', "+complete.toString()+")";
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async setSerieMPDFileComplete(mpd_id,complete){
        if( (!this.checkId(mpd_id))){
            console.error("setSerieMPDFileComplete: Invalid entries ");
            return null;
        }
        var sql = "UPDATE `series_mpd_files` SET `complete` = "+complete.toString()+" WHERE `id` = "+mpd_id.toString();
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async insertSerieVideo(mpd_id,resolution_id){
        if( (!this.checkId(mpd_id) || !this.checkId(resolution_id))){
            console.error("insertSerieVideo: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `series_videos` (`mpd_id`,`resolution_id`) "
        + " VALUES("+mpd_id+", "+resolution_id+")";
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async insertSerieAudio(mpd_id,lang_id,channels){
        if( (!this.checkId(mpd_id) && !this.checkId(lang_id))){
            console.error("insertSerieVideo: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `series_audios` (`mpd_id`,`lang_id`,`channels`) "
        + " VALUES("+mpd_id+", "+lang_id+", "+channels+")";
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async getFilmPath(filmId){
        if(!this.checkId(filmId) ){
            console.error("getFilmPath: Invalid entries ");
            return null;
        }

        var sql = "SELECT bricks.path as brick_path, films.original_name, films.release_date "
        +" FROM `films`, `bricks` "
        +" WHERE films.id = "+filmId+" AND bricks.id = films.brick_id";
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results[0];
        }
    }

    async getFilmMpdFile(filmId,workingDir){
        if(!this.checkId(filmId) && workingDir.length > 0){
            console.error("getFilmMpdFile: Invalid entries ");
            return null;
        }
        var sql = "SELECT * "
        +" FROM `films_mpd_files` "
        +" WHERE films_mpd_files.film_id = "+filmId+" AND films_mpd_files.folder = '"+workingDir+"'";
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results[0];
        }
    }

    async insertFilmMPDFile(film_id,folder,complete){
        if( (!this.checkId(film_id) && folder.length > 0)){
            console.error("insertFilmMpd: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `films_mpd_files` (`film_id`,`folder`,`complete`) "
        + " VALUES("+film_id+", '"+folder+"',"+complete.toString()+")";
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async setFilmMPDFileComplete(mpd_id,complete){
        if( (!this.checkId(mpd_id))){
            console.error("setFilmMPDFileComplete: Invalid entries ");
            return null;
        }
        var sql = "UPDATE `films_mpd_files` SET `complete` = "+complete.toString()+" WHERE `id` = "+mpd_id.toString();
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async insertFilmVideo(mpd_id,resolution_id){
        if( (!this.checkId(mpd_id) && !this.checkId(resolution_id))){
            console.error("insertFilmVideo: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `films_videos` (`mpd_id`,`resolution_id`) "
        + " VALUES("+mpd_id+", "+resolution_id+")";
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async getFilmsAudios(mdpId){
        if(!this.checkId(mdpId)){
            console.error("getFilmsAudios: Invalid entries ");
            return null;
        }

        var sql = "SELECT * FROM `films_audios` AS s "+
        " WHERE s.mpd_id = "+mdpId;
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results;
        }
    }
    
    async insertFilmAudio(mpd_id,lang_id,channels){
        if( (!this.checkId(mpd_id) && !this.checkId(lang_id))){
            console.error("insertFilmAudio: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `films_audios` (`mpd_id`,`lang_id`,`channels`) "
        + " VALUES("+mpd_id+", "+lang_id+", "+channels+")";
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async getFilmsSrts(mdpId){
        if(!this.checkId(mdpId)){
            console.error("getFilmsSrts: Invalid entries ");
            return null;
        }

        var sql = "SELECT * FROM `films_srts` AS s "+
        " WHERE s.mpd_id = "+mdpId;
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results;
        }
    }

    async getAudioBitrate(target_channels){
        var sql = "SELECT * FROM `audio_bitrates` "+
        " WHERE channels = "+target_channels.toString();
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results[0].bitrate;
        }
    }

    /// Transcoding part
    async insertAddFileTask(file,working_folder,episode_id,film_id){
        if( (!this.checkId(episode_id) && !this.checkId(film_id)) || working_folder.length == 0 || file.length == 0 ){
            console.error("insertAddFileTask: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `add_file_tasks` (`file`,`working_folder`,`episode_id`,`film_id`) "
        + " VALUES('"+file+"', '"+working_folder+"', "+episode_id+", "+film_id+")";
        var sqlres = await this.query(sql);
        var taskId = sqlres.insertId;

        return taskId;
    }


    async getAddFileTask(fileName){
        let sql = "SELECT * FROM `add_file_tasks` WHERE file = '"+fileName+"'";
        let result = await this.query(sql);

        if(result.length == 0 ){
            return null;
        }else{
            return result[0];
        }
    }

    async getAddFileTasks(){
        let sql = "SELECT * FROM `add_file_tasks`";
        let results = await this.query(sql);
        return results;
    }

    async removeAddFileTask(id){
        let sql = "DELETE FROM `add_file_tasks`  "
        + " WHERE id = "+id;
        let sqlres = await this.query(sql);
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
        var sql = "SELECT res.* FROM `series_transcoding_resolutions` AS serie_res, `resolutions` AS res "+
        " WHERE serie_res.resolution_id = res.id";
        var results = await this.query(sql);
        return results;
    }

    async getFilmsTranscodingResolutions(){
        var sql = "SELECT res.* FROM `films_transcoding_resolutions` AS serie_res, `resolutions` AS res "+
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

    async getResolutionBitrate(resolutionId){
        var sql = "SELECT * FROM `resolutions_bitrates`, `resolutions` "+
        " WHERE resolution_id = "+resolutionId.toString()+" AND resolutions.id = resolution_id";
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results[0];
        }
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

    async insertWorker(ipv4,port,enabled){
        var sql = "INSERT INTO `ffmpeg_workers` (`ipv4`,`port`,`enabled`) "
        + " VALUES(INET_ATON("+ipv4+"), "+port+", "+enabled+")";
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async getFfmpegWorkers(){
        var sql = "SELECT `id`, INET_NTOA(`ipv4`), `port`, `enabled` FROM `ffmpeg_workers` ";
        var results = await this.query(sql);
        return results; 
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