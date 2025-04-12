//express
const express = require("express");
const route = express.Router();

//validate agency's access token
const validateAgencyToken = require("../../middleware/validateAgencyToken.middleware");

//require agency's route.js
const agency = require("./agency.route");
const paymentMethod = require("./paymentMethod.route");
const host = require("./host.route");
const history = require("./history.route");
const liveBroadcastHistory = require("./liveBroadcastHistory.route");
const withdrawalRequest = require("./withdrawalRequest.route");

//exports agency's route.js
route.use("/", agency);
route.use("/paymentMethod", paymentMethod);
route.use("/host", host);
route.use("/history", history);
route.use("/liveBroadcastHistory", liveBroadcastHistory);
route.use("/withdrawalRequest", withdrawalRequest);

module.exports = route;
