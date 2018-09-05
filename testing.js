var mysql = require('promise-mysql');
var express = require('express');


var app = express();
/*
 Load the RedditAPI class and create an API with db connection. This connection will stay open as
 long as the web server is running, which is 24/7.
 */
var RedditAPI = require('./lib/reddit.js');
var connection = mysql.createPool({
    user: 'root',
    database: 'reddit',
    password: 'berserkfury'
});
var myReddit = new RedditAPI(connection);

/* test function for user login */

// myReddit.checkUserLogin('TheAmazingTentacle', 'abc123')
// .then(function(user) {
//     console.log(user);
// })
// .catch(function(err) {
//     console.log(err);
// })

/* test function for creating a user session */

myReddit.createUserSession('newname')




// myReddit.getSubredditByName('1') 
// .then(function(name) {
//     console.log(name);
// })
// .catch(function(err) {
//     console.log(err);
// });

app.get('/sort/:method', function(request, response){
    myReddit.getAllPosts().then(function(sortPosts){
    if(request.params.method === myReddit.getAllPosts.hot) {
        response.render('post-list', {posts: sortPosts})
    } else if (request.params.method === myReddit.getAllPosts.top) {
        response.render('post-list',{posts: sortPosts})
    } else{
         response.status(404).send('404 Not Found');
    }
    response.send('post-list');
    })
});