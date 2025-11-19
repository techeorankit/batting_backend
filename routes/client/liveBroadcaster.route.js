//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const LiveBroadcasterController = require("../../controllers/client/liveBroadcaster.controller");

//live host
route.post("/HostStreaming", checkAccessWithSecretKey(), LiveBroadcasterController.HostStreaming);

module.exports = route;
