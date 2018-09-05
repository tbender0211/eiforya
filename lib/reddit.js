"use strict";

var bcrypt = require('bcrypt-as-promised');
var HASH_ROUNDS = 10;
var emoji = require('node-emoji');
var marked = require('marked');

// This is a helper function to map a flat post to nested post
function transformPost(post) {
    return {
        id: post.posts_id,
        title: emoji.emojify(marked(post.posts_title)),
        url: post.posts_url,
        createdAt: post.posts_createdAt,
        updatedAt: post.posts_updatedAt,
        voteScore: post.voteScore,
        numUpvotes: post.numUpvotes,
        numDownvotes: post.numDownvotes,

        user: {
            id: post.users_id,
            username: post.users_username,
            createdAt: post.users_createdAt,
            updatedAt: post.users_updatedAt
        },
        subreddit: {
            id: post.subreddits_id,
            name: post.subreddits_name,
            description: post.subreddits_description,
            createdAt: post.subreddits_createdAt,
            updatedAt: post.subreddits_updatedAt
        }
    };
}

class RedditAPI {
    constructor(conn) {
        this.conn = conn;
    }

    /*
    user should have username and password
     */
    createUser(user) {
        /*
         first we have to hash the password.
         the goal of hashing is to store a digested version of the password from which
         it is infeasible to recover the original password, but which can still be used
         to assess with great confidence whether a provided password is the correct one or not
         */
        return bcrypt.hash(user.password, HASH_ROUNDS)
            .then(hashedPassword => {
                return this.conn.query('INSERT INTO users (username, password, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())', [user.username, hashedPassword]);
            })
            .then(result => {
                return result.insertId;
            })
            .catch(error => {
                // Special error handling for duplicate entry
                if (error.code === 'ER_DUP_ENTRY') {
                    throw new Error('A user with this username already exists');
                }
                else {
                    throw error;
                }
            });
    }

    /*
    post should have userId, title, url, subredditId
     */
    createPost(post) {
        if (!post.subredditId) {
            return Promise.reject(new Error("There is no subreddit id"));
        }

        return this.conn.query(
                `
                INSERT INTO posts (userId, title, url, createdAt, updatedAt, subredditId)
                VALUES (?, ?, ?, NOW(), NOW(), ?)`, [post.userId, post.title, post.url, post.subredditId]
            )
            .then(result => {
                return result.insertId;
            })
    }
    

    getAllPosts(args) {
        
        // create argument for sorting the posts
        
        var orderBySQL = 'p.createdAt DESC';
        
        if (args.sortingMethod === 'top') {
        
            orderBySQL = 'voteScore DESC'
        }
        if (args.sortingMethod === 'hot') {
            
            orderBySQL = 'COALESCE(SUM(v.voteDirection), 0) / NOW() - p.createdAt DESC'
        }
        
        // if has subreddit id, return posts for only that subreddit
        
        var subredditIdSQL = '';
        if (args.subredditId) {
            subredditIdSQL = 'WHERE p.subredditId = ?'
        }
        
        // return the query
        
        return this.conn.query(
            `
            SELECT
                p.id AS posts_id,
                p.title AS posts_title,
                p.url AS posts_url,
                p.createdAt AS posts_createdAt,
                p.updatedAt AS posts_updatedAt, 
                
                u.id AS users_id,
                u.username AS users_username,
                u.createdAt AS users_createdAt,
                u.updatedAt AS users_updatedAt,
                
                s.id AS subreddits_id,
                s.name AS subreddits_name,
                s.description AS subreddits_description,
                s.createdAt AS subreddits_createdAt,
                s.updatedAt AS subreddits_updatedAt,
                
                COALESCE(SUM(v.voteDirection), 0) AS voteScore,
                SUM(IF(v.voteDirection = 1, 1, 0)) AS numUpvotes,
                SUM(IF(v.voteDirection = -1, 1, 0)) AS numDownvotes
                
            FROM posts p
                JOIN users u ON p.userId = u.id
                JOIN subreddits s ON p.subredditId = s.id
                LEFT JOIN votes v ON p.id = v.postId
                
            ${subredditIdSQL}
            GROUP BY p.id
            ORDER BY ${orderBySQL}
            LIMIT 25
            `, [args.subredditId]
            )
            .then(function(posts) {
                return posts.map(transformPost);
            });

    }

    // Similar to previous function, but retrieves one post by its ID
    getSinglePost(postId) {
        return this.conn.query(
                `
            SELECT
                p.id AS posts_id,
                p.title AS posts_title,
                p.url AS posts_url,
                p.createdAt AS posts_createdAt,
                p.updatedAt AS posts_updatedAt, 
                
                u.id AS users_id,
                u.username AS users_username,
                u.createdAt AS users_createdAt,
                u.updatedAt AS users_updatedAt,
                
                s.id AS subreddits_id,
                s.name AS subreddits_name,
                s.description AS subreddits_description,
                s.createdAt AS subreddits_createdAt,
                s.updatedAt AS subreddits_updatedAt,
                
                COALESCE(SUM(v.voteDirection), 0) AS voteScore,
                SUM(IF(v.voteDirection = 1, 1, 0)) AS numUpvotes,
                SUM(IF(v.voteDirection = -1, 1, 0)) AS numDownvotes
                
            FROM posts p
                JOIN users u ON p.userId = u.id
                JOIN subreddits s ON p.subredditId = s.id
                LEFT JOIN votes v ON p.id = v.postId
                
            WHERE p.id = ?`, [postId]
            )
            .then(function(posts) {
                if (posts.length === 0) {
                    return null;
                }
                else {
                    return transformPost(posts[0]);
                }
            });
    }

