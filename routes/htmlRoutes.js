var db = require("../models");
const express = require("express");
const app = express.Router();

app.get("/", function(req, res) {
  db.Example.findAll({}).then(function(dbExamples) {
    res.render("index", {
      msg: "Welcome!",
      examples: dbExamples
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
