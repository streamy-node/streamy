class GLOBAL_SETTINGS{
    constructor(){
        this.new_serie_brick = null;
        this.new_film_brick = null;
    }
}
class SettingsMgr{
    constructor(con){
        this.con = con;
        this.global_settings = new GLOBAL_SETTINGS();
    }

    async pullSettings(){
        var sql = "SELECT * FROM `global_settings`";
        var result = await this.con.query(sql);

        for(var i=0; i<result.length; i++){
            if(result[i].key === "new_serie_brick"){
                this.global_settings.new_serie_brick = result[i].string;
            }else if(result[i].key === "new_film_brick"){
                this.global_settings.new_film_brick = result[i].string;
            }
        }  
    }

    async updateGlobalSettings(){
        var sql = "UPDATE `global_settings` SET "+
        " `new_serie_brick` = "+this.db.strdb(this.global_settings.new_serie_brick)+
        ", `new_film_brick` = "+this.db.strdb(this.global_settings.new_film_brick)
        ;
        await this.con.query(sql);
    }
}

module.exports=SettingsMgr