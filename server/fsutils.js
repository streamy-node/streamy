var fs = require('fs');
var mkdirp_ = require('mkdirp');
var readline = require('readline');
var stream = require('stream');

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

    async readPart(file,from,count){
        return new Promise((resolve, reject) => {
            fs.open(file, 'r', function(status, fd) {
                if (status) {
                    console.error(status.message);
                    resolve(null);
                }
                var buffer = new Buffer(count);
                fs.read(fd, buffer, 0, count, from, function(err, num) {
                    resolve(buffer);
                });
            });
        });
    }
     

    readLargeFileByLine(filePath,onLine,onClose){
        var instream = fs.createReadStream(filePath);
        var outstream = new stream;
        var rl = readline.createInterface(instream, outstream);
        rl.on('line', onLine);
        rl.on('close', onClose);
    }

    readLargeFileByLine2(filePath,from,onLine,onClose){
        var data = '';
        var absoluteIndex = from;
        try{
            var readStream = fs.createReadStream(filePath, { start: from, encoding: 'utf8' });
            readStream.on('data', function(chunk) {  
                data += chunk;
                var lineIndex = data.indexOf('\n');
                while(lineIndex>=0){
                    onLine(data.substr(0,lineIndex+1),absoluteIndex);
                    absoluteIndex += lineIndex+1;
                    data = data.slice(lineIndex+1);
                    lineIndex = data.indexOf('\n');
                }
                
            }).on('end', function() {
                if(data.length > 0){
                    onLine(data,absoluteIndex);
                }
                onClose();
            });
        }catch(err){
            
        }
    }

    async indexOfLargeFile(filePath,from,chain){
        return new Promise((resolve, reject) => {
            var data = '';
            var absoluteIndex = 0;
            var readStream = fs.createReadStream(filePath, { start: from, encoding: 'utf8' });
            readStream.on('data', function(chunk) {  
                data += chunk;
                var index = data.indexOf(chain);
                if(index>=0){
                    readStream.close();
                    resolve(absoluteIndex+index);
                }else{
                    data = data.slice(data.length-chain.length);
                    absoluteIndex += data.length-chain.length;
                }                
            }).on('end', function() {
                resolve(null);
            });
        });
    }

    match(txt,list){
        var firstIndex = null;
        for(var i=0; i<list.length; i++){
            var index = txt.indexOf(list[i]);
            if(index < 0){
                return -1;
            }else{
                if(firstIndex === null || index<firstIndex){
                    firstIndex = index;
                }
            }
        }
        return firstIndex;
    }

    async getLineWithLargeFile(filePath,from,matchingList){
        return new Promise((resolve, reject) => {
            var self = this;
            var data = '';
            var absoluteIndex = 0;
            var readStream = fs.createReadStream(filePath, { start: from, encoding: 'utf8' });
            readStream.on('data', function(chunk) {  
                data += chunk;
                var index = self.match(data,matchingList);
                if(index>=0){
                    var endlineIndex = data.indexOf('\n',index);
                    var startlineIndex = data.lastIndexOf('\n',index);
                    if( (startlineIndex > 0 || absoluteIndex===0) && endlineIndex > 0){
                        readStream.close();
                        var output = {};
                        output.line = data.substr(startlineIndex,endlineIndex-startlineIndex);
                        output.lineIndex = absoluteIndex+startlineIndex;
                        resolve(output);
                    }
                }else{
                    var lastLineIndex = data.lastIndexOf('\n');
                    if(lastLineIndex > 0){
                        data = data.slice(lastLineIndex);
                        absoluteIndex += lastLineIndex;
                    }
                }                
            }).on('end', function() {
                resolve(null);
            });
        });
    }

    async findLargeFile(filePath,searchValue){
        return new Promise((resolve, reject) => {
            readLargeFileByLine2(filePath,function(line,index){
                line.in
            },function(){
                resolve(null);
            })
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

    async writeAt(file,data,offset,erase=true){
        return new Promise((resolve, reject) => {
            var wstream = fs.createWriteStream(file, {flags: "r+"});
            wstream.on('finish', function () {
                resolve(true);
            });

            wstream.pos = offset;
            wstream.write(data,{encoding:'utf8'});
            wstream.end();

            // var foo = fs.open(file,'w+',function(err, fd){
            //     if (err) {
            //         if (err.code === 'EEXIST') {
            //             console.error('myfile already exists');
            //             return;
            //         }
            //         reject(err);
            //     }
            //     fs.write(file,)
            // });
            // fs.write(fd, data, offset, 'utf8', function(err,));
            // fs.close(foo);
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

    async readir(dir){
        return new Promise((resolve, reject) => {
        fs.readdir(dir, (err, files) => {
                if(err) reject(err);
                resolve(files);
            });
        });
    }

    async rename(oldPath,newPath){
        return new Promise((resolve, reject) => {
            fs.rename(oldPath, newPath, function (err) {
                if (err) {
                    if (err.code === 'EXDEV') {
                        reject(err);//Make a copy?
                    } else {
                        reject(err);
                    }
                }
                resolve();
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