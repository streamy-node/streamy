exports.safePath = function safePath(req, res, next) {
  if (req.params[0].indexOf("..") != -1) {
    res.sendStatus(500);
  } else {
    next();
  }
};
