const express = require("express");
const router = express.Router();

const subAdminCtrl = require("../../controllers/admin/subAdmin.controller");
const validateAdminToken = require("../../middleware/verifyAdminAuthToken.middleware");

const checkAccessWithSecretKey = require("../../checkAccess");

router.use(checkAccessWithSecretKey());

/**
 * adminOnly — rejects any request from a staff (sub-admin) member.
 * Staff management must be restricted to the super-admin only
 * to prevent privilege escalation attacks.
 */
const adminOnly = (req, res, next) => {
  if (req.admin) return next();
  return res.status(403).json({
    status: false,
    message: "Access denied. Only the super-admin can manage staff members.",
  });
};

// Create sub admin
router.post("/enlistSubAdmin", adminOnly, validateAdminToken, subAdminCtrl.enlistSubAdmin);

// Update Sub Admin
router.patch("/polishSubAdmin", adminOnly, validateAdminToken, subAdminCtrl.polishSubAdmin);

// Toggle Sub Admin Active Status
router.patch("/regulateSubAdminState", adminOnly, validateAdminToken, subAdminCtrl.regulateSubAdminState);

// Delete Sub Admin
router.delete("/expungeSubAdmin", adminOnly, validateAdminToken, subAdminCtrl.expungeSubAdmin);

// Get All Sub Admin
router.get("/trackSubAdmins", adminOnly, validateAdminToken, subAdminCtrl.trackSubAdmins);

// Login Sub Admin
router.post("/enterSubAdmin", subAdminCtrl.enterSubAdmin);

module.exports = router;
