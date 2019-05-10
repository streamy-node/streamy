

var express = require('express')
var UsersMgr = require('../../core/users');

var loggedIn = require('../middlewares/auth_mw').loggedIn
var i18n = require('../middlewares/lang_mw').i18n
var setupLocals = require('../middlewares/lang_mw').setupLocals

/// Worker Router ///
class AuthRouter{

    /**
     * 
     * @param {passport} passport 
     */
    constructor(passport){
        this.passport = passport;
    }

    buildRouter(){
        var self = this;
        var router = express.Router();

        router.post('/login',
            self.passport.authenticate('local', { successRedirect: '/index',
                                        failureRedirect: '/login?status=failed',
                                        failureFlash: false })
        );

        router.get('/logout',
            function(req, res){
                req.logout();
                res.redirect('/login');
            }
        );

        router.get('/login', i18n.init, setupLocals, function (req, res) {
            res.render('login.html')
        })

        router.get('/session-infos', loggedIn, function (req, res) {
            var sessInfos = {};
            sessInfos.name = req.user.displayName;
            res.send(sessInfos);
        })

        return router;
    }
}

module.exports = AuthRouter;
