var fs = require('fs');
var moviedb = require('./moviedb.js');

class DBStructure{
    constructor(dbconnection){
        this.con = dbconnection;
    }

    initialize(onFinal){
        console.log("Initializing database");
        this.setup_database(onFinal);
    }

    setup_database(onFinal){
        var sql = fs.readFileSync('server/sql/init_db.sql').toString();
        this.con.query(sql, function (err, result) {

            if (err){
                if(err.errno === 1050){
                    console.log("Database already initialized");
                    if(onFinal) onFinal(null);
                }else{
                    console.log("Failed to setup db table: ",err," result: ",result);
                    if(onFinal) onFinal(err);
                }
            }else{
                console.log("DB initialized");
                if(onFinal) onFinal(null);
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