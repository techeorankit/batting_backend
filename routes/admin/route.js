//express
const express = require("express");
const route = express.Router();

//validate user's access token
const validateAdminToken = require("../../middleware/verifyAdminAuthToken.middleware");

//require admin's route.js
const admin = require("./admin.route");
const setting = require("./setting.route");
const giftCategory = require("./giftCategory.route");
const gift = require("./gift.route");
const vipPlanPrivilege = require("./vipPlanPrivilege.route");
const host = require("./host.route");
const dashboard = require("./dashboard.route");

//exports admin's route.js
route.use("/admin", admin);
route.use("/setting", validateAdminToken, setting);
route.use("/giftCategory", validateAdminToken, giftCategory);
route.use("/gift", validateAdminToken, gift);
route.use("/vipPlanPrivilege", validateAdminToken, vipPlanPrivilege);
route.use("/host", validateAdminToken, host);
route.use("/dashboard", validateAdminToken, dashboard);

module.exports = route;
