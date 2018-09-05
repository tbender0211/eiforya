var mysql = require('promise-mysql');
var express = require('express');


var app = express();
var RadditAPI = require('./lib/raddit.js');
var connection = mysql.createPool({
    user: 'root',
    database: 'raddit',
    password: 'berserkfury'
});
var myRaddit = new RadditAPI(connection);

/* test function for user login */

 myRaddit.checkUserLogin('TheAmazingTentacle', 'abc123')
 .then(function(user) {
     console.log(user);
 })
 .catch(function(err) {
     console.log(err);
 })

/* test function for creating a user session */

myRaddit.createUserSession('newname')



app.get('/sort/:method', function(request, response){
    myRaddit.getAllPosts().then(function(sortPosts){
    if(request.params.method === myRaddit.getAllPosts.hot) {
        response.render('post-list', {posts: sortPosts})
    } else if (request.params.method === myRaddit.getAllPosts.top) {
        response.render('post-list',{posts: sortPosts})
    } else{
         response.status(404).send('404 Not Found');
    }
    response.send('post-list');
    })
});