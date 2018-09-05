var express = require('express');
var loginTokenChecker = require('../lib/check-login-token.js');

module.exports = function(myReddit) {
    var authController = express.Router();
    

    authController.get('/login', function(request, response) {
        response.render('login-form', {});
    });


    authController.post('/login', function(request, response) {
        myReddit.checkUserLogin(request.body.username, request.body.password) // call the checkUserLogin function and pass it username and pwd
            .then(result => { // if the credentials are correct, the result will contain the userId
                return myReddit.createUserSession(result.id) // pass the userId to createUserSession function to return a new session id
            })
            .then(cookie => { // set a cookie with name session where the value of the cookie is the session id
                response.cookie('SESSION', cookie);
            })
            .then(result => { // redirect the user to the home page
                response.redirect('/')
            })
            .catch(error => {
                response.status(401).send('Unauthorized') // throw error if login check is unsuccessful
            });
    });
    
    authController.get('/logout', function(request, response) {
        response.render('homepage', {});
    });

    authController.get('/signup', function(request, response) {
        response.render('signup-form', {});
    });

    authController.post('/signup', function(request, response) {
        myReddit.createUser(request.body).then(response.redirect('login'))
    });

    return authController;
}
