//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const VipPlanPrivilegeController = require("../../controllers/admin/vipPlanPrivilege.controller");

//update VIP Plan Privilege
route.patch("/modifyVipPrivilege", checkAccessWithSecretKey(), VipPlanPrivilegeController.modifyVipPrivilege);

//get VIP Plan Privilege
route.get("/retrieveVipPrivilege", checkAccessWithSecretKey(), VipPlanPrivilegeController.retrieveVipPrivilege);

module.exports = route;
