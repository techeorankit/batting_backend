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

//exports admin's route.js
route.use("/admin", admin);
route.use("/setting", setting);
route.use("/giftCategory", giftCategory);
route.use("/gift", gift);

module.exports = route;
