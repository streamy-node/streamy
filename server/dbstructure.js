var fs = require('fs');

class DBStructure{
    constructor(dbconnection){
        this.dbconnection = dbconnection;
    }

    initialize(){
        console.log("Initializing database");
        this.setup_database();
    }

    setup_database(onFinal){
        var sql = fs.readFileSync('server/sql/init_db.sql').toString();
        this.dbconnection.query(sql, function (err, result) {

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
}
module.exports=DBStructure