    /*
    subreddit should have name and optional description
     */
    createSubreddit(subreddit) {
        return this.conn.query(
                `INSERT INTO subreddits (name, description, createdAt, updatedAt)
            VALUES(?, ?, NOW(), NOW())`, [subreddit.name, subreddit.description])
            .then(function(result) {
                return result.insertId;
            })
            .catch(error => {
                if (error.code === 'ER_DUP_ENTRY') {
                    throw new Error('A subreddit with this name already exists');
                }
                else {
                    throw error;
                }
            });
    }

    getAllSubreddits() {
        return this.conn.query(`
            SELECT id, name, description, createdAt, updatedAt
            FROM subreddits ORDER BY createdAt DESC`);
    }

    /*
    vote must have postId, userId, voteDirection
     */
    createVote(vote) {
        var d = Number(vote.voteDirection)
        if (d !== 1 && d !== -1 && d !== 0) {
            return Promise.reject(new Error("voteDirection must be one of -1, 0, 1"));
        }
        console.log(vote.userId);
        return this.conn.query(`
            INSERT INTO votes (postId, userId, voteDirection)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE voteDirection = ?`, [vote.postId, vote.userId, vote.voteDirection, vote.voteDirection]);
    }

    /*
    comment must have userId, postId, text
     */
    createComment(comment) {
        return this.conn.query(`
            INSERT INTO comments (userId, postId, text, createdAt, updatedAt)
            VALUES (?, ?, ?, NOW(), NOW())`, [comment.userId, comment.postId, comment.text])
            .then(result => {
                return result.insertId;
            });
    }

    getCommentsForPost(postId) {
        return this.conn.query(`
            SELECT
                c.id as comments_id,
                c.text as comments_text,
                c.createdAt as comments_createdAt,
                c.updatedAt as comments_updatedAt,
                
                u.id as users_id,
                u.username as users_username
                
            FROM comments c
                JOIN users u ON c.userId = u.id
                
            WHERE c.postId = ?
            ORDER BY c.createdAt DESC
            LIMIT 25`, [postId])
            .then(function(results) {
                return results.map(function(result) {
                    return {
                        id: result.comments_id,
                        text: emoji.emojify(marked(result.comments_text)),
                        createdAt: result.comments_createdAt,
                        updatedAt: result.comments_updatedAt,

                        user: {
                            id: result.users_id,
                            username: result.users_username
                        }
                    };
                });
            });
    }

    checkUserLogin(username, password) {
        // return Promise.reject(new Error("TODO: You have to implement the RedditAPI.checkUserLogin function."))
        return this.conn.query(
                `SELECT * FROM users WHERE username = ?`, [username]
            ) // run a query to search for a matching username
            .then(result => {
                if (result.length === 0) { // if array is empty, throw error
                    throw new Error("username or password incorrect");
                }

                return bcrypt.compare(password, result[0].password)
                    .then(function(isMatch) { // if pwd matches user pwd in db, return user object 
                        if (isMatch) {
                            return result[0];
                        }
                    })
                    .catch(function(err) { // throw error if pwd does not match user pwd in db
                        throw new Error("username or password incorrect");
                    });
            });
    }

    /* 
        logic behind login function 
            
    if (there is a username match) {
           if ( input pwd matches db hashed pwd) {
               make promise return full user object minus hashed pwd
           } else {
               throw error "username or password incorrect"
           }
       } else {
           username is not a match - throw error "username or password incorrect"
       }
    })
            
    */

    /*
    Here are the steps you should follow:

        1. Find an entry in the users table corresponding to the input username
            a. If no user is found, make your promise throw an error "username or password incorrect".
            b. If you found a user, move to step 2
        2. Use the bcrypt.compare function to check if the database's hashed password matches the input password
            a. if it does, make your promise return the full user object minus the hashed password
            b. if it doesn't, make your promise throw an error "username or password incorrect"
     */


    createUserSession(userId) {
        // return Promise.reject(new Error("TODO: You have to implement the RedditAPI.createUserSession function."))
        return bcrypt.genSalt(10, userId) // generate salt of userId
            .then(sessionToken => { // send user Id and session token to database
                console.log(sessionToken);
                return this.conn.query(`INSERT INTO sessions (userId, token) values (?, ?)`, [userId, sessionToken])
                    .then(result => { // return the session token
                        return sessionToken;
                    });
            });

    }


    /* 
        logic behind this function
        
        bcrypt genSalt() {
            return random string
            store it as var sessionId
        } .then(
            return this conn.query(
            `add new session from above to the sessions table, using input userId`
            ) 
        ) .then (
            return var sessionId
        )

    /*
     Here are the steps you should follow:

     1. Use bcrypt's genSalt function to create a random string that we'll use as session id (promise)
     2. Use an INSERT statement to add the new session to the sessions table, using the input userId
     3. Once the insert is successful, return the random session id generated in step 1
     */


    getUserFromSession(sessionId) {
        return this.conn.query
        (`SELECT * from users JOIN sessions ON users.id = sessions.userId WHERE sessions.token =?`, [sessionId])
        .then(user => {
            return user[0];
        });
}

    getSubredditByName(name) {
        return this.conn.query( // makes query to the database
                `SELECT * FROM subreddits WHERE name = ?`, [name]
            )
            .then(result => {
                if (result.length === 0) {
                    throw new Error("The subreddit doesn't exist"); // promise resolves with error if condition is met
                }
                return result[0]; // returns subreddit object
            });
    }

    endUserSession(token) {
        return this.conn.query(`DELETE FROM sessions WHERE token = ?`, [token])
        .then(result => {
            console.log(result);
            return result;
        }).catch(console.error)
    }
    
    
    
}


module.exports = RedditAPI;
