var fs = require('fs');
var moviedb = require('./moviedb.js');
var mysql = require('mysql');
const EventEmitter = require('events');

class DBStructure extends EventEmitter{
    constructor(){
        super();
        this.con = null;
        this.dboptions = null;
        this.langs = new Map();
        this.categories = new Map()
    }

    initialize(dbOptions,onResult){
        var self = this;
        this.dboptions = dbOptions;

        this.handleDisconnect((err)=>{
            if(err){
                console.error("Cannot connect to db ",err);
                onResult(err);
                return;
            } 
            // Setup dbase
            this.setup_database(function(error){
                if(error){
                    console.error("Cannot setup the db ",error);
                    onResult(error);
                }else{
                    self._cacheStaticData();
                    onResult();
                }
            });
        },(error)=>{
            onResult(error);
        });
            
    }

    async _cacheStaticData(){
        this._loadCategories();
        this._loadLangs();
    }

    async _loadLangs(){
        if(this.langs.size == 0){ 
            var rawLangs = await this.getLangs();
            for(var i=0; i<rawLangs.length; i++){
                this.langs[rawLangs[i].iso_639_1] = rawLangs[i].id;
            }
        }
    }

    async _loadCategories(){
        let categories = await this.getCategories()
        for(let i=0; i<categories.length; i++){
            this.categories.set(categories[i].id,categories[i].category)
        }
    }

