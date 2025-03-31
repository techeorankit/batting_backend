//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const HostController = require("../../controllers/agency/host.controller");

//get agency wise host requests
route.get("/fetchHostRequestsByAgency", checkAccessWithSecretKey(), HostController.fetchHostRequestsByAgency);

//accept Or decline host request
route.patch("/manageHostRequest", checkAccessWithSecretKey(), HostController.manageHostRequest);

//get agency wise host
route.get("/retrieveAgencyHosts", checkAccessWithSecretKey(), HostController.retrieveAgencyHosts);

//handle block or not the host
route.patch("/modifyHostBlockStatus", checkAccessWithSecretKey(), HostController.modifyHostBlockStatus);

module.exports = route;
