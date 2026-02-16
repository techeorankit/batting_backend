//express
const express = require("express");
const route = express.Router();

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const HostController = require("../../controllers/client/host.controller");

//validate user's access token
const validateUserToken = require("../../middleware/validateUserToken.middleware");

//get impression list
route.get("/getPersonalityImpressions", checkAccessWithSecretKey(), HostController.getPersonalityImpressions);

//validate agencyCode ( user )
route.get("/validateAgencyCode", checkAccessWithSecretKey(), HostController.validateAgencyCode);

//host request ( user )
route.post(
  "/initiateHostRequest",
  validateUserToken,
  checkAccessWithSecretKey(),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "identityProof", maxCount: 2 },
    { name: "photoGallery", maxCount: 10 },
    { name: "profileVideo", maxCount: 10 },
  ]),
  HostController.initiateHostRequest,
);

//get host's request status ( user )
route.get("/verifyHostRequestStatus", validateUserToken, checkAccessWithSecretKey(), HostController.verifyHostRequestStatus);

//get host thumblist ( user )
route.get("/retrieveHosts", checkAccessWithSecretKey(), HostController.retrieveHosts);

//get host profile ( user )
route.get("/retrieveHostDetails", checkAccessWithSecretKey(), HostController.retrieveHostDetails);

//get random free host ( random video call ) ( user )
route.get("/retrieveAvailableHost", validateUserToken, checkAccessWithSecretKey(), HostController.retrieveAvailableHost);

//get host profile ( host )
route.get("/fetchHostInfo", checkAccessWithSecretKey(), HostController.fetchHostInfo);

//update host's info ( host )
route.patch(
  "/modifyHostDetails",
  checkAccessWithSecretKey(),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "identityProof", maxCount: 2 },
    { name: "photoGallery", maxCount: 10 },
    { name: "profileVideo", maxCount: 10 },
  ]),
  HostController.modifyHostDetails,
);

//get host thumblist ( host )
route.get("/fetchHostsList", checkAccessWithSecretKey(), HostController.fetchHostsList);

//get random fake host ( user ) ( auto call )
route.get("/getRandomAvailableFakeHost", validateUserToken, checkAccessWithSecretKey(), HostController.getRandomAvailableFakeHost);

//get user ( host ) ( auto call )
route.get("/getRandomAvailableUser", validateUserToken, checkAccessWithSecretKey(), HostController.getRandomAvailableUser);

//delete host
route.delete("/disableHostAccount", checkAccessWithSecretKey(), HostController.disableHostAccount);

module.exports = route;
