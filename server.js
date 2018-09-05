var express = require('express');
var mysql = require('promise-mysql');

// Express middleware
var bodyParser = require('body-parser'); // reads request bodies from POST requests
var cookieParser = require('cookie-parser'); // parses cookie from Cookie request header into an object
var morgan = require('morgan'); // logs every request on the console
var onlyLoggedIn = require('./lib/only-logged-in.js'); // only allows requests from logged in users
var checkLoginToken = require('./lib/check-login-token.js')

// Controllers
var authController = require('./controllers/auth.js');

/*
 Database connection.
 */
var RadditAPI = require('./lib/raddit.js');
if (process.env.JAWSDB_URL) {
    var connection = mysql.createPool(process.env.JAWSDB_URL);
  } else {
     connection = mysql.createPool({
        user: 'root',
        password: 'berserkfury',
        database: 'raddit'
    });
  }


var myRaddit = new RadditAPI(connection);


// Create a new Express web server
var app = express();

// Specify the usage of the Pug template engine
app.set('view engine', 'pug');

/*/ Set Handlebars.
var exphbs = require("express-handlebars");

app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");
*/


// This middleware will log every request made to the web server on the console.
app.use(morgan('dev'));

// This middleware will parse the POST requests coming from an HTML form, and put the result in request.body.
app.use(bodyParser.urlencoded({
    extended: false
}));

// This middleware will parse the Cookie header from all requests, and put the result in request.cookies as an object.
app.use(cookieParser());

/*
This custom middleware checks in the cookies if there is a SESSION token and validates it.
*/

app.use(checkLoginToken(myRaddit));




//Passes the auth route to the radditAPi
app.use('/auth', authController(myRaddit));

//Serve static files
app.use('/static', express.static(__dirname + '/public'));

// Regular home Page
app.get('/', function(request, response) {
    myRaddit.getAllPosts({})
        .then(function(posts) {
            response.render('homepage', {
                posts: posts
            });
        })
        .catch(function(error) {
            response.render('error', {
                error: error
            });
        });
});

// Listing of subraddits
app.get('/subraddits', function(request, response) {
    myRaddit.getAllPosts()
        .then(results => {
            response.render('post-list', {
                subraddit: results
            })
        })
});

// Subraddit homepage, similar to the regular home page but filtered by sub.
app.get('/r/:subraddit', function(request, response) {
    var selectedSubraddit;
    myRaddit.getSubradditByName(request.params.subraddit)
        .then(result => {
            selectedSubraddit = result;
            if (!selectedSubraddit) {
                response.status(404).send('404 WHERE AM I !?!.')
            }
            else {
                myRaddit.getAllPosts({
                        subradditId: selectedSubraddit.id
                    })
                    .then(function(posts) {
                        response.render('subraddit-page', {
                            posts: posts
                        });

                    })
                    .catch(function(error) {
                        response.render('error', {
                            error: error
                        });
                    })
            }
        })
});

// Sorted home page with 'hot' and 'top' methods
app.get('/sort/:method', function(request, response) {
    if (request.params.method !== 'hot' && request.params.method !== 'top') {
        response.status(404).send('404 Not Found')
    }
    else {
        myRaddit.getAllPosts({
                sortingMethod: request.params.method
            })
            .then(function(posts) {
                response.render('homepage', {
                    posts: posts
                })
            })
            .catch(function(error) {
                response.render('error', {
                    error: error
                })
            })
    }


});

// get single post view


app.get('/post/:postId', function(request, response) {
    return Promise.all([myRaddit.getSinglePost(request.params.postId), myRaddit.getCommentsForPost(request.params.postId)]) // return a promise to retrieve the single post and its comments
        .then(results => {
            console.log('results', results)
            response.render('single-post', {
                    post: results[0],
                    comments: results[1]
                }) // send the results to the single-post view
        }).catch(error => {
            response.status(404).send('404 Not Found')
        });

});


app.post('/vote', onlyLoggedIn, function(request, response) {
    var vote = {
        voteDirection: request.body.voteDirection,
        postId: request.body.postId,
        userId: request.loggedInUser.userId
    }
    myRaddit.createVote(vote)
        .then(results => {
            response.redirect(request.get('referer'));

        })
});


// This handler will send out an HTML form for creating a new post
app.get('/createPost', onlyLoggedIn, function(request, response) {
    myRaddit.getAllSubraddits()
        .then(results => {
            response.render('create-post-form', {
                subradditOptions: results
            });
        });
});

// POST handler for form submissions creating a new post
app.post('/createPost', onlyLoggedIn, function(request, response) {
    myRaddit.createPost({
            subradditId: request.body.subradditId,
            url: request.body.url,
            title: request.body.title,
            userId: request.loggedInUser.userId,
            postId: request.body.postId
        }) // call the createPost function and pass it the information from the form
        .then(newPostId => {
            response.redirect(`post/${newPostId}`);
        })
});

// GET handler for logging the user out
app.get('/logout', function(request, response) {
    var token = request.loggedInUser.token;
    myRaddit.endUserSession(token)
        .then(results => {
            response.redirect('/');
        });
});

// GET handler to go to specific post
app.get('/individualPost', function(request, response) {
    myRaddit.getAllPosts({ // get all the posts 
                postId: request.body.postId // retrieve the post ids
            })
            .then(results => {
                response.redirect(`post/${request.body.postId}`);
            })
});

app.post('/createComment', onlyLoggedIn, function(request, response) {
    myRaddit.createComment({
            userId: request.loggedInUser.userId,
            postId: request.body.postId,
            text: request.body.text
        }) // call the createPost function and pass it the information from the form
        .then(results => {
            response.redirect(`post/${request.body.postId}`);
        })
});


// Listen
var port = process.env.PORT || 3000;
app.listen(port, function() {
        console.log('Web server is listening on http://localhost:' + port);
});
