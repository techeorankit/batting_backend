//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const HistoryController = require("../../controllers/client/history.controller");

//validate user's access token
const validateUserToken = require("../../middleware/validateUserToken.middleware");

//get coin history ( user )
route.get("/getCoinTransactionRecords", checkAccessWithSecretKey(), validateUserToken, HistoryController.getCoinTransactionRecords);

//get coin history ( host )
route.get("/retrieveHostCoinHistory", checkAccessWithSecretKey(), HistoryController.retrieveHostCoinHistory);

//coin deduct for fake content
route.post("/handleCoinTransaction", checkAccessWithSecretKey(), HistoryController.handleCoinTransaction);

//purchase plan through stripe (coinPlan / vipPlan) (web)
route.post("/purchasePlan", checkAccessWithSecretKey(), validateUserToken, HistoryController.purchasePlan);

//create razorpay order (web)
route.post("/createRazorpayOrder", checkAccessWithSecretKey(), validateUserToken, HistoryController.createRazorpayOrder);

module.exports = route;
