var fs = require('fs') 
var path = require('path')
var util = require('util')
var Stream = require('stream').Stream
var fsutils = require('./fsutils')
const shortId = require('shortid');

class Resumable{
    constructor(){
        this.activeIdentifier = new Map()
        this.maxFileSize = 15*1024*1024*1024;
        this.fileParameterName = 'file';
    }

    async setTargetFolder(targetFolder){
        this.targetFolder = targetFolder;
        this.temporaryFolder = targetFolder+"/tmp";
        try {
            await fsutils.mkdirp(targetFolder);
            await fsutils.mkdirp(temporaryFolder);
        }catch(e){}
    }

    cleanIdentifier(identifier){
        return identifier.replace(/^0-9A-Za-z_-/img, '');
    }

    validateRequest(chunkNumber, chunkSize, totalSize, identifier, filename, fileSize){
        // Clean up the identifier
        identifier = this.cleanIdentifier(identifier);

        // Check if the request is sane
        if (chunkNumber==0 || chunkSize==0 || totalSize==0 || identifier.length==0 || filename.length==0) {
            return 'non_resumable_request';
        }
        var numberOfChunks = Math.max(Math.floor(totalSize/(chunkSize*1.0)), 1);
        if (chunkNumber>numberOfChunks) {
            return 'invalid_resumable_request1';
        }

        // Is the file too big?
        if(this.maxFileSize && totalSize>this.maxFileSize) {
            return 'invalid_resumable_request2';
        }

        if(typeof(fileSize)!='undefined') {
            if(chunkNumber<numberOfChunks && fileSize!=chunkSize) {
                // The chunk in the POST request isn't the correct size
                return 'invalid_resumable_request3';
            }
            if(numberOfChunks>1 && chunkNumber==numberOfChunks && fileSize!=((totalSize%chunkSize)+chunkSize)) {
                // The chunks in the POST is the last one, and the fil is not the correct size
                return 'invalid_resumable_request4';
            }
            if(numberOfChunks==1 && fileSize!=totalSize) {
                // The file is only a single chunk, and the data size does not fit
                return 'invalid_resumable_request5';
            }
        }

        return 'valid';
    }

  //'found', filename, original_filename, identifier
  //'not_found', null, null, null
    async get(req, callback){
        // var chunkNumber = req.param('resumableChunkNumber', 0);
        // var chunkSize = req.param('resumableChunkSize', 0);
        // var totalSize = req.param('resumableTotalSize', 0);
        // var identifier = req.param('resumableIdentifier', "");
        // var filename = req.param('resumableFilename', "");

        // let result = {
        //     status:200,
        //     message:"",
        //     filename:filename, 
        //     original_filename:original_filename,
        //     identifier:identifier
        // }

        // if(this.validateRequest(chunkNumber, chunkSize, totalSize, identifier, filename)=='valid') {
        //     var chunkFilename = this.getChunkFilename(chunkNumber, identifier);
        //     if(await fsutils.exists(chunkFilename)){
        //         return result;
        //     } else {
        //         result.status = 204; // No content
        //         return result;
        //     }
        // } else {
        //     result.status = 400; // Bad request
        //     result.message = "";
        // }
    }

