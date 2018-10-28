var fs = require('fs') 
var path = require('path')
var util = require('util')
var Stream = require('stream').Stream
var fsutils = require('./fsutils')

class Resumable{
    constructor(){
        this.activeIdentifier = new Map()
        this.maxFileSize = 15*1024*1024*1024;
        this.fileParameterName = 'file';
    }

    async setTemporaryFolder(temporaryFolder){
        this.temporaryFolder = temporaryFolder;
        try {
            await fsutils.mkdirp(temporaryFolder);
        }catch(e){}
    }

    cleanIdentifier(identifier){
        return identifier.replace(/^0-9A-Za-z_-/img, '');
    }

    getChunkFilename(chunkNumber, identifier){
        // Clean up the identifier
        identifier = this.cleanIdentifier(identifier);
        // What would the file name be?
        return path.join(this.temporaryFolder, './'+identifier+'.'+chunkNumber);
    }

    getAllChunkFilenames(lastChunkNumber, identifier){
        let files = []
        for(let i=1; i<=lastChunkNumber; i++){
            files.push(this.getChunkFilename(i,identifier))
        }
        return files;
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
        var chunkNumber = req.param('resumableChunkNumber', 0);
        var chunkSize = req.param('resumableChunkSize', 0);
        var totalSize = req.param('resumableTotalSize', 0);
        var identifier = req.param('resumableIdentifier', "");
        var filename = req.param('resumableFilename', "");

        let result = {
            status:200,
            message:"",
            filename:filename, 
            original_filename:original_filename,
            identifier:identifier
        }

        if(this.validateRequest(chunkNumber, chunkSize, totalSize, identifier, filename)=='valid') {
            var chunkFilename = this.getChunkFilename(chunkNumber, identifier);
            if(await fsutils.exists(chunkFilename)){
                return result;
            } else {
                result.status = 204; // No content
                return result;
            }
        } else {
            result.status = 400; // Bad request
            result.message = "";
        }
    }

    //'partly_done', filename, original_filename, identifier
    //'done', filename, original_filename, identifier
    //'invalid_resumable_request', null, null, null
    //'non_resumable_request', null, null, null
    async post(req, automerge = false){

        var fields = req.body;
        var files = req.files;
        var chunkNumber = fields['resumableChunkNumber'];
        var chunkSize = fields['resumableChunkSize'];
        var totalSize = fields['resumableTotalSize'];
        var identifier = this.cleanIdentifier(fields['resumableIdentifier']);
        var original_filename = fields['resumableFilename'];
        var filename = fields['resumableIdentifier'];
        var self = this

        let result = {
            status:200,
            message:"",
            filename:filename, 
            original_filename:original_filename,
            identifier:identifier
        }

        if(!files[this.fileParameterName] || !files[this.fileParameterName].size) {
            result.status = 400
            result.message = 'invalid_resumable_request'
            return result;
        }

        var validation = this.validateRequest(chunkNumber, chunkSize, totalSize, identifier, files[this.fileParameterName].size);
        if(validation=='valid') {
            var chunkFilename = this.getChunkFilename(chunkNumber, identifier);

            // Save the chunk (TODO: OVERWRITE)
            console.log("renaming ",files[this.fileParameterName].path," to ",chunkFilename)
            await fsutils.rename(files[this.fileParameterName].path, chunkFilename)
            result.filename = chunkFilename

            // Do we have all the chunks?
            var currentTestChunk = 1;
            if(this.activeIdentifier.has(identifier)){
                currentTestChunk = this.activeIdentifier.get(identifier) + 1;
                this.activeIdentifier.set(identifier,currentTestChunk)
            }else{
                this.activeIdentifier.set(identifier,currentTestChunk)
            }
            var numberOfChunks = Math.max(Math.floor(totalSize/(chunkSize*1.0)), 1);
            
            //If all chunck received, merge them
            if(currentTestChunk >= numberOfChunks){
                if(automerge){
                    let files = this.getAllChunkFilenames(numberOfChunks,identifier)
                    let targetFileName = identifier+path.extname(original_filename)
                    let concatReult = await fsutils.concat(files,this.temporaryFolder+"/"+targetFileName)
                    if(concatReult){
                        await fsutils.unlinkFiles(files);
                        result.status = 201
                        result.message = 'done'
                        result.filename = targetFileName
                        return result
                    }else{
                        console.error("Failed to concat uploaded files ",identifier)
                        result.status = 500
                        result.message = 'Failed to concat uploaded files'
                        return result
                    } 
                }else{
                    //callback('done', filename, original_filename, identifier);
                    result.status = 201
                    result.message = 'done'
                    return result
                }
            }else{
                result.status = 200
                result.message = 'added'
                return result  
            }
            //await this.testChunkExists(currentTestChunk,numberOfChunks,identifier,filename,original_filename,callback);
        } else {
            result.status = 406
            result.message = validation
            return result
            //callback(validation, filename, original_filename, identifier);
        }
    }

