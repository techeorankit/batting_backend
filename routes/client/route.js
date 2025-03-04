//express
const express = require("express");
const route = express.Router();

//validate user's access token
const validateUserToken = require("../../middleware/validateUserToken.middleware");

//require client's route.js
const user = require("./user.route");
const host = require("./host.route");
const followerFollowing = require("./followerFollowing.route");
const block = require("./block.route");
const dailyRewardCoin = require("./dailyRewardCoin.route");

//exports client's route.js
route.use("/user", user);
route.use("/host", host);
route.use("/followerFollowing", followerFollowing);
route.use("/block", block);
route.use("/dailyRewardCoin", dailyRewardCoin);

module.exports = route;