    async getLangFromIso639_2(langCode){
        var sql = "SELECT * FROM `languages`,`languages_iso_639_2` WHERE languages.id = languages_iso_639_2.language_id AND iso_639_2 = '"+langCode+"'";
        var result = await this.query(sql);

        if(result.length == 0 ){
            console.error("Cannot get lang from 639_2 norme ",langCode);
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
                self.emit("connected",self.con);
            }                                    

        });                                    

        this.con.on('error', function(err) {
            console.log('db error', err);
            self.emit("disconnected");
            this.con.destroy();
            if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
                self.handleDisconnect(statuscb);                         // lost due to either server restart, or a
            } else {                                     // connnection idle timeout (the wait_timeout
                console.error("DB error")
                throw err;                                  // server variable configures this)
            }
        });
    }

    setup_database(onResult){
        //If the database is available, create tables if necessary
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

    async getSerieFromEpisode(episodeId){
        var sql = "SELECT series.*, saison.season_number, ep.episode_number  FROM `series`, `series_episodes` AS ep, `series_seasons` AS saison"+
        " WHERE ep.id = "+episodeId+" AND ep.season_id = saison.id AND saison.serie_id = series.id";
        var result = await this.query(sql);

        if(result.length == 0 ){
            console.error("Cannot get serie ",serieId);
            return null;
        }else{
            return result[0];
        }
    }

    async getSerieIdFromEpisode(episodeId){
        var sql = "SELECT * FROM `series_episodes` AS ep, `series_seasons` AS saison"+
        " WHERE ep.id = "+episodeId+" AND ep.season_id = saison.id";
        var result = await this.query(sql);

        if(result.length == 0 ){
            console.error("Cannot get serie ",serieId);
            return null;
        }else{
            return result[0].serie_id;
        }
    }
    
    // async getSeriesWithMpd(){
    //     var sql = "SELECT * FROM `series_episodes` AS s, `series_mpd_files` AS mdp "+
    //     " WHERE mdp.complete = "+1+
    //     " AND mdp.episode_id = ";
    //     var result = await this.query(sql);

    //     if(result.length == 0 ){
    //         console.error("Cannot get serie ",serieId);
    //         return null;
    //     }else{
    //         return result[0];
    //     }
    // }

    async setMediaHasMPD(mediaId,hasMpd){
        if( (!this.checkId(mediaId))){
            console.error("setMediaHasMPD: Invalid entries ");
            return null;
        }
        var sql = "UPDATE `media` SET `has_mpd` = "+hasMpd.toString()+" WHERE `id` = "+mediaId.toString();
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async setSerieEpisodeHasMPD(episodeId,hasMpd){
        if( (!this.checkId(episodeId))){
            console.error("setSerieEpisodeHasMPD: Invalid entries ");
            return null;
        }
        var sql = "UPDATE `series_episodes` SET `has_mpd` = "+hasMpd.toString()+" WHERE `id` = "+episodeId.toString();
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
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
    async getMedia(mediaId){
        if(!this.checkId(mediaId)){
            console.error("getMedia: Invalid entries ");
            return null;
        }

        var sql = "SELECT * FROM `media` WHERE id = "+mediaId;
        var result = await this.query(sql);

        if(result.length == 0 ){
            return null;
        }else{
            return result[0];
        }
    }

    //Get all media and it's children paths
    // Note: Only child of depth 3 for now
    async getMediaRecursivePaths(mediaId){
        if(!this.checkId(mediaId)){
            console.error("getMediaRecursivePaths: Invalid entries ");
            return null;
        }

        var sql = "SELECT path FROM `media`"+
        " WHERE parent_id = "+mediaId+" OR id = "+mediaId+
        " UNION "+
        " SELECT path FROM `media`"+
        " WHERE parent_id IN (SELECT id FROM streamy.media WHERE parent_id = "+mediaId+")"
        var results = await this.query(sql);

        return results;
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

    getMediaBaseRequest(categoryId, langId, userId, withBrick){
        let sqlSelect = "SELECT "
        // let sqlSelect = "SELECT m.id, m.release_date, m.rating, m.rating_count, m.original_name "+
        //     ", m.original_language, m.brick_id, m.added_date, m.has_mpd, m.path, m.category_id ";
            
        let sqlJoins = ""
        if(categoryId){
            sqlSelect += " c.*, "
            sqlJoins += " LEFT JOIN `media_"+this.categories.get(categoryId)+"` c ON m.id = c.media_id";
        }
        if(withBrick){
            sqlSelect += " b.*, "
            sqlJoins += " LEFT JOIN `bricks` b ON m.brick_id = b.id"
        }
        if(langId){
            sqlSelect += " t.title, t.overview, "
            sqlJoins += " LEFT JOIN `media_translations` t  ON m.id = t.media_id AND t.lang_id = "+langId; //TODO don't send path to clients
        }
        if(userId){
            sqlSelect += " p.audio_lang, p.subtitle_lang, p.progression, p.last_seen, p.watched, "
            sqlJoins += " LEFT JOIN `media_progressions` p ON p.user_id = "+userId+" AND m.id = p.media_id"
        }
        sqlSelect += " m.* "
        let sqlBase = sqlSelect + " FROM `media` m " + sqlJoins
        return sqlBase
    }

    async getMediaFullList(categoryId, langCode, userId, sortKey){
        if(!this.checkId(categoryId)){
            console.error("getMedia: Invalid entries ");
            return null;
        }

        let sql = this.getMediaBaseRequest(categoryId,langCode,userId,true)
        sql += " WHERE m.category_id = "+categoryId;
        // var sql = "SELECT m.id FROM `media` m "+
        // " JOIN `media_"+this.categories.get(categoryId)+"` c ON m.id = c.media_id"+
        // " JOIN `bricks` b ON m.brick_id = b.id"+
        // " LEFT JOIN `media_translations` t  ON m.id = t.media_id AND t.lang_id = "+langCode; //TODO don't send path to clients

        // if(userId){
        //     sql += " LEFT JOIN `media_progressions` p ON p.user_id = "+userId+" AND m.id = p.media_id"
        // }
        // sql += " WHERE m.category_id = "+categoryId;

        if(sortKey){
            sql += " ORDER BY "+sortKey;
        }

        try{
            let results = await this.query(sql);
            return results;
        }catch(err){
            console.error(err);
            throw err
        }


    }

    async getMediaFull(mediaId, mediaCategoryId, langCode, userId){
        try{
            if(!this.checkId(mediaId)){
                console.error("getMedia: Invalid entries ");
                return null;
            }

            let sql = this.getMediaBaseRequest(mediaCategoryId,langCode,userId,true)
            sql += " WHERE m.id = "+mediaId;
            // var sql = "SELECT * FROM `media` m"+
            // " JOIN `media_"+this.categories.get(mediaCategoryId)+"` c ON m.id = c.media_id"+
            // " JOIN `bricks` b ON m.brick_id = b.id"+
            // " LEFT JOIN `media_translations` t  ON m.id = t.media_id AND t.lang_id = "+langCode;

            // if(userId){
            //     sql += " LEFT JOIN `media_progressions` p ON p.user_id = "+userId+" AND m.id = p.media_id"
            // }
            // sql += " WHERE m.id = "+mediaId;

            //console.log("2",sql)
            var result = await this.query(sql);

            if(result.length == 0 ){
                return null;
            }else{
                return result[0];
            }
        }catch(err){
            console.log("getMediaFull failed ",err)
            throw err
        }
    }

    async getMediaChildrenFull(mediaId,categoryId, langId, userId, sortKey){
        try{
            if(!this.checkId(mediaId)){
                console.error("getMedia: Invalid entries ");
                return null;
            }

            let sql = this.getMediaBaseRequest(categoryId,langId,userId,false)
            sql += " WHERE m.parent_id = "+mediaId;

            if(sortKey){
                sql += " ORDER BY "+sortKey;
            }

            //" JOIN `bricks` b ON m.brick_id = b.id"+
            // var sql = "SELECT * FROM `media` m "+
            // " JOIN `media_"+this.categories.get(categoryId)+"` c ON m.id = c.media_id"+
            // " LEFT JOIN `media_translations` tr  ON m.id = tr.media_id AND tr.lang_id = "+langId;

            // if(userId){
            //     sql += " LEFT JOIN `media_progressions` AS p ON p.user_id = "+userId+" AND m.id = p.media_id"
            // }
            // sql += " WHERE m.parent_id = "+mediaId;

            // if(sortKey){
            //     sql += " ORDER BY "+sortKey;
            // }

            //console.log(sql)
            let results = await this.query(sql);
            return results;

        }catch(err){
            console.log("getMediaChildrenFull failed ",err)
            throw err
        }
    }

    //For the moment, for perf reasons all children should have same category
    async getChildrenCategoryId(mediaId){
        try{
            if(!this.checkId(mediaId)){
                console.error("getMedia: Invalid entries ");
                return null;
            }

            let sql = "SELECT `category_id` FROM `media` "+
            " WHERE parent_id = "+mediaId+
            " LIMIT 1";

            let result = await this.query(sql);

            if(result.length == 0 ){
                return null;
            }else{
                return result[0].category_id;
            }
        }catch(err){
            console.error("getChildrenCategoryId failed",err)
            return null
        }
    }

    async getMediaCategory(mediaId){
        if(!this.checkId(mediaId)){
            console.error("getMedia: Invalid entries ");
            return null;
        }

        let sql = "SELECT category_id FROM `media` AS m "
        " WHERE m.id = "+mediaId;

        let result = await this.query(sql);

        if(result.length == 0 ){
            return null;
        }else{
            return result[0].category_id;
        }
    }

    async getCategories(){

        let sql = "SELECT * FROM `categories` ";

        let results = await this.query(sql);

        return results;
    }


    async getMediaTranslation(mediaId,langCode){
        if(!this.checkId(mediaId) || !this.checkId(langCode)){
            console.error("getMediaTranslation: Invalid entries ");
            return null;
        }

        var sql = "SELECT * FROM `media_translations`, `languages` WHERE media_id = "+mediaId+" AND lang_id = "+langCode;
        var result = await this.query(sql);

        if(result.length == 0 ){
            return null;
        }else{
            return result[0];
        }
    }

    async insertMediaTranslation(media_id,lang_id,title,overview){
        if( !this.checkId(media_id) || !this.checkId(lang_id)){
            console.error("insertMediaTranslation: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `media_translations` (`media_id`,`lang_id`,`title`,`overview`) "
        + " VALUES( "+media_id+", "+lang_id+", "+"'"+title.replace(/'/g,"\\'")+
        "', "+"'"+overview.replace(/'/g,"\\'")+"')";
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    // async getSerieTranslation(serieId,langCode){
    //     if(!this.checkId(serieId) || !this.checkId(langCode)){
    //         console.error("getSerieTranslation: Invalid entries ");
    //         return null;
    //     }

    //     var sql = "SELECT * FROM `series_translations`, `languages` WHERE serie_id = "+serieId+" AND series_translations.lang_id = "+langCode;
    //     var result = await this.query(sql);

    //     if(result.length == 0 ){
    //         return null;
    //     }else{
    //         return result[0];
    //     }
    // }

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

    async getMediaPath(mediaId){
        if(!this.checkId(mediaId) ){
            console.error("getMediaPath: Invalid entries ");
            return null;
        }

        var sql = "SELECT bricks.path as brick_path, media.original_name as serie_name, series.release_date as serie_release_date, season.season_number,  ep.episode_number"
        +" FROM `series_episodes` AS ep, `series_seasons` AS season, `series`, `bricks` "
        +" WHERE ep.id = "+episodeId+" and ep.season_id = season.id AND season.serie_id = series.id AND bricks.id = series.brick_id";
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results[0];
        }
    }
    // async getEpisodePath(episodeId){
    //     if(!this.checkId(episodeId) ){
    //         console.error("getEpisodePath: Invalid entries ");
    //         return null;
    //     }

    //     var sql = "SELECT bricks.path as brick_path, series.original_name as serie_name, series.release_date as serie_release_date, season.season_number,  ep.episode_number"
    //     +" FROM `series_episodes` AS ep, `series_seasons` AS season, `series`, `bricks` "
    //     +" WHERE ep.id = "+episodeId+" and ep.season_id = season.id AND season.serie_id = series.id AND bricks.id = series.brick_id";
    //     var results = await this.query(sql);

    //     if(results.length == 0 ){
    //         return null;
    //     }else{
    //         return results[0];
    //     }
    // }

    async getMdpFiles(mediaId){
        if(!this.checkId(mediaId)){
            console.error("getMdpFiles: Invalid entries ");
            return null;
        }

        var sql = "SELECT * FROM `mpd_files` AS mdp "+
        " WHERE mdp.media_id = "+mediaId;
        var results = await this.query(sql);

        return results;
    }
    // async getSeriesMdpFiles(episodeId){
    //     if(!this.checkId(episodeId)){
    //         console.error("getEpisodeStreams: Invalid entries ");
    //         return null;
    //     }

    //     var sql = "SELECT * FROM `series_mpd_files` AS mdp "+
    //     " WHERE mdp.episode_id = "+episodeId;
    //     var results = await this.query(sql);

    //     return results;
    // }

    //TODO delete when replaced
    async getSeriesLiveMdpFiles(episodeId){
        if(!this.checkId(episodeId)){
            console.error("getEpisodeStreams: Invalid entries ");
            return null;
        }

        var sql = "SELECT * FROM `series_live_mpd_files` AS mdp "+
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

    async getAudios(mdpId){
        if(!this.checkId(mdpId)){
            console.error("getAudios: Invalid entries ");
            return null;
        }

        var sql = "SELECT * FROM `mpd_audios` AS s "+
        " WHERE s.mpd_id = "+mdpId;
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results;
        }
    }  

    async getSubtitles(mdpId){
        if(!this.checkId(mdpId)){
            console.error("getSubtitles: Invalid entries ");
            return null;
        }

        var sql = "SELECT * FROM `mpd_subtitles` AS s "+
        " WHERE s.mpd_id = "+mdpId;
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results;
        }
    }   

    async getMpdFileFromMedia(mediaId,workingDir){
        if(!this.checkId(mediaId) && workingDir.length > 0 ){
            console.error("getMpdFileFromMedia: Invalid entries ");
            return null;
        }
        var sql = "SELECT * "
        +" FROM `mpd_files` as s "
        +" WHERE s.media_id = "+mediaId+" AND folder = '"+workingDir+"'";
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results[0];
        }
    }

    async getSerieMpdFileFromEpisode(episodeId,workingDir){
        if(!this.checkId(episodeId) && workingDir.length > 0 ){
            console.error("getSerieMpdFileFromEpisode: Invalid entries ");
            return null;
        }
        var sql = "SELECT * "
        +" FROM `series_mpd_files` as s , `mpd_files` as m"
        +" WHERE s.episode_id = "+episodeId+" AND s.mpd_id = m.id AND folder = '"+workingDir+"'";
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results[0];
        }
    }

    // async insertSerieMPDFile(episode_id,mpd_id){
    //     if( (!this.checkId(episode_id) || !this.checkId(mpd_id))){
    //         console.error("insertSerieMPDFile: Invalid entries ");
    //         return null;
    //     }
    //     var sql = "INSERT INTO `series_mpd_files` (`episode_id`,`mpd_id`) "
    //     + " VALUES("+episode_id+", "+mpd_id+")";
    //     var sqlres = await this.query(sql);
    //     var id = sqlres.insertId;
    //     return id;
    // }

    async insertMPDFile(media_id,folder,complete){
        if( folder.length < 0 || !this.checkId(media_id)){
            console.error("insertMPDFile: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `mpd_files` (`media_id`,`folder`,`complete`) "
        + " VALUES("+media_id+",'"+folder+"', "+complete.toString()+")";
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async setMPDFileComplete(mpd_id,complete){
        if( (!this.checkId(mpd_id))){
            console.error("setSerieMPDFileComplete: Invalid entries ");
            return null;
        }
        var sql = "UPDATE `mpd_files` SET `complete` = "+complete.toString()+" WHERE `id` = "+mpd_id.toString();
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async insertMedia(release_date,rating,rating_count,original_name,original_language,
        brickId,has_mpd,path, category_id, parent_id = null){
        if( !this.checkId(brickId)){
            console.error("insertMedia: Invalid entries ");
            return null;
        }

        try{
            var sql = "INSERT INTO `media` (`release_date`,`rating`,`rating_count`,"+
            "`original_name`,`original_language`, `brick_id`, `has_mpd`, `path`, `category_id`, `parent_id`) "+
            " VALUES ('"+release_date+"', "+rating+", "+rating_count+
            ", '"+original_name.replace(/'/g,"\\'")+
            "', '"+original_language+"', "+brickId+", "+has_mpd+', "'+path+'", '+category_id+", "+parent_id+")";

            var sqlres = await this.query(sql);
            var id = sqlres.insertId;
            return id;
        }catch(err){
            console.error("insertMedia failed, ",err)
            return null
        }
    }

    async insertVideo(mpd_id,resolution_id,user_id){
        if( (!this.checkId(mpd_id) || !this.checkId(resolution_id))){
            console.error("insertVideo: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `mpd_videos` (`mpd_id`,`resolution_id`,`user_id`) "
        + " VALUES("+mpd_id+", "+resolution_id+", "+user_id+")";
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async insertAudio(mpd_id,lang_id,lang_subtag_id,channels,user_id){
        if( (!this.checkId(mpd_id) && !this.checkId(lang_id))){
            console.error("insertAudio: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `mpd_audios` (`mpd_id`,`lang_id`,`lang_subtag_id`,`channels`,`user_id`) "
        + " VALUES("+mpd_id+", "+lang_id+", "+lang_subtag_id+", "+channels+", "+user_id+")";
        let id = null;
        try{
            var sqlres = await this.query(sql);
            id = sqlres.insertId;
        }catch(error){
            console.warn("Error inserting audio in database: "+error);
            return null;
        }
        return id;
    }

    async insertSubtitle(mpd_id,lang_id,lang_subtag_id,name,user_id){
        if( (!this.checkId(mpd_id) || !this.checkId(lang_id))){
            console.error("insertSubtitle: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `mpd_srts` (`mpd_id`,`lang_id`,`lang_subtag_id`,`name`,`user_id`) "
        + " VALUES("+mpd_id+", "+lang_id+", "+lang_subtag_id+', "'+name+'",'+user_id+')';

        let id = null;
        try{
            var sqlres = await this.query(sql);
            id = sqlres.insertId;
        }catch(error){
            console.warn("Error inserting subtitle in database: "+error);
            return null;
        }

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

    async setFilmHasMPD(filmId,hasMpd){
        if( (!this.checkId(serieId))){
            console.error("setFilmHasMPD: Invalid entries ");
            return null;
        }
        var sql = "UPDATE `films` SET `has_mpd` = "+hasMpd.toString()+" WHERE `id` = "+filmId.toString();
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async getFilmsMdpFiles(filmId){
        if(!this.checkId(filmId)){
            console.error("getFilmsMdpFiles: Invalid entries ");
            return null;
        }

        var sql = "SELECT * FROM `films_mpd_files` AS mdp "+
        " WHERE mdp.film_id = "+filmId;
        var results = await this.query(sql);

        return results;
    }

    async getFilmMpdFile(filmId,workingDir){
        if(!this.checkId(filmId) && workingDir.length > 0 ){
            console.error("getFilmMpdFile: Invalid entries ");
            return null;
        }
        var sql = "SELECT * "
        +" FROM `films_mpd_files` as s , `mpd_files` as m"
        +" WHERE s.film_id = "+episodeId+" AND s.mpd_id = m.id AND folder = '"+workingDir+"'";
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results[0];
        }
    }

    async insertFilmMPDFile(film_id,mpd_id){
        if( (!this.checkId(film_id) && folder.length > 0)){
            console.error("insertFilmMpd: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `films_mpd_files` (`film_id`,`mpd_id`) "
        + " VALUES("+episode_id+", "+mpd_id+")";
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
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

    //////////////////////////////////////////////////////
    ////////////// Media specialisations /////////////////
    //////////////////////////////////////////////////////

    async insertSerie(media_id,number_of_seasons,number_of_episodes){
        try{
            if( (!this.checkId(media_id) )){
                console.error("insertSerie: Invalid entries ");
                return null;
            }
            var sql = "INSERT INTO `media_series` (`media_id`,`number_of_seasons`,`number_of_episodes`) "+
            " VALUES ('"+media_id+"', "+number_of_seasons+", "+number_of_episodes+")";

            var sqlres = await this.query(sql);
            var id = sqlres.insertId;
            return id;
        }catch(err){
            console.error('insertSerie failed',err)
            return null;
        }
    }

    async insertSeason(media_id,season_number,number_of_episodes){
        if( !this.checkId(media_id)){
            console.error("insertSeason: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `media_seasons` (`media_id`,`season_number`,`number_of_episodes`) "+
        " VALUES ("+media_id+", "+season_number+", "+number_of_episodes+")";

        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async insertEpisode(media_id,episode_number){
        if( (!this.checkId(media_id) )){
            console.error("insertEpisode: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `media_episodes` (`media_id`,`episode_number`) "+
        " VALUES ('"+media_id+"', "+episode_number+")";

        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    //////////////////////////////////////////////////////
    ////////////// Transcoding part //////////////////////
    //////////////////////////////////////////////////////

    async insertAddFileTask(file,original_name,working_folder,media_id,user_id=null){
        if( !this.checkId(media_id) || working_folder.length == 0 || file.length == 0 ){
            console.error("insertAddFileTask: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `add_file_tasks` (`file`,`original_name`,`working_folder`,`media_id`,`user_id`) "
        + " VALUES('"+file+"', '"+original_name+"', '"+working_folder+"', "+media_id+", "+user_id+")";
        var sqlres = await this.query(sql);
        var taskId = sqlres.insertId;

        return taskId;
    }

    async insertAddFileSubTask(task_id,command,done,output){
        if( !this.checkId(task_id) || command.length == 0 ){
            console.error("insertAddSubFileTask: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `add_file_subtasks` (`task_id`,`command`,`done`,`output`) "
        + " VALUES('"+task_id+"', '"+command+"', "+done+', "'+output+'")';
        var sqlres = await this.query(sql);
        var subtaskId = sqlres.insertId;

        return subtaskId;
    }

    async getAddFileTask(fileName){
        let sql = "SELECT * FROM `add_file_tasks` WHERE file = '"+fileName+"' ORDER BY creation_time";
        let result = await this.query(sql);

        if(result.length == 0 ){
            return null;
        }else{
            return result[0];
        }
    }

    async getAddFileTaskByVideoId(episode_id,film_id){
        let sql = "SELECT * FROM `add_file_tasks` WHERE episode_id = "+episode_id+" OR film_id = "+film_id+" ORDER BY creation_time";
        let results = await this.query(sql);
        return results;
    }

    async getAddFileTasks(){
        let sql = "SELECT * FROM `add_file_tasks` ";
        let results = await this.query(sql);
        return results;
    }

    async removeAddFileTask(id){
        let sql = "DELETE FROM `add_file_tasks`  "
        + " WHERE id = "+id;
        let sqlres = await this.query(sql);
        return sqlres;
    }

    async getAddFileSubTasks(task_id){
        var sql = "SELECT * FROM `add_file_subtasks` WHERE task_id = '"+task_id+"'";
        var results = await this.query(sql);
        return results;
    }

    async setAddFileSubTaskDone(id){
        var sql = "UPDATE `add_file_subtasks`  "
        + " SET done = 1"
        + " WHERE id = "+id+"";
        var sqlres = await this.query(sql);
        return sqlres;
    }

    async removeAddFileSubTasks(task_id){
        let sql = "DELETE FROM `add_file_subtasks`  "
        + " WHERE task_id = "+task_id;
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
        var sql = "SELECT `id`, `brick_alias`, `brick_path` FROM `bricks` WHERE `id`="+brickId+"";
        var result = await this.query(sql);

        if(result.length == 0 ){
            return null;
        }else{
            return result[0];
        }
    }

    async getTranscodingResolutions(categoryId){
        var sql = "SELECT res.* FROM `"+this.categories.get(categoryId)+"_transcoding_resolutions` AS tres, `resolutions` AS res "+
        " WHERE tres.resolution_id = res.id";
        var results = await this.query(sql);
        return results;
    }

    // async getSeriesTranscodingResolutions(){
    //     var sql = "SELECT res.* FROM `series_transcoding_resolutions` AS serie_res, `resolutions` AS res "+
    //     " WHERE serie_res.resolution_id = res.id";
    //     var results = await this.query(sql);
    //     return results;
    // }

    // async getFilmsTranscodingResolutions(){
    //     var sql = "SELECT res.* FROM `films_transcoding_resolutions` AS serie_res, `resolutions` AS res "+
    //     " WHERE serie_res.resolution_id = res.id";
    //     var results = await this.query(sql);
    //     return results;
    // }

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
        try{
            var sql = "INSERT INTO `ffmpeg_workers` (`ipv4`,`port`,`enabled`) "
            + " VALUES(INET_ATON('"+ipv4+"'), "+port+", "+enabled+")";
            var sqlres = await this.query(sql);
            var id = sqlres.insertId;
            return id;
        }catch(err){
            console.warn("insertWorker failed ",err)
            return null
        }
    }

    async setWorkerEnabled(ipv4,port,enabled){
        try{
            var sql = "UPDATE `ffmpeg_workers` SET `enabled` = "+enabled.toString()+
            " WHERE `ipv4` = INET_ATON('"+ipv4+"') AND `port` = "+port;
            var sqlres = await this.query(sql);
            var id = sqlres.insertId;
            return id;
        }catch(err){
            console.warn("setWorkerEnabled failed ",err)
            return null
        }
    }

    async removeWorker(ipv4,port){
        try{
            let sql = "DELETE FROM `ffmpeg_workers` "
            + " WHERE `ipv4` = INET_ATON('"+ipv4+"') AND `port` = "+port;
            let sqlres = await this.query(sql);
            return sqlres;
        }catch(err){
            console.warn("removeWorker failed ",err)
            return null
        }
    }

    async getFfmpegWorkers(){
        var sql = "SELECT `id`, INET_NTOA(`ipv4`) as ipv4, `port`, `enabled` FROM `ffmpeg_workers` ";
        var results = await this.query(sql);
        return results; 
    } 

    checkId(id){
        if (typeof id != "number") {
            console.error('checkId: Id is not a number',id);
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