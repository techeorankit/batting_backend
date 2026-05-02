const express = require("express");
const route = express.Router();

const checkAccessWithSecretKey = require("../../checkAccess");
const reportController = require("../../controllers/admin/report.controller");

const { checkPermission, MODULES } = require("../../middleware/checkPermission.middleware");

//Solve a report
route.patch("/solveUserHostReport", checkPermission(MODULES.REPORT), checkAccessWithSecretKey(), reportController.solveUserHostReport);

//Get all user-host reports
route.get("/getUserHostReports", checkPermission(MODULES.REPORT), checkAccessWithSecretKey(), reportController.getUserHostReports);

//Delete a report
route.delete("/deleteUserHostReport", checkPermission(MODULES.REPORT), checkAccessWithSecretKey(), reportController.deleteUserHostReport);

module.exports = route;
