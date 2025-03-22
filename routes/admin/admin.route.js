//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const AdminController = require("../../controllers/admin/admin.controller");

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//admin login
route.post("/validateAdminLogin", checkAccessWithSecretKey(), upload.single("image"), AdminController.validateAdminLogin);

//update admin profile
route.patch("/modifyAdminProfile", checkAccessWithSecretKey(), upload.single("image"), AdminController.modifyAdminProfile);

//get admin profile
route.get("/retrieveAdminProfile", checkAccessWithSecretKey(), AdminController.retrieveAdminProfile);

//send email ( forgot password )
route.patch("/sendPasswordResetRequest", checkAccessWithSecretKey(), AdminController.sendPasswordResetRequest);

//update password
route.patch("/modifyPassword", checkAccessWithSecretKey(), AdminController.modifyPassword);

//set Password
route.patch("/performPasswordReset", checkAccessWithSecretKey(), AdminController.performPasswordReset);

module.exports = route;
