//express
const express = require("express");
const route = express.Router();

//validate user's access token
const validateAdminToken = require("../../middleware/verifyAdminAuthToken.middleware");

//require admin's route.js
const admin = require("./admin.route");
const setting = require("./setting.route");
const impression = require("./impression.route");
const giftCategory = require("./giftCategory.route");
const gift = require("./gift.route");
const vipPlanPrivilege = require("./vipPlanPrivilege.route");
const host = require("./host.route");
const dashboard = require("./dashboard.route");
const agency = require("./agency.route");
const block = require("./block.route");
const user = require("./user.route");
const followerFollowing = require("./followerFollowing.route");
const coinPlan = require("./coinPlan.route");
const vipPlan = require("./vipPlan.route");
const identityProof = require("./identityProof.route");
const paymentMethod = require("./paymentMethod.route");

//exports admin's route.js
route.use("/admin", admin);
route.use("/setting", validateAdminToken, setting);
route.use("/impression", validateAdminToken, impression);
route.use("/giftCategory", validateAdminToken, giftCategory);
route.use("/gift", validateAdminToken, gift);
route.use("/vipPlanPrivilege", validateAdminToken, vipPlanPrivilege);
route.use("/host", validateAdminToken, host);
route.use("/dashboard", validateAdminToken, dashboard);
route.use("/agency", validateAdminToken, agency);
route.use("/block", validateAdminToken, block);
route.use("/user", validateAdminToken, user);
route.use("/followerFollowing", validateAdminToken, followerFollowing);
route.use("/coinPlan", coinPlan);
route.use("/vipPlan", vipPlan);
route.use("/identityProof", identityProof);
route.use("/paymentMethod", paymentMethod);

module.exports = route;
