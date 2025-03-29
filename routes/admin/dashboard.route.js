//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const DashboardController = require("../../controllers/admin/dashboard.controller");

//get dashboard count
route.get("/fetchDashboardMetrics", checkAccessWithSecretKey(), DashboardController.fetchDashboardMetrics);

module.exports = route;
                                                                                                                                                                                                                                                    