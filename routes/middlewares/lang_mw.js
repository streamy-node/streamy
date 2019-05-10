var path = require('path');
var i18n  = require('i18n');

let rootFolder = path.dirname(require.main.filename || process.mainModule.filename);

//Setup lang
i18n.configure({
    locales: ['en', 'fr'],
    defaultLocale: 'en',
    queryParameter: 'lang',
    directory: path.join(rootFolder, '/static/locales'), //__dirname
    api: {
        '__': 'translate',  
        '__n': 'translateN' 
    }
});

//register helper as a locals function wrapped as mustache expects
function setupLocals(req, res, next){
    // mustache helper
    res.locals.__ = function () {
        return function (text, render) {
        return i18n.__.apply(req, arguments);
        };
    };
    next();
}

exports.i18n = i18n;
exports.setupLocals = setupLocals;