//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const ImpressionController = require("../../controllers/admin/impression.controller");

const { checkPermission, MODULES } = require("../../middleware/checkPermission.middleware");

//create Impression
route.post("/createImpression", checkPermission(MODULES.HOST_TAGS), checkAccessWithSecretKey(), ImpressionController.createImpression);

//update Impression
route.patch("/updateImpression", checkPermission(MODULES.HOST_TAGS), checkAccessWithSecretKey(), ImpressionController.updateImpression);

//get all Impressions
route.get("/getImpressions", checkPermission(MODULES.HOST_TAGS), checkAccessWithSecretKey(), ImpressionController.getImpressions);

//get all Impressions ( drop - down )
route.get("/fetchAdImpressionMetrics", checkPermission(MODULES.HOST_TAGS), checkAccessWithSecretKey(), ImpressionController.fetchAdImpressionMetrics);

//delete Impression
route.delete("/deleteImpression", checkPermission(MODULES.HOST_TAGS), checkAccessWithSecretKey(), ImpressionController.deleteImpression);

module.exports = route;
