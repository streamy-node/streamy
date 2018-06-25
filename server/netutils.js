/// Network utils
const fs = require('fs');
const request = require('request');

const download = function(url, filename) {
    // return new pending promise
    return new Promise((resolve, reject) => {
        downloadCB(url,filename,resolve,reject);
    });
};

const downloadCB = function(uri, filename, onSucess, onError){
    request(uri).pipe(fs.createWriteStream(filename)).on('close', onSucess).on('error',onError);
    // request.head(uri, function(err, res, body){
    //     console.log('content-type:', res.headers['content-type']);
    //     console.log('content-length:', res.headers['content-length']);
    //     request(uri).pipe(fs.createWriteStream(filename)).on('close', callback).on('error',onError);
    // });
};

const getContent = function(url) {
    // return new pending promise
    return new Promise((resolve, reject) => {

        // select http or https module, depending on reqested url
        const lib = url.startsWith('https') ? require('https') : require('http');
        const request = lib.get(url, (response) => {
            // handle http errors
            if (response.statusCode < 200 || response.statusCode > 299) {
                reject(new Error('Failed to load page, status code: ' + response.statusCode));
                }
            // temporary data holder
            const body = [];
            // on every content chunk, push it to the data array
            response.on('data', (chunk) => body.push(chunk));
            // we are done, resolve promise with those joined chunks
            response.on('end', () => {
                var content = body.join('');
                resolve(content);
            });
        // handle connection errors of the request
        }).on('error', (err) => {
            console.log(err);
            reject(err)
        });
    });
};

// const getContent = function(url,onSuccess,onError) {
//     // select http or https module, depending on reqested url
//     const lib = url.startsWith('https') ? require('https') : require('http');
//     const request = lib.get(url, (response) => {
//     // handle http errors
//     if (response.statusCode < 200 || response.statusCode > 299) {
//         onError(new Error('Failed to load page, status code: ' + response.statusCode));
//         return;
//     }
//     // temporary data holder
//     const body = [];
//     // on every content chunk, push it to the data array
//     response.on('data', (chunk) => body.push(chunk));
//     // we are done, resolve promise with those joined chunks
//     response.on('end', () => {
//         var content = body.join('');
//         onSuccess(content);
//     });
//     // handle connection errors of the request
//     request.on('error', (err) => {
//             console.log(err);
//             onError(err)
//         });
//     });
// };

const sendAsJson = function(ws,msg,onSuccess,onError){
    console.log('sending ',msg);
    ws.send(JSON.stringify(msg), function ack(error) {
        // If error is not defined, the send has been completed, otherwise the error
        // object will indicate what failed.
        if(error){
            console.log('socket error',error);
            onError(error);
        }else{
            onSuccess();
        }
    });
}

function escapeSpecialChars(jsonString) {

    return jsonString.replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t")
        .replace(/\f/g, "\\f");
}

const parseJson = function(jsonString){
    return JSON.parse(escapeSpecialChars(jsonString));
}

module.exports.download = download
module.exports.getContent = getContent
module.exports.sendAsJson = sendAsJson
module.exports.parseJson = parseJson