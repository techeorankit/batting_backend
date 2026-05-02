//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const WithdrawalRequestController = require("../../controllers/admin/withdrawalRequest.controller");

const { checkPermission, MODULES } = require("../../middleware/checkPermission.middleware");

//get withdrawal requests ( hosts / agency )
route.get("/retrievePayoutRequests", checkPermission(MODULES.WITHDRAWAL), checkAccessWithSecretKey(), WithdrawalRequestController.retrievePayoutRequests);

//accept or decline withdrawal requests ( agency )
route.patch("/updateAgencyWithdrawalStatus", checkPermission(MODULES.WITHDRAWAL), checkAccessWithSecretKey(), WithdrawalRequestController.updateAgencyWithdrawalStatus);

module.exports = route;
