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

// create Language
route.post("/createSingleLanguage", upload.single("languageIcon"), languageController.createSingleLanguage);

// get all languages
route.get("/getLanguages", languageController.getLanguages);

// get single Lnaguage
route.get("/getALanguage", languageController.getALanguage);

// update Language
route.patch("/updateSingleLanguage", upload.single("languageIcon"), languageController.updateSingleLanguage);

// toggle isActive and isDefault switch
route.patch("/toggleTheSwitch", languageController.toggleTheSwitch);

// delete Language and its Translations
route.delete("/deleteTheLanguage", languageController.deleteTheLanguage);

module.exports = route;