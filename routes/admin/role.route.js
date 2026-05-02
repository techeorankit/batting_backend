const express = require("express");
const router = express.Router();

const roleCtrl = require("../../controllers/admin/role.controller");
const validateAdminToken = require("../../middleware/verifyAdminAuthToken.middleware");

const checkAccessWithSecretKey = require("../../checkAccess");

router.use(checkAccessWithSecretKey());

/**
 * adminOnly — rejects any request from a staff (sub-admin) member.
 * Role & Staff management must be restricted to the super-admin only
 * to prevent privilege escalation attacks.
 */
const adminOnly = (req, res, next) => {
  if (req.admin) return next();
  return res.status(403).json({
    status: false,
    message: "Access denied. Only the super-admin can manage roles.",
  });
};

// Create Role
router.post("/appointRole", adminOnly, validateAdminToken, roleCtrl.appointRole);

// Update Role
router.patch("/customizeRole", adminOnly, validateAdminToken, roleCtrl.customizeRole);

// Get All Roles
router.get("/surveyRoles", adminOnly, validateAdminToken, roleCtrl.surveyRoles);

// Delete Role
router.delete("/obliterateRole", adminOnly, validateAdminToken, roleCtrl.obliterateRole);

// Get All Roles ( When Create Staff )
router.get("/eligibleRoleList", adminOnly, validateAdminToken, roleCtrl.eligibleRoleList);

// Toggle Role Active Status
router.patch("/moderateRoleState", adminOnly, validateAdminToken, roleCtrl.moderateRoleState);

module.exports = router;
