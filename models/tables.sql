DROP DATABASE IF EXISTS raddit;

CREATE DATABASE raddit;

USE raddit;

-- This creates the users table. The username field is constrained to unique
-- values only, by using a UNIQUE KEY on that column
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  password VARCHAR(60) NOT NULL,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  UNIQUE KEY username (username)
);

CREATE TABLE sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT,
  token VARCHAR(50),
  UNIQUE KEY token (token),
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE subraddits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(30) NOT NULL,
  description VARCHAR(1000),
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  UNIQUE KEY name (name)
);

INSERT INTO subreddits VALUES (1,'beats4u','A place for sharing the music that drives you','2018-09-03 08:15:35','2018-09-03 08:15:35'),
(2,'AskAway','A place for asking for opinions, answers, or advice','2018-09-03 08:15:35','2018-09-03 08:15:35'),
(3,'TechCentral','A place for tech, hardware, and software','2018-09-03 08:15:35','2018-09-03 08:15:35'),
(4,'GamersParadise','A place for sharing the love of gaming','2018-09-03 08:15:35','2018-09-03 08:15:35'),
(5,'TheShowcase','A place for sharing your proects, art, or curious endeavours','2018-09-03 08:15:35','2018-09-03 08:15:35'),
(6,'SocialClub','Eastside talk it out, Westside talk it out','2018-09-03 08:15:35','2018-09-03 08:15:35');
(7,'WHOA','For that stuff that makes you say whoa, obviously','2018-09-03 08:15:35','2018-09-03 08:15:35');


-- This creates the posts table. The userId column references the id column of
-- users. If a user is deleted, the corresponding posts' userIds will be set NULL, and be retained in the database.
CREATE TABLE posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(300) DEFAULT NULL,
  url VARCHAR(2000) DEFAULT NULL,
  userId INT,
  subradditId INT,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  KEY userId (userId),
  KEY subradditId (subradditId),
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE SET NULL,
  FOREIGN KEY (subradditId) REFERENCES subraddits (id) ON DELETE CASCADE
);

CREATE TABLE votes (
  userId INT,
  postId INT,
  voteDirection TINYINT,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  PRIMARY KEY (userId, postId),
  KEY userId (userId),
  KEY postId (postId),
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (postId) REFERENCES posts (id) ON DELETE CASCADE
);


CREATE TABLE comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT,
  postId INT,
  text VARCHAR(10000),
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE SET NULL,
  FOREIGN KEY (postId) REFERENCES posts (id) ON DELETE CASCADE
);