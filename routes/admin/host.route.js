//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const HostController = require("../../controllers/admin/host.controller");

//retrive host requests
route.get("/fetchHostRequest", checkAccessWithSecretKey(), HostController.fetchHostRequest);

//accept Or decline host request
route.patch("/handleHostRequest", checkAccessWithSecretKey(), HostController.handleHostRequest);

//handle block or not the host
route.patch("/toggleHostBlockStatus", checkAccessWithSecretKey(), HostController.toggleHostBlockStatus);

module.exports = route;
