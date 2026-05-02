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

const { checkPermission, MODULES } = require("../../middleware/checkPermission.middleware");

//create language
route.post("/createSingleLanguage", checkPermission(MODULES.APP_LANGUAGES), upload.single("languageIcon"), languageController.createSingleLanguage);

//get all languages
route.get("/getLanguages", checkPermission(MODULES.APP_LANGUAGES), languageController.getLanguages);

//get single language
route.get("/getALanguage", checkPermission(MODULES.APP_LANGUAGES), languageController.getALanguage);

//update language
route.patch("/updateSingleLanguage", checkPermission(MODULES.APP_LANGUAGES), upload.single("languageIcon"), languageController.updateSingleLanguage);

//toggle isActive and isDefault switch
route.patch("/toggleTheSwitch", checkPermission(MODULES.APP_LANGUAGES), languageController.toggleTheSwitch);

//delete language and its translations
route.delete("/deleteTheLanguage", checkPermission(MODULES.APP_LANGUAGES), languageController.deleteTheLanguage);

//get all language names (dropdown)
route.get("/getAllLanguageNames", languageController.getAllLanguageNames);

module.exports = route;
