//express
const express = require("express");
const route = express.Router();

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const VipPlanPrivilegeController = require("../../controllers/admin/vipPlanPrivilege.controller");

const { checkPermission, MODULES } = require("../../middleware/checkPermission.middleware");

//update VIP Plan Privilege
route.patch("/modifyVipPrivilege", checkPermission(MODULES.VIP_PLAN_BENEFITS), checkAccessWithSecretKey(), upload.single("vipFrameBadge"), VipPlanPrivilegeController.modifyVipPrivilege);

//get VIP Plan Privilege
route.get("/retrieveVipPrivilege", checkPermission(MODULES.VIP_PLAN_BENEFITS), checkAccessWithSecretKey(), VipPlanPrivilegeController.retrieveVipPrivilege);

module.exports = route;
