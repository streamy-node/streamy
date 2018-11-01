var fs = require('fs');
var path = require('path');
var mkdirp_ = require('mkdirp');
var readline = require('readline');
var stream = require('stream');
const xml2js = require('xml2js');
var async = require('async');

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

    async stat(file){
        return new Promise((resolve, reject) => {
            fs.stat(file, function(err, stat) {
                if(err){
                    reject(err);   
                }else{
                    resolve(stat);
                }
            });   
        });
    }
    
    async exists(file){
        try{
            let result = await this.stat(file);
            return result;
        }catch(err){
            if(err.code == 'ENOENT') {
                // file does not exist
                return false;
            } else {
                console.error('FSUtils.exists: error: ', err.code);
                throw err;
            }
        }
    }

    async read(file, format = 'utf8'){
        return new Promise((resolve, reject) => {
            fs.readFile(file, format, function (err, data) {
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

    async writeJSON(file, data){
        return await write(file,JSON.stringify(data));
    }

    async write(file, data){
        return new Promise((resolve, reject) => {
            fs.writeFile(file,data, function(err) {
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
                    //console.log(err);
                    resolve(err);
                }else{
                    resolve(null);
                }
            });
        });
    }

    async unlinkFiles(files){
        
            await files.map(async file => { 
                    return await this.unlink(file) 
                })
            return true;
    }

    async rmdir(dir){
        return new Promise((resolve, reject) => {
            fs.rmdir(dir, (err) => {
                if(err) {
                    //console.log(err);
                    resolve(err);
                }else{
                    resolve(null);
                }
            });
        });
    }

    async rmdirf(dir) {
        try{
            var list = await this.readir(dir);
            for(var i = 0; i < list.length; i++) {
                var filename = path.join(dir, list[i]);
                var stat = await this.stat(filename);
                
                if(filename == "." || filename == "..") {
                    //Don't remove
                } else if(stat.isDirectory()) {
                    // rmdir recursively
                    await this.rmdir(filename);
                } else {
                    await this.unlink(filename);
                }
            }
            await this.rmdir(dir);
            return true;
        }catch(err){
            console.error("Failed to remove recursively folder "+dir,err);
            return false;
        }
    };

    async readir(dir){
        return new Promise((resolve, reject) => {
        fs.readdir(dir, (err, files) => {
                if(err) reject(err);
                resolve(files);
            });
        });
    }

    async readirPrefix(dir){
        let folderPath = path.dirname(dir);
        let prefix = path.basename(dir);
        if(prefix.length == 0){
            folderPath = dir;
        }
        let files = await this.readir(folderPath);
        let outputFiles = [];
        if(prefix.length > 0){
            files.forEach(element => {
                if(element.indexOf(prefix) == 0){
                    outputFiles.push(element)
                }
            });
        }else{
            outputFiles = files;
        }
        return outputFiles;
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

    async rmdir(folderName){
        return new Promise((resolve, reject) => {
            fs.rmdir(folderName, function (err) {
                if (err) {
                    resolve(false);
                }else{
                    resolve(true);
                }
            });
        });
    }

    async concat(files, destination){
        return new Promise(async (resolve, reject) => {
            var wstream = fs.createWriteStream(destination, {flags: "a"});
            wstream.on('finish', function () {
                resolve(true);
            });

            for(let i = 0; i<files.length; i++){
                let data = await this.read(files[i],null)
                wstream.write(data);
            }

            wstream.end();
        })
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

            await this.writeJson(file,newObj);
            return true;
        }catch(err){
            console.log("FS error appendJson failed ",err);
            return false;
        }
    }

    async parseJsonFile(fileName){
        try{
            let content = await this.read(fileName);
            return JSON.parse(content);
        }catch(err){
            return null;
        }
    }

    //xml utils
    async parseXml(stringVal){
        let parser = new xml2js.Parser();
        return new Promise((resolve, reject) => {
            parser.parseString(stringVal, function (err, result) {
                if(err){
                    console.error("Error parsing xml ");
                    reject(err);
                }else{
                    resolve(result)
                }
            });
        });
    }

    async parseXmlFile(fileName){
        let content = await this.read(fileName);
        return this.parseXml(content);
    }

    async saveAsXML(fileName, xmlObject){
        let builder = new xml2js.Builder({renderOpts:{pretty:true, newline:"\n"}});
        let xml = builder.buildObject(xmlObject);

        if(xml.length > 0){
            return await this.write(fileName,xml);
        }else{
            return false;
        }
    }



}


module.exports=new FSUtils();