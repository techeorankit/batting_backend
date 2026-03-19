const express = require("express");
const router = express.Router();

const subAdminCtrl = require("../../controllers/admin/subAdmin.controller");
const validateAdminToken = require("../../middleware/verifyAdminAuthToken.middleware");

const checkAccessWithSecretKey = require("../../checkAccess");

router.use(checkAccessWithSecretKey());

// Create sub admin
router.post("/enlistSubAdmin", validateAdminToken, subAdminCtrl.enlistSubAdmin);

// Update Sub Admin
router.patch("/polishSubAdmin", validateAdminToken, subAdminCtrl.polishSubAdmin);

// Toggle Sub Admin Active Status
router.patch("/regulateSubAdminState", validateAdminToken, subAdminCtrl.regulateSubAdminState);

// Delete Sub Admin
router.delete("/expungeSubAdmin", validateAdminToken, subAdminCtrl.expungeSubAdmin);

// Get All Sub Admin
router.get("/trackSubAdmins", validateAdminToken, subAdminCtrl.trackSubAdmins);

// Login Sub Admin
router.post("/enterSubAdmin", subAdminCtrl.enterSubAdmin);

module.exports = router;
