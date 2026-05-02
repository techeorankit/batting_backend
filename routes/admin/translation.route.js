const express = require("express");
const router = express.Router();

const localizationController = require("../../controllers/admin/translation.controller");
const checkAccessWithSecretKey = require("../../checkAccess");

const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

router.use(checkAccessWithSecretKey());

const { checkPermission, MODULES } = require("../../middleware/checkPermission.middleware");

// create Translations for languages using CSV file
router.post("/uploadMultipleTranslations", checkPermission(MODULES.APP_LANGUAGES), upload.single("file"), localizationController.uploadMultipleTranslations);

// update specific key-value pairs for a language
router.patch("/updateTranslationsOfSingleLanguage", checkPermission(MODULES.APP_LANGUAGES), localizationController.updateTranslationsOfSingleLanguage);

// download all translations as CSV file
router.get("/downloadAllTranslationsCSV", checkPermission(MODULES.APP_LANGUAGES), localizationController.downloadAllTranslationsCSV);

// get single Language's translations
router.get("/getSingleLanguageTranslations", checkPermission(MODULES.APP_LANGUAGES), localizationController.getSingleLanguageTranslations);

module.exports = router;