    //Avoid disk copies
    async postSequential(req){
        return new Promise((resolve, reject) => {
            var self = this;

            //Get fieldnames from resumable client
            req.busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
                //console.log('Field [' + fieldname + ']: value: ' + val);
                req.body[fieldname] = val;
            });
        
            req.busboy.on('finish', function() {
                //console.log('Done parsing form!');
            });
        
            req.on("close", async function() {
                // request closed unexpectedly clear files
                let filename = req.body.resumableIdentifier;
                let original_filename = req.body.resumableFilename;
                let identifier = req.body.resumableIdentifier;
                if(identifier){
                    let absFilename = this.temporaryFolder+"/"+filename;
                    if(await fsutils.exists(absFilename)){
                        await fsutils.unlinkFile( absFilename);
                    }
                }
                let result = {
                    status:424,
                    message:"",
                    filename:filename, 
                    original_filename:original_filename,
                    identifier:identifier
                }
                result.status = 424;
                resolve(result)
                console.warn('request closed unexpectedly!');
            });
            
            req.on("end", function() {
                //  request ended normally
                //console.log(' request ended normally!');
            });
        
            req.pipe(req.busboy);

            req.busboy.on('file', (fieldname, file, filename) => {
                // Create a write stream of the new file
                let options = null;
                let chunkNumber = parseInt(req.body.resumableChunkNumber);
                var chunkSize = parseInt(req.body.resumableChunkSize);
                var totalSize = parseInt(req.body.resumableTotalSize);
                let identifier = req.body.resumableIdentifier;
                var original_filename = req.body.resumableFilename;
                var filename = req.body.resumableIdentifier;
                var numberOfChunks = Math.max(Math.floor(totalSize/(chunkSize*1.0)), 1);

                let result = {
                    status:200,
                    message:"",
                    filename:filename, 
                    original_filename:original_filename,
                    identifier:identifier
                }

                if(this.validateRequest(chunkNumber, chunkSize, totalSize, identifier, filename)!='valid') {
                    result.status = 406;
                    resolve(result)
                }

                //check if chunk number follow the previous one and no other stream is on it
                if(this.activeIdentifier.has(identifier)){
                    if(chunkNumber == 1){
                        //I guess the client resets, todo use test from resumable.js
                    }else{
                        //Already uploading
                        let identifierStatus = this.activeIdentifier.get(identifier);
                        if(identifierStatus.isWritting){
                            //Someone else is already sending it
                            result.status = 409;
                            resolve(result)
                        }

                        if( identifierStatus.lastChunkNumber != chunkNumber-1){
                            //Not the chunk we expect
                            result.status = 409;
                            resolve(result);
                        }
                    }
                }else if(chunkNumber != 1){
                    //Not the chunk we expect
                    result.status = 409;
                    resolve(result);
                }
                
                if(chunkNumber > 1){
                    options = {'flags': 'a'}
                }    
                this.activeIdentifier.set(identifier,{isWritting:true,lastChunkNumber:chunkNumber })
                const fstream = fs.createWriteStream(path.join(self.temporaryFolder,req.body.resumableIdentifier),options);
                
                // Pipe it trough
                file.pipe(fstream);

                // On finish of the upload
                fstream.on('close', async () => {
                    if(numberOfChunks == chunkNumber){//If it's the last chunk
                        // rename the file
                        let uniqueName = shortId.generate()+path.extname(original_filename)
                        await fsutils.rename(this.temporaryFolder+"/"+filename, this.targetFolder+"/"+uniqueName)
                        console.log(`Upload of '${uniqueName}' finished`);
                        this.activeIdentifier.delete(identifier);
                        result.filename = uniqueName;
                        result.status = 201;
                    }else{//If it's not the last chunk
                        this.activeIdentifier.set(identifier,{isWritting:false,lastChunkNumber:chunkNumber})
                        result.status = 200;
                    }
                    resolve(result);
                });
            })
        });
    }

    async testChunkExists(currentTestChunk,numberOfChunks,identifier,filename,original_filename,callback){
        // if(await fsutils.exists(this.getChunkFilename(currentTestChunk, identifier))){
        //     currentTestChunk++;
        //     if(currentTestChunk>numberOfChunks) {
        //         if(automerge){
        //             let files = this.getAllChunkFilenames(numberOfChunks,identifier)
        //             let concatReult = await fsutils.concat(files,identifier)
        //             if(concatReult){
        //                 await fsutils.unlinkFiles(files);
        //                 callback('done', filename, original_filename, identifier);
        //             }else{
        //                 console.error("Failed to concat uploaded files ",identifier)
        //             } 
        //         }else{
        //             callback('done', filename, original_filename, identifier);
        //         }
        //     }
        // } else {
        //     callback('partly_done', filename, original_filename, identifier);
        // }
    }
}

module.exports= Resumable;