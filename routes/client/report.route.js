//express
const express = require("express");
const route = express.Router();

const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const reportController = require("../../controllers/client/report.controller");

// Submit report
route.post("/submitReport", checkAccessWithSecretKey(), reportController.submitReport);

module.exports = route;
