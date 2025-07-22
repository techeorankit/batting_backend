//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//validate user's access token
const validateUserToken = require("../../middleware/validateUserToken.middleware");

//controller
const SettingController = require("../../controllers/client/setting.controller");

//get setting
route.get("/retrieveAppSettings", validateUserToken, checkAccessWithSecretKey(), SettingController.retrieveAppSettings);

module.exports = route;
