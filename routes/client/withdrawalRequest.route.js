//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const WithdrawalRequestController = require("../../controllers/client/withdrawalRequest.controller");

//validate user's access token
const validateUserToken = require("../../middleware/validateUserToken.middleware");

//withdrawal request ( host )
route.post("/submitWithdrawalRequest", validateUserToken, checkAccessWithSecretKey(), WithdrawalRequestController.submitWithdrawalRequest);

module.exports = route;
