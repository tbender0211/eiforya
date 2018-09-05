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
var RedditAPI = require('./lib/reddit.js');
var connection = mysql.createPool({
    user: 'root',
    password: 'berserkfury',
    database: 'reddit'
});
var myReddit = new RedditAPI(connection);


// Create a new Express web server
var app = express();

// Specify the usage of the Pug template engine
app.set('view engine', 'pug');

/*
 This next section specifies the middleware we want to run.
 app.use takes a callback function that will be called on every request
 the callback function will receive the request object, the response object, and a next callback.
 this type of function is called a "middleware".
 express will run these middleware in a pipeline, one after the other on each request.
 the order the middleware are declared in is important. for example, the cookieParser middleware will
 add a .cookie property to the request object. the checkLoginToken middleware will then use request.cookie
 to check if a user is logged in. this means cookieParser needs to run before checkLoginToken.
 */

// This middleware will log every request made to your web server on the console.
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

app.use(checkLoginToken(myReddit));





/*
app.use can also take a path prefix as a parameter. the next app.use says that anytime the request URL
starts with /auth, the middleware exported by controllers/auth.js should be called.

this type of middleware is a common way to modularize code in an Express application. basicaly we're
saying that any URL under /auth has to do with authentication, and we put all the sub-routes in their
own file to prevent clutter and improve maintainability.

the file at controllers/auth.js contains what is called an Express Router. a Router is like a tiny
express application that takes care of its own set of paths. look at the file for more information.

The authController needs access to the RedditAPI to do its work, so we pass it as a parameter and the
controller gets returned from that function.
 */
app.use('/auth', authController(myReddit));

/*
 This next middleware will allow us to serve static files, as if our web server was a file server.
 To do this, we attach the middleware to the /static URL path. This means any URL that starts with
 /static will go thru this middleware. We setup the static middleware to look for files under the public
 directory which is at the root of the project. This basically "links" the public directory to a URL
 path called /static, and any files under /public can be requested by asking for them with /static
 followed by the path of those files.

 If you look in views/layout.pug, you'll see that we add a <link> tag referencing /static/app.css.
 This is a CSS file that is located in the public directory. For now the file is mostly empty, but
 you can add stuff to it if you want to make your site look better.

 Eventually you could also load browser JavaScript and make your site more dynamic. We will be looking
 at how to do this in the next few weeks but don't hesitate to take a head start.
 */
app.use('/static', express.static(__dirname + '/public'));

// Regular home Page
app.get('/', function(request, response) {
    myReddit.getAllPosts({})
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

// Listing of subreddits
app.get('/subreddits', function(request, response) {
    myReddit.getAllPosts()
        .then(results => {
            response.render('post-list', {
                subreddit: results
            })
        })
});

// Subreddit homepage, similar to the regular home page but filtered by sub.
app.get('/r/:subreddit', function(request, response) {
    var selectedSubreddit;
    myReddit.getSubredditByName(request.params.subreddit)
        .then(result => {
            selectedSubreddit = result;
            if (!selectedSubreddit) {
                response.status(404).send('404 WHERE AM I !?!.')
            }
            else {
                myReddit.getAllPosts({
                        subredditId: selectedSubreddit.id
                    })
                    .then(function(posts) {
                        response.render('subreddit-page', {
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
        myReddit.getAllPosts({
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

/* 
    logic behind this postId get request
    
    1). receieve postId from redirect have the post has been created 
    2). return a promise.all passing in both the getSinglePost and getCommentsForPosts for that specific postId
    3). if the post does not exist, throw a 404 error
    4). if the post exists then => send it to PUG template
        
*/

app.get('/post/:postId', function(request, response) {
    return Promise.all([myReddit.getSinglePost(request.params.postId), myReddit.getCommentsForPost(request.params.postId)]) // return a promise to retrieve the single post and its comments
        .then(results => {
            console.log('results', results)
            response.render('single-post', {
                    post: results[0],
                    comments: results[1]
                }) //5) send the results to the single-post view pug file
        }).catch(error => {
            response.status(404).send('404 Not Found') // throw error if the post does not exist 
        });

});

/*
This is a POST endpoint. It will be called when a form is submitted with method="POST" action="/vote"
The goal of this endpoint is to receive an up/down vote by a logged in user.
Since you can only vote if you are logged in, the onlyLoggedIn middleware is interposed before the final request handler.
The app.* methods of express can actually take multiple middleware, forming a chain that is only used for that path

This basically says: if there is a POST /vote request, first pass it thru the onlyLoggedIn middleware. If that
middleware calls next(), then also pass it to the final request handler specified.
 */


app.post('/vote', onlyLoggedIn, function(request, response) {
    var vote = {
        voteDirection: request.body.voteDirection,
        postId: request.body.postId,
        userId: request.loggedInUser.userId
    }
    myReddit.createVote(vote)
        .then(results => {
            response.redirect(request.get('referer'));

        })
});


// This handler will send out an HTML form for creating a new post
app.get('/createPost', onlyLoggedIn, function(request, response) {
    myReddit.getAllSubreddits()
        .then(results => {
            response.render('create-post-form', {
                subredditOptions: results
            });
        });
});

// POST handler for form submissions creating a new post
app.post('/createPost', onlyLoggedIn, function(request, response) {
    myReddit.createPost({
            subredditId: request.body.subredditId,
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
    myReddit.endUserSession(token)
        .then(results => {
            response.redirect('/');
        });
});

// GET handler to go to specific post
app.get('/individualPost', function(request, response) {
    myReddit.getAllPosts({ // get all the posts 
                postId: request.body.postId // retrieve the post ids
            })
            .then(results => {
                response.redirect(`post/${request.body.postId}`);
            })
});

app.post('/createComment', onlyLoggedIn, function(request, response) {
    myReddit.createComment({
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
    // This part will only work with Cloud9, and is meant to help you find the URL of your web server :)
    if (process.env.C9_HOSTNAME) {
        console.log('Web server is listening on https://' + process.env.C9_HOSTNAME);
    }
    else {
        console.log('Web server is listening on http://localhost:' + port);
    }
});