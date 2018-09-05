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
        subraddit: {
            id: post.subraddits_id,
            name: post.subraddits_name,
            description: post.subraddits_description,
            createdAt: post.subraddits_createdAt,
            updatedAt: post.subraddits_updatedAt
        }
    };
}

class RadditAPI {
    constructor(conn) {
        this.conn = conn;
    }

    /*
     username and password
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
    post should have userId, title, url, subradditId
     */
    createPost(post) {
        if (!post.subradditId) {
            return Promise.reject(new Error("There is no subraddit id"));
        }

        return this.conn.query(
                `
                INSERT INTO posts (userId, title, url, createdAt, updatedAt, subradditId)
                VALUES (?, ?, ?, NOW(), NOW(), ?)`, [post.userId, post.title, post.url, post.subradditId]
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
        
        // if has subraddit id, return posts for only that subraddit
        
        var subradditIdSQL = '';
        if (args.subradditId) {
            subradditIdSQL = 'WHERE p.subradditId = ?'
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
                
                s.id AS subraddits_id,
                s.name AS subraddits_name,
                s.description AS subraddits_description,
                s.createdAt AS subraddits_createdAt,
                s.updatedAt AS subraddits_updatedAt,
                
                COALESCE(SUM(v.voteDirection), 0) AS voteScore,
                SUM(IF(v.voteDirection = 1, 1, 0)) AS numUpvotes,
                SUM(IF(v.voteDirection = -1, 1, 0)) AS numDownvotes
                
            FROM posts p
                JOIN users u ON p.userId = u.id
                JOIN subraddits s ON p.subradditId = s.id
                LEFT JOIN votes v ON p.id = v.postId
                
            ${subradditIdSQL}
            GROUP BY p.id
            ORDER BY ${orderBySQL}
            LIMIT 25
            `, [args.subradditId]
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
                
                s.id AS subraddits_id,
                s.name AS subraddits_name,
                s.description AS subraddits_description,
                s.createdAt AS subraddits_createdAt,
                s.updatedAt AS subraddits_updatedAt,
                
                COALESCE(SUM(v.voteDirection), 0) AS voteScore,
                SUM(IF(v.voteDirection = 1, 1, 0)) AS numUpvotes,
                SUM(IF(v.voteDirection = -1, 1, 0)) AS numDownvotes
                
            FROM posts p
                JOIN users u ON p.userId = u.id
                JOIN subraddits s ON p.subradditId = s.id
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
    subraddit should have name and optional description
     */
    createSubraddit(subraddit) {
        return this.conn.query(
                `INSERT INTO subraddits (name, description, createdAt, updatedAt)
            VALUES(?, ?, NOW(), NOW())`, [subraddit.name, subraddit.description])
            .then(function(result) {
                return result.insertId;
            })
            .catch(error => {
                if (error.code === 'ER_DUP_ENTRY') {
                    throw new Error('A subraddit with this name already exists');
                }
                else {
                    throw error;
                }
            });
    }

    getAllSubraddits() {
        return this.conn.query(`
            SELECT id, name, description, createdAt, updatedAt
            FROM subraddits ORDER BY createdAt DESC`);
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



    createUserSession(userId) {
        // return Promise.reject(new Error("TODO: You have to implement the RadditAPI.createUserSession function."))
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
    */


    getUserFromSession(sessionId) {
        return this.conn.query
        (`SELECT * from users JOIN sessions ON users.id = sessions.userId WHERE sessions.token =?`, [sessionId])
        .then(user => {
            return user[0];
        });
}

    getSubradditByName(name) {
        return this.conn.query( // makes query to the database
                `SELECT * FROM subraddits WHERE name = ?`, [name]
            )
            .then(result => {
                if (result.length === 0) {
                    throw new Error("The subraddit doesn't exist"); // promise resolves with error if condition is met
                }
                return result[0]; // returns subraddit object
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


module.exports = RadditAPI;
