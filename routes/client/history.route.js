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

module.exports = route;
