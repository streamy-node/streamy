var fs = require('fs');
var mkdirp_ = require('mkdirp');

class FSUtils{
    async mkdirp(path){
        return new Promise((resolve, reject) => {
            mkdirp_(path, function (err) {
                if (err){
                    console.error("FSUtils.mkdirp: ",err);
                    reject();
                } 
                else resolve()
            });
        });
    }
    
    async exists(file){
        return new Promise((resolve, reject) => {
            fs.stat(file, function(err, stat) {
                if(err == null) {
                    resolve(true);
                } else if(err.code == 'ENOENT') {
                    // file does not exist
                    resolve(false);
                } else {
                    console.error('FSUtils.exists: error: ', err.code);
                    reject(err);
                }
            });   
        });
    }

    async read(file){
        return new Promise((resolve, reject) => {
            fs.readFile(file, 'utf8', function (err, data) {
                if (err) reject(err);
                resolve(data);
            });
        });
    }

    async write(file, data){
        return new Promise((resolve, reject) => {
            fs.writeFile(file, JSON.stringify(data), function(err) {
                if(err) {
                    console.log(err);
                    reject(err);
                }else{
                    resolve(true);
                }
            
                console.log("The file was saved!");
            });
        });
    }

    async unlink(file){
        return new Promise((resolve, reject) => {
            fs.unlink(file, (err) => {
                if(err) {
                    console.log(err);
                    reject(err);
                }else{
                    resolve(true);
                }
            });
        });
    }

    async appendJson(file,obj){
        try{
            //If file exists load if
            var oldJson = null;
            var newObj = null;
            if(await this.exists(file)){
                var oldBytes = await this.read(file);
                if(oldBytes.length > 0){
                    oldJson = JSON.parse(oldBytes);
                    newObj = Object.assign(obj, oldJson);
                }
            }else{
                newObj = obj;
            }

            if(newObj == null){
                return false;
            }

            await this.write(file,newObj);
            return true;
        }catch(err){
            console.log("FS error appendJson failed ",err);
            return false;
        }
    }
}


module.exports=new FSUtils();