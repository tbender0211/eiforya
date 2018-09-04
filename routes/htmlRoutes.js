var db = require("../models");
var path = __dirname + "/views/";

module.exports = function(app) {
  
  const express = require("express");
  const app = express.Router();
  
  // Routes for menu
  app.get("/", function(req, res) {
    res.sendFile(path + "index");
  });

  app.get("/favorites", function(req, res) {
    res.sendFile(path + "favorites");
  });

  app.get("/post", function(req, res) {
    res.sendFile(path + "post");
  });

  // Load index page
  app.get("/", function(req, res) {
    db.Example.findAll({}).then(function(dbExamples) {
      res.render("index", {
        msg: "Welcome!",
        examples: dbExamples
      });

app.get("/", function(req, res) {
  db.Example.findAll({}).then(function(dbExamples) {
    res.render("index", {
      msg: "Welcome!",
      examples: dbExamples
    });
  });
});

  app.get("/favorites", function(req, res) {
    db.Example.findAll({}).then(function(dbExamples) {
      res.render("favorites", {
        msg: "See your faves!",
        examples: dbExamples
      });
    });
  });

  app.get("/post", function(req, res) {
    db.Example.findAll({}).then(function() {
      res.render("post", {
        msg: "Create a new post!"
      });
    });
  });

  // Load example page and pass in an example by id
app.get("/example/", function(req, res) {
  db.Example.findOne({ where: { id: req.params.id } }).then(function(dbExample) {
    res.render("example", {
      example: dbExample
    });
  });
});

module.exports = app;
