var fs = require('fs');
//var moviedb = require('./moviedb.js');
const EventEmitter = require('events');
var mysql = require('mysql');

class DBStructure extends EventEmitter{
    constructor(){
        super();
        this.con = null;
        this.dboptions = null;
        this.langs = new Map();
        this.categories = new Map();

        this.checkOrderBySet = new Set(["", "release_date", "added_date"]);
    }

    /////////// Utils //////////
    checkId(id){
        if (typeof id != "number") {
            console.error('checkId: Id is not a number',id);
            return false;
        }
        return true;
    }

    checkString(val,valsset){
        return valsset.has(val)
    }
    

    checkLangCode(langCode){
        if(langCode.length != 2){
            console.error("checkLangCode: Invalid lang code provided, "+langCode,langCode.length);
            return false;
        }
        return true;
    }

    async initialize(pool){
        if(!await this.createDatabase(pool.config.connectionConfig)){
            console.error("Cannot create the db :'(");
            return false;
        }
        this.con = pool;
        if(!await this.setup_database(pool)){
            console.error("Cannot setup the db :'(");
            return false;
        }
        this._cacheStaticData();
        return true;
           
    }

    async createDatabase(originalConf){
        //Create an independant connection at first then use pool
        let connection = mysql.createConnection({
            host: originalConf.hostname,
            port: originalConf.port,
            user: originalConf.user,
            password: originalConf.password,
            multipleStatements: true
        });

        try{
            let sql = "CREATE DATABASE `"+originalConf.database+"`;"
            await this._query(sql,connection);
            connection.end(function(){});
            console.log("Database "+originalConf.database+" created");
            return true;
        }catch(err){
            connection.end(function(){});
            if(err.errno === 1007){ //DB already exists
                console.log("Database "+originalConf.database+" already created");
                return true;
            }else{
                console.log("Failed to create db table: "+originalConf.database,err);
                return false;
            }
        }

        //let result = await this.setup_database(connection);
        //if(result){
        //    connection.end(function(){});
        //}
        //return result;
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
            if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
                self.handleDisconnect(statuscb);                         // lost due to either server restart, or a
            } else {                                     // connnection idle timeout (the wait_timeout
                console.error("DB error")
                throw err;                                  // server variable configures this)
            }
        });
    }

    async setup_database(connection){
        //If the database is available, create tables if necessary
        var sql = fs.readFileSync('server/sql/init_db.sql').toString();
        try{
            await this._query(sql,connection);
            console.log("Database tables initialized");
            return true;
        }catch(err){
            if(err.errno === 1050 ||//Table already exists
                err.errno === 1007){ //DB already exists
                console.log("Database tables already initialized");
                return true;
            }else{
                console.log("Failed to setup db table: ",err);
                return false;
            }
        }
    };

    strdb(str){
        if(str === NULL){
            return "NULL"
        }else{
            return "'"+str.replace(/'/g,"\\'")+"'";
        }
    }

    // async _import_genres(){ //TODO
    //     let tmdbMovieGenres = await moviedb.genreMovieList({"language":"en-US"});
    //     let tmdbSerieGenres = await moviedb.genreTvList({"language":"en-US"});
    //     for(var i=0; i<tmdbMovieGenres.length; i++){
    //         //let tvdbGenre = tmdbMovieGenres[i];
    //     }
    // }

    async query(sql){
        return await this._query(sql,this.con);
    }

    _query(sql,connection){
        return new Promise((resolve, reject) => {
            connection.query(sql, function (err, result) {
                if (err) {
                    //console.error("DB error: ",sql,err);
                    reject(err);
                }
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

    async getLangFromIso639_2(langCode){
        var sql = "SELECT languages.* FROM `languages`,`languages_iso_639_2` WHERE languages.id = languages_iso_639_2.language_id AND iso_639_2 = '"+langCode+"'";
        var result = await this.query(sql);

        if(result.length == 0 ){
            console.error("Cannot get lang from 639_2 norme ",langCode);
            return null;
        }else{
            return result[0];
        }
    }

    async getLangFromIso_639_1(langCode){
        var sql = "SELECT * FROM `languages` WHERE iso_639_1 = '"+langCode+"'";
        var result = await this.query(sql);

        if(result.length == 0 ){
            console.error("Cannot get lang from iso_639_1 norme ",langCode);
            return null;
        }else{
            return result[0];
        }
    }

    async getLangFromString(langStr){
        let lang = null;
        if(!langStr){
            return null;
        }
        if(langStr.length == 3){
            lang = await this.getLangFromIso639_2(langStr);
            // if(!langInfos){
            //     console.error("Unknown lang code ",langStr);
            // }else{
            //     lang = langInfos;getBrick
            // }
        }else if(langStr.length == 2){
            lang = await this.getLangFromIso_639_1(langStr);
        }
        return lang;
    }
    

    getLangsId(langCode){
        return this.langs[langCode];
    }

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

    async getMediaCategoryOnBrick(category_id,brickId){
        var sql = "SELECT * FROM `media`"+
            " WHERE category_id = "+category_id+" AND brick_id = "+brickId;
        var results = await this.query(sql);

        return results;
    }

    async getMediaUsingMpdOnBrick(brickId){
        var sql = "SELECT * FROM `media`"+
            " WHERE use_mpd = 1 AND brick_id = "+brickId;
        var results = await this.query(sql);

        return results;
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
        " WHERE parent_id IN (SELECT id FROM media WHERE parent_id = "+mediaId+")"
        var results = await this.query(sql);

        return results;
    }

    //Get all media and it's children paths
    // Note: Only child of depth 3 for now
    async getChildChildren(mediaId){
        if(!this.checkId(mediaId)){
            console.error("getChildChildrenIds: Invalid entries ");
            return null;
        }

        var sql = " SELECT * FROM `media`"+
        " WHERE parent_id IN (SELECT id FROM media WHERE parent_id = "+mediaId+")"
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

    async getMediaFullList(categoryId, langCode, userId, sortKey, ascending, count, offset, pattern){
        if(!this.checkId(categoryId) && this.checkOrderBySet(sortKey,this.checkOrderBySet)){
            console.error("getMedia: Invalid entries ");
            return null;
        }

        let sql = this.getMediaBaseRequest(categoryId,langCode,userId,true)
        sql += " WHERE m.category_id = "+categoryId;

        if(pattern){
            sql += " AND t.title LIKE "+mysql.escape("%"+pattern+"%")
        }
        
        if(sortKey){
            sql += " ORDER BY `"+sortKey+"`";
            if(!ascending){
                sql += " DESC";
            }
        }

        if(!isNaN(count) && count > 0){
            sql += " LIMIT " + count

            if(!isNaN(offset) && offset > 0 ){
                sql += " OFFSET " + offset
            }
        }

        

        // var sql = "SELECT m.id FROM `media` m "+
        // " JOIN `media_"+this.categories.get(categoryId)+"` c ON m.id = c.media_id"+
        // " JOIN `bricks` b ON m.brick_id = b.id"+
        // " LEFT JOIN `media_translations` t  ON m.id = t.media_id AND t.lang_id = "+langCode; //TODO don't send path to clients

        // if(userId){
        //     sql += " LEFT JOIN `media_progressions` p ON p.user_id = "+userId+" AND m.id = p.media_id"
        // }
        // sql += " WHERE m.category_id = "+categoryId;

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
        if(!this.checkId(mediaId)){
            console.error("getMedia: Invalid entries ");
            return null;
        }

        let sql = this.getMediaBaseRequest(categoryId,langId,userId,false)
        sql += " WHERE m.parent_id = "+mediaId;

        if(sortKey){
            sql += " ORDER BY "+sortKey;
        }

        try{
            let results = await this.query(sql);
            return results;

        }catch(err){
            console.log("getMediaChildrenFull failed ",sql,err)
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

    async updateMediaTranslation(media_id,lang_id,title,overview){
        if( !this.checkId(media_id) || !this.checkId(lang_id)){
            console.error("insertMediaTranslation: Invalid entries ");
            return null;
        }
        var sql = "UPDATE `media_translations` "
        + " SET `title`='"+title.replace(/'/g,"\\'")+"', "
        +" `overview`='"+overview.replace(/'/g,"\\'")+"'"
        + " WHERE `media_id`="+media_id+" AND `lang_id`="+lang_id;

        var sqlres = await this.query(sql);
        var id = sqlres;
        return id;
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

    async findSerieFromMoviedbId(movieDBId){
        if(!this.checkId(movieDBId)){
            return null;
        }
        var sql = "SELECT media_id FROM series_moviedb "+
        " WHERE moviedb_id="+movieDBId;
        let result = await this.query(sql);
        if(result.length > 0){
            return result[0].media_id;
        }else{
            return null;
        }
    }

    async findMoviedbIdFromSerie(serieId){
        if(!this.checkId(serieId)){
            return null;
        }
        var sql = "SELECT moviedb_id FROM series_moviedb "+
        " WHERE media_id="+serieId;
        let result = await this.query(sql);
        if(result.length > 0){
            return result[0].moviedb_id;
        }else{
            return null;
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

    async getMpdIdFromMedia(mediaId,workingDir){
        if(!this.checkId(mediaId) && workingDir.length > 0 ){
            console.error("getMpdIdFromMedia: Invalid entries ");
            return null;
        }
        var sql = "SELECT id "
        +" FROM `mpd_files` as s "
        +" WHERE s.media_id = "+mediaId+" AND folder = '"+workingDir+"'";
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results[0].id;
        }
    }

    async getMpdFile(mpdId){
        if(!this.checkId(mpdId) ){
            console.error("getMpdFile: Invalid entries ");
            return null;
        }
        var sql = "SELECT * "
        +" FROM `mpd_files` as s "
        +" WHERE s.id = "+mpdId;
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results[0];
        }
    }

    async removeMpdFile(mpdId){
        if(!this.checkId(mpdId) ){
            console.error("removeMpdFile: Invalid entries ");
            return null;
        }
        let sql = "DELETE FROM `mpd_files`  "
        + " WHERE id = "+mpdId;
        let sqlres = await this.query(sql);
        return sqlres;
    }

    async removeMpdFromMedia(mediaId, folder){
        if(!this.checkId(mediaId) && folder.length > 0){
            console.error("removeMpdFromMedia: Invalid entries ");
            return null;
        }
        let sql = "DELETE FROM `mpd_files`  "
        + " WHERE media_id = "+mediaId+' AND folder = "'+folder+'"';
        let sqlres = await this.query(sql);
        return sqlres;
    }

    // async getSerieMpdFileFromEpisode(episodeId,workingDir){
    //     if(!this.checkId(episodeId) && workingDir.length > 0 ){
    //         console.error("getSerieMpdFileFromEpisode: Invalid entries ");
    //         return null;
    //     }
    //     var sql = "SELECT * "
    //     +" FROM `series_mpd_files` as s , `mpd_files` as m"
    //     +" WHERE s.episode_id = "+episodeId+" AND s.mpd_id = m.id AND folder = '"+workingDir+"'";
    //     var results = await this.query(sql);

    //     if(results.length == 0 ){
    //         return null;
    //     }else{
    //         return results[0];
    //     }
    // }


    async insertMPDFile(media_id,folder,complete, userId = null){
        if( folder.length < 0 || !this.checkId(media_id)){
            console.error("insertMPDFile: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `mpd_files` (`media_id`,`folder`,`complete`,`user_id`) "
        + " VALUES("+media_id+",'"+folder+"', "+complete.toString()+", "+userId+")";
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

    async insertMedia(release_date,rating,rating_count,original_name,original_language,easy_name,
        brickId,has_mpd,use_mpd,path, category_id, parent_id = null){
        if( !this.checkId(brickId)){
            console.error("insertMedia: Invalid entries ");
            return null;
        }

        try{
            var sql = "INSERT INTO `media` (`release_date`,`rating`,`rating_count`,"+
            "`original_name`,`original_language`, `easy_name`, `brick_id`, `has_mpd`,`use_mpd`, `path`, `category_id`, `parent_id`) "+
            " VALUES ('"+release_date+"', "+rating+", "+rating_count+
            ', "'+original_name.replace(/'/g,"\\'")+
            '", "'+original_language+'", "'+easy_name.replace(/'/g,"\\'")+'", '+brickId+", "+has_mpd+", "+use_mpd+', "'+path+'", '+category_id+", "+parent_id+")";

            var sqlres = await this.query(sql);
            var id = sqlres.insertId;
            return id;
        }catch(err){
            console.error("insertMedia failed, ",err)
            return null
        }
    }

    async insertVideo(mpd_id,resolution_id){
        if( (!this.checkId(mpd_id) || !this.checkId(resolution_id))){
            console.error("insertVideo: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `mpd_videos` (`mpd_id`,`resolution_id`) "
        + " VALUES("+mpd_id+", "+resolution_id+")";
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async removeMpdVideosInfos(mpd_id){
        if( (!this.checkId(mpd_id))){
            console.error("removeMpdVideosInfos: Invalid entries ",mpd_id);
            return null;
        }
        var sql = "DELETE FROM `mpd_videos` "
        + " WHERE mpd_id = "+mpd_id+"";
        var sqlres = await this.query(sql);
        return sqlres;
    }

    async insertAudio(mpd_id,lang_id,lang_subtag_id,channels){
        if( (!this.checkId(mpd_id) && !this.checkId(lang_id))){
            console.error("insertAudio: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `mpd_audios` (`mpd_id`,`lang_id`,`lang_subtag_id`,`channels`) "
        + " VALUES("+mpd_id+", "+lang_id+", "+lang_subtag_id+", "+channels+")";
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

    async removeMpdAudioInfos(mpd_id){
        if( (!this.checkId(mpd_id))){
            console.error("removeMpdAudioInfos: Invalid entries ");
            return null;
        }
        var sql = "DELETE FROM `mpd_audios` "
        + " WHERE mpd_id = "+mpd_id+"";
        var sqlres = await this.query(sql);
        return sqlres;
    }

    async insertSubtitle(mpd_id,lang_id,lang_subtag_id){
        if( (!this.checkId(mpd_id))){
            console.error("insertSubtitle: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `mpd_srts` (`mpd_id`,`lang_id`,`lang_subtag_id`) "
        + " VALUES("+mpd_id+", "+lang_id+", "+lang_subtag_id+")";

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

    async removeMpdSubtitleInfos(mpd_id){
        if( (!this.checkId(mpd_id))){
            console.error("removeMpdSubtitleInfos: Invalid entries ");
            return null;
        }
        var sql = "DELETE FROM `mpd_srts` "
        + " WHERE mpd_id = "+mpd_id+"";
        var sqlres = await this.query(sql);
        return sqlres;
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

    async updateSerie(media_id,number_of_seasons,number_of_episodes){
        try{
            if( (!this.checkId(media_id) )){
                console.error("updateSerie: Invalid entries ");
                return null;
            }
            var sql = "UPDATE `media_series`"+
            " SET `number_of_seasons`="+number_of_seasons+", `number_of_episodes`="+number_of_episodes+""+
            " WHERE `media_id` = "+media_id
            var sqlres = await this.query(sql);
            var id = sqlres;
            return id;
        }catch(err){
            console.error('updateSerie failed'+media_id,err)
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

    async updateSeason(media_id,season_number,number_of_episodes){
        if( !this.checkId(media_id)){
            console.error("updateSeason: Invalid entries ");
            return null;
        }
        var sql = "UPDATE `media_seasons`"+
        " SET `number_of_episodes`="+number_of_episodes+
        " WHERE `media_id`="+media_id+" AND `season_number`="+season_number;

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
        " VALUES ("+media_id+", "+episode_number+")";

        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async getEpisodeId(serieId,seasonNumber,episodeNumber){
        if(!this.checkId(serieId)){
            console.error("getEpisodeId: Invalid entries ");
            return null;
        }
        var sql = "SELECT mepisode.id "+
        "FROM media as mserie, media as mseason, media as mepisode, media_seasons as season, media_episodes as episode"
        +" WHERE mserie.id = " +serieId 
        +" AND mserie.id = mseason.parent_id AND mseason.id = season.media_id AND  season.season_number ="+ seasonNumber
        +" AND mseason.id = mepisode.parent_id AND mepisode.id = episode.media_id AND  episode.episode_number = "+ episodeNumber

        var results = await this.query(sql);
        if(results.length == 0 ){
            return null;
        }else{
            return results[0].id;
        }
    }

    async insertMovie(media_id){
        try{
            if( (!this.checkId(media_id) )){
                console.error("insertMovie: Invalid entries ");
                return null;
            }
            var sql = "INSERT INTO `media_movies` (`media_id`) "+
            " VALUES ("+media_id+")";

            var sqlres = await this.query(sql);
            var id = sqlres.insertId;
            return id;
        }catch(err){
            console.error('insertMovie failed',err)
            return null;
        }
    }

    //////////////////////////////////////////////////////
    ////////////// Transcoding part //////////////////////
    //////////////////////////////////////////////////////

    async insertAddFileTask(file,brick_id,original_name,working_folder,media_id,user_id=null){
        if( !this.checkId(media_id) || !this.checkId(brick_id) || working_folder.length == 0 || file.length == 0 ){
            console.error("insertAddFileTask: Invalid entries ");
            return null;
        }
        var sql = "INSERT INTO `add_file_tasks` (`file`,`brick_id`,`original_name`,`working_folder`,`media_id`,`user_id`) "
        + " VALUES('"+file+"', '"+brick_id+"', '"+original_name.replace(/'/g,"\\'")+"', '"+working_folder+"', "+media_id+", "+user_id+")";
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
        + " VALUES("+task_id+", '"+command.replace(/'/g,"\\'")+"', "+done+", '"+output.replace(/'/g,"\\'")+"')";
        var sqlres = await this.query(sql);
        var subtaskId = sqlres.insertId;

        return subtaskId;
    }

    async getAddFileTaskByFilename(fileName){
        let sql = "SELECT * FROM `add_file_tasks` WHERE file = '"+fileName+"' ORDER BY creation_time";
        let result = await this.query(sql);

        if(result.length == 0 ){
            return null;
        }else{
            return result[0];
        }
    }

    async getAddFileTask(id){
        if( !this.checkId(id) ){
            console.error("getAddFileTask: Invalid entries ");
            return null;
        }

        let sql = "SELECT * FROM `add_file_tasks` WHERE id = "+id+"";
        let result = await this.query(sql);

        if(result.length == 0 ){
            return null;
        }else{
            return result[0];
        }
    }

    async getAddFileTasks(){
        let sql = "SELECT * FROM `add_file_tasks` ";
        sql += " ORDER BY `creation_time`";
        let results = await this.query(sql);
        return results;
    }

    async setAddFileTaskStopped(id,stopped){
        let _stopped = stopped ? 1 : 0;
        var sql = "UPDATE `add_file_tasks`  "
        + " SET stopped = "+_stopped
        + " WHERE id = "+id+"";
        var sqlres = await this.query(sql);
        return sqlres;
    }

    async setAddFileTaskStoppedByFile(file,stopped){
        let sql = "";
        try{
            let _stopped = stopped ? 1 : 0;
            sql = "UPDATE `add_file_tasks`  "
            + " SET `stopped` = "+_stopped
            + " WHERE file = '"+file+"'";
            var sqlres = await this.query(sql);
            return sqlres;
        }catch(err){
            console.warn("Cannot stop file ",err,sql)
            return null;
        }
    }

    async setAddFileTaskHasErrorByFile(file,has_error,msg){
        try{
            let _stopped = stopped ? 1 : 0;
            var sql = "UPDATE `add_file_tasks`  "
            + " SET had_error = "+has_error
            +", msg = '"+msg+"'"
            + " WHERE file = '"+file+"'";
            var sqlres = await this.query(sql);
            return sqlres;
        }catch(err){
            console.warn("Cannot stop file ",err)
            return null;
        }
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


    ///////////// Brick /////////////////////
    async getBrick(brickId){
        var sql = "SELECT * FROM `bricks` WHERE `id`="+brickId+"";
        var result = await this.query(sql);

        if(result.length == 0 ){
            return null;
        }else{
            return result[0];
        }
    }

    async getBricks(){
        var sql = "SELECT * FROM `bricks`";
        var results = await this.query(sql);
        return results;
    }

    async getBrickByAlias(alias){
        var sql = "SELECT * FROM `bricks` WHERE `brick_alias`="+alias+"";
        var result = await this.query(sql);

        if(result.length == 0 ){
            return null;
        }else{
            return result[0];
        }
    }

    async getBrickByPath(brick_path){
        var sql = "SELECT * FROM `bricks` WHERE `brick_path`="+brick_path+"";
        var result = await this.query(sql);

        if(result.length == 0 ){
            return null;
        }else{
            return result[0];
        }
    }

    async getBrickByAliasOrPath(brick_path,alias){
        var sql = 'SELECT * FROM `bricks` WHERE `brick_path`="'+brick_path+'" or `brick_alias`="'+alias+'"';
        var result = await this.query(sql);

        if(result.length == 0 ){
            return null;
        }else{
            return result[0];
        }
    }

    async insertBrick(brick_alias,brick_path,enabled = 1){
        if( brick_alias.length == 0 || brick_path.length == 0){
            console.error("insertBrick: Invalid entries ");
            throw new Error("Invalid entries alias:"+brick_alias+" path:"+brick_path)
        }
        var sql = "INSERT INTO `bricks` (`brick_alias`,`brick_path`,`enabled`) "
        + ' VALUES( "'+brick_alias+'", "'+brick_path+'", '+enabled+")";
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async updateBrickAlias(id,brick_alias){
        if( !this.checkId(id)){
            console.error("updateBrickAlias: Invalid entries ");
            return null;
        }
        var sql = "UPDATE `bricks` SET `brick_alias` = '"+brick_alias.replace(/'/g,"\\'")+
        "' WHERE `id` = "+id;
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async updateBrickStatus(id,enabled){
        if( !this.checkId(id) || (enabled != 0 || enabled != 1)){
            console.error("updateBrickAlias: Invalid entries ");
            return null;
        }
        var sql = "UPDATE `bricks` SET `enabled` = "+enabled+
        " WHERE `id` = "+id;
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async updateBrickPath(id,path){
        if( !this.checkId(id)){
            console.error("updateBrickAlias: Invalid entries ");
            return null;
        }
        var sql = "UPDATE `bricks` SET `brick_path` = '"+path.replace(/'/g,"\\'")+
        "' WHERE `id` = "+id;
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async deleteBrick(id){
        if( !this.checkId(id)){
            console.error("deleteBrick: Invalid entries ");
            throw new Error("invalid entry id")
        }
        let sql = "DELETE FROM `bricks` "
        + " WHERE `id` = "+id;
        let sqlres = await this.query(sql);
        return sqlres;
    }

    async getTranscodingResolutions(categoryId){
        var sql = "SELECT res.* FROM `"+this.categories.get(categoryId)+"_transcoding_resolutions` AS tres, `resolutions` AS res "+
        " WHERE tres.resolution_id = res.id";
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

    ////////////// Settings ///////////////////
    async updateGlobalSettingString(key,value){
        var sql = "UPDATE `global_settings` SET `string` = '"+value.replace(/'/g,"\\'")+
        "' WHERE `key` = '"+key+"'";
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async updateGlobalSettingInt(key,value){
        var sql = "UPDATE `global_settings` SET `int` = "+value+
        " WHERE `key` = '"+key+"'";
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }


    ////////////// User DB ////////////////////
    async insertUser(username, password, roleId, qosPriority, email, phone = ""){
        var sql = "INSERT INTO `users` (`username`,`password`,`role_id`,`qos_priority`,`email`,`phone`) "
            + " VALUES( "
            +"'"+username.replace(/'/g,"\\'")+"'"
            +", '"+password.replace(/'/g,"\\'")+"'"
            +", "+roleId
            +", "+qosPriority
            +", '"+email.replace(/'/g,"\\'")+"'"
            +", '"+phone.replace(/'/g,"\\'")+"'"
            +")";

        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }

    async getUserPasswordByName(username){
        var sql = "SELECT password FROM `users` "+
        " WHERE username = '"+username.replace(/'/g,"\\'")+"'";
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results[0].password;
        }
    }

    async getUserPassword(userId){
        var sql = "SELECT password FROM `users` "+
        " WHERE id = "+userId+"";
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results[0].password;
        }
    }

    async getUserPermissions(userId){
        var sql = "SELECT p.name FROM `permissions` p, `users`, `roles_permissions` rp "
         + " WHERE users.id = "+userId+""
         + " AND users.role_id = rp.role_id AND rp.permission_id = p.id";
         return await this.query(sql);
    }

    async getUser(userId){
        var sql = "SELECT * FROM `users` "+
        " WHERE id = "+userId+"";
        var results = await this.query(sql);
        if(results.length == 0 ){
            return null;
        }else{
            return results[0];
        }
    }

    async getUsers(){
        let sql = "SELECT * FROM `users` ";
        let results = await this.query(sql);
        return results;
    }

    async getUsersExplicit(){
        let sql = "SELECT users.*, roles.name as role_name "+
        " FROM `users`, `roles` "+
        " WHERE roles.id = users.role_id";
        let results = await this.query(sql);
        return results;
    }

    async getUserId(username){
        let sql = "SELECT id FROM `users` "+
        " WHERE username = '"+username.replace(/'/g,"\\'")+"'";
        let results = await this.query(sql);
        if(results.length == 0 ){
            return null;
        }else{
            return results[0].id;
        }
    }

    async updateUserPassword(id, password){
        if( !this.checkId(id)){
            console.error("updateUserPassword: Invalid entries ");
            return null;
        }

        var sql = "UPDATE `users` SET `password` = '"+password.replace(/'/g,"\\'")+
        "' WHERE `id` = "+id;
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }    
    
    async updateUserName(id, name){
        if( !this.checkId(id)){
            console.error("updateUserName: Invalid entries ");
            return null;
        }
        try{
            var sql = "UPDATE `users` SET `username` = "+name+
            " WHERE `id` = "+id;
            var sqlres = await this.query(sql);
            var id = sqlres.insertId;
            return id;
        }catch(err){
            console.warn("updateUserName failed ",err)
            return null
        }
    }

    async updateUserRole(id, roleId){
        if( !this.checkId(id) || !this.checkId(roleId)){
            console.error("updateUserRole: Invalid entries ");
            return null;
        }
        try{
            var sql = "UPDATE `users` SET `role_id` = "+roleId+
            " WHERE `id` = "+id;
            var sqlres = await this.query(sql);
            var id = sqlres.insertId;
            return id;
        }catch(err){
            console.warn("updateUserRole failed ",err)
            return null
        }
    }

    async updateUserLastConnection(id){
        if( !this.checkId(id)){
            console.error("updateUserPassword: Invalid entries ");
            return null;
        }

        var sql = "UPDATE `users` SET `last_connection` = CURTIME()"+
        " WHERE `id` = "+id;
        var sqlres = await this.query(sql);
        var id = sqlres.insertId;
        return id;
    }   

    async deleteUser(id){
        if( !this.checkId(id)){
            console.error("deleteUser: Invalid entries ");
            return null;
        }
        try{
            let sql = "DELETE FROM `users` "
            + " WHERE `id` = "+id;
            let sqlres = await this.query(sql);
            return sqlres;
        }catch(err){
            console.warn("deleteUser failed ",err)
            return null
        }
    }

    async getRoleIdByName(roleName){
        var sql = "SELECT id FROM `roles` "+
        " WHERE name = '"+roleName.replace(/'/g,"\\'")+"'";
        var results = await this.query(sql);

        if(results.length == 0 ){
            return null;
        }else{
            return results[0].id;
        }
    }
    

    async getFfmpegWorkers(){
        var sql = "SELECT `id`, INET_NTOA(`ipv4`) as ipv4, `port`, `enabled` FROM `ffmpeg_workers` ";
        var results = await this.query(sql);
        return results; 
    } 

}
module.exports=DBStructure