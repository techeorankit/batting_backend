//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//controller
const HostController = require("../../controllers/admin/host.controller");

const { checkPermission, MODULES } = require("../../middleware/checkPermission.middleware");

//retrive host requests
route.get("/fetchHostRequest", checkPermission(MODULES.HOST_REQUEST), checkAccessWithSecretKey(), HostController.fetchHostRequest);

//accept Or decline host request
route.patch("/handleHostRequest", checkPermission(MODULES.HOST_REQUEST), checkAccessWithSecretKey(), HostController.handleHostRequest);

//assign host under agency
route.patch("/assignHostToAgency", checkPermission(MODULES.HOST_REQUEST), checkAccessWithSecretKey(), HostController.assignHostToAgency);

//get agency's hosts
route.get("/listAgencyHosts", checkPermission(MODULES.HOST), checkAccessWithSecretKey(), HostController.listAgencyHosts);

//create host
route.post(
  "/createHost",
  checkPermission(MODULES.HOST),
  checkAccessWithSecretKey(),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "photoGallery", maxCount: 20 },
    { name: "video", maxCount: 20 },
    { name: "liveVideo", maxCount: 20 },
    { name: "profileVideo", maxCount: 20 },
  ]),
  HostController.createHost,
);

//update host
route.patch(
  "/updateHost",
  checkPermission(MODULES.HOST),
  checkAccessWithSecretKey(),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "photoGallery", maxCount: 20 },
    { name: "video", maxCount: 20 },
    { name: "liveVideo", maxCount: 20 },
    { name: "profileVideo", maxCount: 20 },
  ]),
  HostController.updateHost,
);

//toggle host status
route.patch("/toggleHostStatusByType", checkPermission(MODULES.HOST), checkAccessWithSecretKey(), HostController.toggleHostStatusByType);

//get host's profile
route.get("/fetchHostProfile", checkPermission(MODULES.HOST), checkAccessWithSecretKey(), HostController.fetchHostProfile);

//get hosts
route.get("/fetchHostList", checkPermission(MODULES.HOST), checkAccessWithSecretKey(), HostController.fetchHostList);

//delete host
route.delete("/deleteHost", checkPermission(MODULES.HOST), checkAccessWithSecretKey(), HostController.deleteHost);

module.exports = route;
