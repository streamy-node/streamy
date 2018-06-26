class GLOBAL_SETTINGS{
    constructor(){
    }
}
class SettingsMgr{
    constructor(con){
        this.con = con;
        this.global = new GLOBAL_SETTINGS();
    }

    async pullSettings(){
        var sql = "SELECT * FROM `global_settings`";
        var result = await this.con.query(sql);

        for(var i=0; i<result.length; i++){
            if(result[i].key === "new_video_brick"){
                this.global.new_video_brick = result[i].int;
            }
        }  
    }

    async updateGlobalSettings(){
        var sql = "UPDATE `global_settings` SET "+
        " `new_video_brick` = "+this.db.strdb(this.global.new_video_brick)
        ;
        await this.con.query(sql);
    }
}

module.exports=SettingsMgr