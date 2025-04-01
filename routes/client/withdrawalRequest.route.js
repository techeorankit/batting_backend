//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const WithdrawalRequestController = require("../../controllers/client/withdrawalRequest.controller");

//withdrawal request ( user )
route.post("/submitWithdrawalRequest", checkAccessWithSecretKey(), WithdrawalRequestController.submitWithdrawalRequest);

module.exports = route;
