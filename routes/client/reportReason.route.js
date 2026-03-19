const express = require("express");
const route = express.Router();

const checkAccessWithSecretKey = require("../../checkAccess");

const reportReasonController = require("../../controllers/client/reportReason.controller");

// Get all report reasons
route.get("/fetchReportReasons", checkAccessWithSecretKey(), reportReasonController.fetchReportReasons);

module.exports = route;
