const express = require("express");
const app = express.Router();
var db = require("../models");

app.get("/users", function(req, res, next) {
  next();
});
    
app.get("/users/dashboard", function(req, res) {
  db.Example.findOne({ where: { id: req.params.id } }).then(function(dbExample) {
    res.render("example", {
      example: dbExample
    });
  });
});
  
    // Load example page and pass in an example by id
app.get("/users/profile", function(req, res) {
  db.Example.findOne({ where: { id: req.params.id } }).then(function(dbExample) {
    res.render("profile", {
      example: dbExample
    });
  });
});

module.exports = app;