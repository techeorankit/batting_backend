//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const VIPPlanController = require("../../controllers/admin/vipPlan.controller");

const { checkPermission, MODULES } = require("../../middleware/checkPermission.middleware");

//create a new VIP plan
route.post("/createVipPlan", checkPermission(MODULES.PLAN), checkAccessWithSecretKey(), VIPPlanController.createVipPlan);

//update an existing VIP plan
route.patch("/updateVipPlan", checkPermission(MODULES.PLAN), checkAccessWithSecretKey(), VIPPlanController.updateVipPlan);

//toggle VIP plan status (isActive)
route.patch("/toggleVipPlanStatus", checkPermission(MODULES.PLAN), checkAccessWithSecretKey(), VIPPlanController.toggleVipPlanStatus);

//delete a VIP plan
route.delete("/deleteVipPlan", checkPermission(MODULES.PLAN), checkAccessWithSecretKey(), VIPPlanController.deleteVipPlan);

//retrieve all VIP plans
route.get("/getVipPlans", checkPermission(MODULES.PLAN), checkAccessWithSecretKey(), VIPPlanController.getVipPlans);

module.exports = route;
