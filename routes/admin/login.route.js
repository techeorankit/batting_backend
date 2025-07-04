const express = require("express");
const route = express.Router();

const LoginController = require("../../controllers/admin/login.controller");

//get login or not
route.get("/", LoginController.get);

module.exports = route;
