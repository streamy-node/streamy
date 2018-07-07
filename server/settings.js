class GLOBAL_SETTINGS{
    constructor(){
        this.new_video_brick = null;
        this.upload_brick = null;
    }
}
class SettingsMgr{
    constructor(con){
        this.con = con;
        this.global = new GLOBAL_SETTINGS();
        this.upload_path = null;
    }

    async pullSettings(){
        var sql = "SELECT * FROM `global_settings`";
        var result = await this.con.query(sql);

        for(var i=0; i<result.length; i++){
            if(result[i].key === "new_video_brick"){
                this.global.new_video_brick = result[i].int;
            }else if(result[i].key === "upload_brick"){
                this.global.upload_brick = result[i].int;
                var uploadBrick = await this.con.getBrick(this.global.upload_brick);
                this.upload_path = uploadBrick.path;
            }else if(result[i].key === "segment_duration"){
                this.global.segment_duration = result[i].int;
            }
        }  
    }

    getUploadPath(){
        return this.upload_path;
    }

    async updateGlobalSettings(){
        var sql_new_video_brick = "UPDATE `global_settings` SET "+
        " `new_video_brick` = "+this.db.strdb(this.global.new_video_brick)
        ;
        var sql_upload_brick = "UPDATE `global_settings` SET "+
        " `upload_brick` = "+this.db.strdb(this.global.upload_brick)
        ;

        await Promise.all([this.con.query(sql_new_video_brick),this.con.query(sql_upload_brick)]);
    }
}

module.exports=SettingsMgr