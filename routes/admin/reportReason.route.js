const express = require("express");
const route = express.Router();

const checkAccessWithSecretKey = require("../../checkAccess");
const reportReasonController = require("../../controllers/admin/reportReason.controller");

// Create ReportReason
route.post("/createReportReason", checkAccessWithSecretKey(), reportReasonController.createReportReason);

// Update ReportReason
route.patch("/updateReportReason", checkAccessWithSecretKey(), reportReasonController.updateReportReason);

// Get ReportReasons
route.get("/getReportReasons", checkAccessWithSecretKey(), reportReasonController.getReportReasons);

// Delete ReportReason
route.delete("/deleteReportReason", checkAccessWithSecretKey(), reportReasonController.deleteReportReason);

module.exports = route;
