const express = require("express");
const route = express.Router();

const checkAccessWithSecretKey = require("../../checkAccess");
const reportController = require("../../controllers/admin/report.controller");

// Solve a report
route.patch("/solveUserHostReport", checkAccessWithSecretKey(), reportController.solveUserHostReport);

// Get all user-host reports
route.get("/getUserHostReports", checkAccessWithSecretKey(), reportController.getUserHostReports);

// Delete a report
route.delete("/deleteUserHostReport", checkAccessWithSecretKey(), reportController.deleteUserHostReport);

module.exports = route;
