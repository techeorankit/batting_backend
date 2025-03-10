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

//host request ( user )
route.post(
  "/initiateHostRequest",
  validateUserToken,
  checkAccessWithSecretKey(),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "identityProof", maxCount: 1 },
    { name: "photoGallery", maxCount: 10 },
  ]),
  HostController.initiateHostRequest
);

//get host's request status ( user )
route.get("/verifyHostRequestStatus", validateUserToken, checkAccessWithSecretKey(), HostController.verifyHostRequestStatus);

//get country wise host thumblist ( user )
route.get("/retrieveHosts", validateUserToken, checkAccessWithSecretKey(), HostController.retrieveHosts);

//get host profile ( host )
route.get("/fetchHostInfo", validateUserToken, checkAccessWithSecretKey(), HostController.fetchHostInfo);

module.exports = route;
