//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const AgencyController = require("../../controllers/admin/agency.controller");

const { checkPermission, MODULES } = require("../../middleware/checkPermission.middleware");

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//create agency
route.post("/createAgency", checkPermission(MODULES.AGENCY), checkAccessWithSecretKey(), upload.single("image"), AgencyController.createAgency);

//update agency
route.patch("/updateAgency", checkPermission(MODULES.AGENCY), checkAccessWithSecretKey(), upload.single("image"), AgencyController.updateAgency);

//toggle agency block status
route.patch("/toggleAgencyBlockStatus", checkPermission(MODULES.AGENCY), checkAccessWithSecretKey(), AgencyController.toggleAgencyBlockStatus);

//get agencies
route.get("/getAgencies", checkPermission(MODULES.AGENCY), checkAccessWithSecretKey(), AgencyController.getAgencies);

//delete agency
route.delete("/deleteAgency", checkPermission(MODULES.AGENCY), checkAccessWithSecretKey(), AgencyController.deleteAgency);

//get agency list ( when assign host under agency )
route.get("/getActiveAgenciesList", checkAccessWithSecretKey(), AgencyController.getActiveAgenciesList);

module.exports = route;
