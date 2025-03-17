//express
const express = require("express");
const route = express.Router();

//validate user's access token
//const validateAdminToken = require("../../middleware/verifyAdminAuthToken.middleware");

//require admin's route.js
const setting = require("./setting.route");

//exports admin's route.js
route.use("/setting", setting);

module.exports = route;
