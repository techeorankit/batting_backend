const express = require("express");
const route = express.Router();

//Controller
const coinplanController = require("../../controllers/client/coinPlan.controller");

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//get coinplan
route.get("/getCoinPackage", checkAccessWithSecretKey(), coinplanController.getCoinPackage);

//purchase coinPlan ( coinPlan history )
route.post("/recordCoinPlanPurchase", checkAccessWithSecretKey(), coinplanController.recordCoinPlanPurchase);

module.exports = route;
