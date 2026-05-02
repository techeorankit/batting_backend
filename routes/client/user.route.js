//express
const express = require("express");
const route = express.Router();

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//validateFirebaseToken
const validateAuthToken = require("../../middleware/verifyAuthToken.middleware");

//validate user's access token
const validateUserToken = require("../../middleware/validateUserToken.middleware");

//controller
const UserController = require("../../controllers/client/user.controller");

//check the user is exists or not with loginType 3 quick (identity)
route.post("/quickUserVerification", checkAccessWithSecretKey(), UserController.quickUserVerification);

//user login or sign up
route.post("/signInOrSignUpUser", validateAuthToken, checkAccessWithSecretKey(), UserController.signInOrSignUpUser);

//update profile of the user
route.patch("/modifyUserProfile", validateUserToken, checkAccessWithSecretKey(), upload.single("image"), UserController.modifyUserProfile);

//get user profile
route.get("/retrieveUserProfile", validateUserToken, checkAccessWithSecretKey(), UserController.retrieveUserProfile);

//delete user
route.delete("/deactivateMyAccount", validateUserToken, checkAccessWithSecretKey(), UserController.deactivateMyAccount);

//get firebase UID using Device UUID
route.get("/fetchFirebaseUidByDevice", checkAccessWithSecretKey(), UserController.fetchFirebaseUidByDevice);

//create firebase Custom Token using Firebase UID
route.get("/createFirebaseCustomAuthToken", checkAccessWithSecretKey(), UserController.createFirebaseCustomAuthToken);

//sync user loginType using firebaseUid
route.patch("/syncUserAuthTypeByUid", checkAccessWithSecretKey(), UserController.syncUserAuthTypeByUid);

//check if mobile or email exists or not
route.get("/verifyMobileOrEmail", checkAccessWithSecretKey(), UserController.verifyMobileOrEmail);

module.exports = route;
