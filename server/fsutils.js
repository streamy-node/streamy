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
}


module.exports=new FSUtils();