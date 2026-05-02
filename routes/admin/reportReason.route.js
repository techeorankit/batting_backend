const express = require("express");
const route = express.Router();

const checkAccessWithSecretKey = require("../../checkAccess");
const reportReasonController = require("../../controllers/admin/reportReason.controller");

const { checkPermission, MODULES } = require("../../middleware/checkPermission.middleware");

// Create ReportReason
route.post("/createReportReason", checkPermission(MODULES.REPORT_REASON), checkAccessWithSecretKey(), reportReasonController.createReportReason);

// Update ReportReason
route.patch("/updateReportReason", checkPermission(MODULES.REPORT_REASON), checkAccessWithSecretKey(), reportReasonController.updateReportReason);

// Get ReportReasons
route.get("/getReportReasons", checkPermission(MODULES.REPORT_REASON), checkAccessWithSecretKey(), reportReasonController.getReportReasons);

// Delete ReportReason
route.delete("/deleteReportReason", checkPermission(MODULES.REPORT_REASON), checkAccessWithSecretKey(), reportReasonController.deleteReportReason);

module.exports = route;
