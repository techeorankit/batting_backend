//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const MessageController = require("../../controllers/admin/message.controller");

//create message
route.post("/insertMessage", checkAccessWithSecretKey(), MessageController.insertMessage);

//update message
route.patch("/updateMessage", checkAccessWithSecretKey(), MessageController.updateMessage);

//get message
route.get("/fetchMessage", checkAccessWithSecretKey(), MessageController.fetchMessage);

module.exports = route;
