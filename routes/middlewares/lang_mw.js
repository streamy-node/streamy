var path = require("path");
var i18n = require("i18n");

//Setup lang
function initializei18n(locales_path) {
  i18n.configure({
    locales: ["en", "fr"],
    defaultLocale: "en",
    queryParameter: "lang",
    directory: locales_path, //path.join(rootFolder, '/static/locales'), //__dirname
    api: {
      __: "translate",
      __n: "translateN"
    }
  });
  return i18n;
}

//register helper as a locals function wrapped as mustache expects
function setupLocals(req, res, next) {
  // mustache helper
  res.locals.__ = function() {
    return function(text, render) {
      return i18n.__.apply(req, arguments);
    };
  };
  next();
}

exports.i18n = initializei18n;
exports.setupLocals = setupLocals;
