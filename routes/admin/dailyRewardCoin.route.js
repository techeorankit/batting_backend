//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const DailyRewardCoinController = require("../../controllers/admin/dailyRewardCoin.controller");

const { checkPermission, MODULES } = require("../../middleware/checkPermission.middleware");

//create daily reward
route.post("/createDailyReward", checkPermission(MODULES.DAILY_CHECKIN), checkAccessWithSecretKey(), DailyRewardCoinController.createDailyReward);

//update daily reward
route.patch("/modifyDailyReward", checkPermission(MODULES.DAILY_CHECKIN), checkAccessWithSecretKey(), DailyRewardCoinController.modifyDailyReward);

//get daily reward
route.get("/fetchDailyReward", checkPermission(MODULES.DAILY_CHECKIN), checkAccessWithSecretKey(), DailyRewardCoinController.fetchDailyReward);

//delete daily reward
route.delete("/removeDailyReward", checkPermission(MODULES.DAILY_CHECKIN), checkAccessWithSecretKey(), DailyRewardCoinController.removeDailyReward);

module.exports = route;
