var fs = require('fs');
var moviedb = require('./moviedb.js');
var mysql = require('mysql');

class DBStructure{
    constructor(){
        this.con = null;
        this.dboptions = null;
    }

    initialize(dbOptions,onResult){
        var self = this;
        this.dboptions = dbOptions;
        this.handleDisconnect(()=>{
            // Setup dbase
            this.setup_database(function(error){
                if(error){
                    console.error("Cannot setup the db ",dbOptions,err);
                    onResult(error);
                }else{
                    onResult();
                }
            });
        },(error)=>{
            onResult(error);
        });
    }
    
    getConnection(){
        return this.con;
    }

    handleDisconnect(statuscb) {
        this.con = mysql.createConnection(this.dboptions); // Recreate the connection, since
                                                        // the old one cannot be reused.

        this.con.connect(function(err) {              // The server is either down
            if(err) {                                     // or restarting (takes a while sometimes).
                if(statuscb) statuscb(err);
                setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
            }else{
                console.log("Connected to db :)");
                if(statuscb) statuscb();
            }                                    

        });                                    

        this.con.on('error', function(err) {
            console.log('db error', err);
            if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
                handleDisconnect(statuscb);                         // lost due to either server restart, or a
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

    async getSerie(serieId){
        var sql = "SELECT * FROM `series` WHERE id = "+serieId+"";
        var result = await this.query(sql);

        if(result.length == 0 ){
            return null;
        }else{
            return result[0];
        }
    }

    async getBrick(brickId){
        var sql = "SELECT `id`, `alias`, `path` FROM `bricks` WHERE `id`="+brickId+"";
        var result = await this.query(sql);

        if(result.length == 0 ){
            return null;
        }else{
            return result[0];
        }
    }
}
module.exports=DBStructure