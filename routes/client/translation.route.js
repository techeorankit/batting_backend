const express = require("express");
const localizationController = require("../../controllers/client/translation.controller");

const router = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

router.use(checkAccessWithSecretKey());

// get single Language's translations
router.get("/getSingleLanguageTranslations", localizationController.getSingleLanguageTranslations);

// get all Languages and their translations
router.get("/getAllLanguagesTranslations", localizationController.getAllLanguagesTranslations);

// get latest version of global Language system
router.get("/getLatestVersionOfTranslations", localizationController.getLatestVersionOfTranslations);

// get all active Languages
router.get("/getAllActiveLanguages", localizationController.getAllActiveLanguages);

module.exports = router;