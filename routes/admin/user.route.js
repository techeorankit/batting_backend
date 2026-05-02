//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const UserController = require("../../controllers/admin/user.controller");

const { checkPermission, MODULES } = require("../../middleware/checkPermission.middleware");

//get users
route.get("/retrieveUserList", checkPermission(MODULES.USER), checkAccessWithSecretKey(), UserController.retrieveUserList);

//toggle user's block status
route.patch("/modifyUserBlockStatus", checkPermission(MODULES.USER), checkAccessWithSecretKey(), UserController.modifyUserBlockStatus);

//get user's profile
route.get("/fetchUserProfile", checkPermission(MODULES.USER), checkAccessWithSecretKey(), UserController.fetchUserProfile);

//admin can add or deduct coins from a user's wallet
route.patch("/updateUserCoin", checkPermission(MODULES.USER), checkAccessWithSecretKey(), UserController.updateUserCoin);

module.exports = route;
