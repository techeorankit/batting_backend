//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const SettingController = require("../../controllers/admin/setting.controller");

//update setting
route.patch("/updateSetting", checkAccessWithSecretKey(), SettingController.updateSetting);

//update setting switch
route.patch("/updateSettingToggle", checkAccessWithSecretKey(), SettingController.updateSettingToggle);

//get setting
route.get("/fetchSettings", checkAccessWithSecretKey(), SettingController.fetchSettings);

//authorize purchase code
route.get("/authorizePurchaseCode", checkAccessWithSecretKey(), SettingController.authorizePurchaseCode);

module.exports = route;
