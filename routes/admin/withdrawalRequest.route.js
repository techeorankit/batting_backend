//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const WithdrawalRequestController = require("../../controllers/admin/withdrawalRequest.controller");

//get withdrawal requests ( users / hosts / agency )
route.get("/retrievePayoutRequests", checkAccessWithSecretKey(), WithdrawalRequestController.retrievePayoutRequests);

//accept or decline withdrawal requests ( user )
route.patch("/modifyWithdrawalStatus", checkAccessWithSecretKey(), WithdrawalRequestController.modifyWithdrawalStatus);

//accept or decline withdrawal requests ( agency )
route.patch("/updateAgencyWithdrawalStatus", checkAccessWithSecretKey(), WithdrawalRequestController.updateAgencyWithdrawalStatus);

module.exports = route;
