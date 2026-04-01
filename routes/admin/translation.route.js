const express = require("express");
const router = express.Router();

const localizationController = require("../../controllers/admin/translation.controller");
const checkAccessWithSecretKey = require("../../checkAccess");

const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

router.use(checkAccessWithSecretKey());

// create Translations for languages using CSV file
router.post(
  "/uploadMultipleTranslations",
  upload.single("file"),
  localizationController.uploadMultipleTranslations
);

// Update specific key-value pairs for a language
router.patch("/updateTranslationsOfSingleLanguage", localizationController.updateTranslationsOfSingleLanguage);

// download all translations as CSV file
router.get("/downloadAllTranslationsCSV", localizationController.downloadAllTranslationsCSV);

// get single Language's translations
router.get("/getSingleLanguageTranslations", localizationController.getSingleLanguageTranslations);


module.exports = router;