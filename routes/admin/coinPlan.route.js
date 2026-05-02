//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const CoinPlanController = require("../../controllers/admin/coinPlan.controller");

const { checkPermission, MODULES } = require("../../middleware/checkPermission.middleware");

//create a new coin plan
route.post("/createCoinPlan", checkPermission(MODULES.PLAN), checkAccessWithSecretKey(), CoinPlanController.createCoinPlan);

//update an existing coin plan
route.patch("/modifyCoinPlan", checkPermission(MODULES.PLAN), checkAccessWithSecretKey(), CoinPlanController.modifyCoinPlan);

//toggle coin plan status (isActive or isFeatured)
route.patch("/toggleCoinPlanStatus", checkPermission(MODULES.PLAN), checkAccessWithSecretKey(), CoinPlanController.toggleCoinPlanStatus);

//delete a coin plan
route.delete("/removeCoinPlan", checkPermission(MODULES.PLAN), checkAccessWithSecretKey(), CoinPlanController.removeCoinPlan);

//retrieve all coin plans
route.get("/fetchCoinPlans", checkPermission(MODULES.PLAN), checkAccessWithSecretKey(), CoinPlanController.fetchCoinPlans);

//get coinplan/vipPlan histories of users (admin earning)
route.get("/retrieveCoinPlanPurchase", checkAccessWithSecretKey(), CoinPlanController.retrieveCoinPlanPurchase);

module.exports = route;