    async testChunkExists(currentTestChunk,numberOfChunks,identifier,filename,original_filename,callback){
        if(await fsutils.exists(this.getChunkFilename(currentTestChunk, identifier))){
            currentTestChunk++;
            if(currentTestChunk>numberOfChunks) {
                if(automerge){
                    let files = this.getAllChunkFilenames(numberOfChunks,identifier)
                    let concatReult = await fsutils.concat(files,identifier)
                    if(concatReult){
                        await fsutils.unlinkFiles(files);
                        callback('done', filename, original_filename, identifier);
                    }else{
                        console.error("Failed to concat uploaded files ",identifier)
                    } 
                }else{
                    callback('done', filename, original_filename, identifier);
                }
            }
        } else {
            callback('partly_done', filename, original_filename, identifier);
        }
    }

    async concatFiles(files, filename, original_filename, identifier, callback) {
        if(await fsutils.concat(files,identifier)){
            await fsutils.unlinkFiles(files);
            callback('done', filename, original_filename, identifier);
        }else{
            console.error("Failed to concat uploaded files ",identifier)
        } 
    }

    write(identifier, writableStream, options) {
        options = options || {};
        options.end = (typeof options['end'] == 'undefined' ? true : options['end']);

        // Iterate over each chunk
        var pipeChunk = function(number) {

            var chunkFilename = this.getChunkFilename(number, identifier);
            fs.exists(chunkFilename, function(exists) {

                if (exists) {
                    // If the chunk with the current number exists,
                    // then create a ReadStream from the file
                    // and pipe it to the specified writableStream.
                    var sourceStream = fs.createReadStream(chunkFilename);
                    sourceStream.pipe(writableStream, {
                        end: false
                    });
                    sourceStream.on('end', function() {
                        // When the chunk is fully streamed,
                        // jump to the next one
                        pipeChunk(number + 1);
                    });
                } else {
                    // When all the chunks have been piped, end the stream
                    if (options.end) writableStream.end();
                    if (options.onDone) options.onDone();
                }
            });
        }
        pipeChunk(1);
    }

    clean(identifier, options) {
        options = options || {};

        // Iterate over each chunk
        var pipeChunkRm = function(number) {

            var chunkFilename = this.getChunkFilename(number, identifier);

            //console.log('removing pipeChunkRm ', number, 'chunkFilename', chunkFilename);
            fs.exists(chunkFilename, function(exists) {
                if (exists) {

                    console.log('exist removing ', chunkFilename);
                    fs.unlink(chunkFilename, function(err) {
                        if (err && options.onError) options.onError(err);
                    });

                    pipeChunkRm(number + 1);

                } else {

                    if (options.onDone) options.onDone();

                }
            });
        }
        pipeChunkRm(1);
    }
}

module.exports= Resumable;