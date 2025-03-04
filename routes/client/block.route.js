//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const BlockController = require("../../controllers/client/block.controller");

//validate user's access token
const validateUserToken = require("../../middleware/validateUserToken.middleware");

//Handle user blocking a host
route.post("/blockHost", validateUserToken, checkAccessWithSecretKey(), BlockController.blockHost);

//Handle host blocking a user
route.post("/blockUser", checkAccessWithSecretKey(), BlockController.blockUser);

//Get Blocked Hosts for a User
route.get("/getBlockedHostsForUser", validateUserToken, checkAccessWithSecretKey(), BlockController.getBlockedHostsForUser);

//Get Blocked Users for a Host
route.get("/getBlockedUsersForHost", checkAccessWithSecretKey(), BlockController.getBlockedUsersForHost);

module.exports = route;
