//express
const express = require("express");
const route = express.Router();

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const languageController = require("../../controllers/admin/language.controller");

route.use(checkAccessWithSecretKey());

// create language
route.post("/createSingleLanguage", upload.single("languageIcon"), languageController.createSingleLanguage);

// get all languages
route.get("/getLanguages", languageController.getLanguages);

// get single language
route.get("/getALanguage", languageController.getALanguage);

// update language
route.patch("/updateSingleLanguage", upload.single("languageIcon"), languageController.updateSingleLanguage);

// toggle isActive and isDefault switch
route.patch("/toggleTheSwitch", languageController.toggleTheSwitch);

// delete language and its translations
route.delete("/deleteTheLanguage", languageController.deleteTheLanguage);

// get all language names for dropdown
route.get("/getAllLanguageNames", languageController.getAllLanguageNames);

module.exports = route;
