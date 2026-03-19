const express = require("express");
const router = express.Router();

const roleCtrl = require("../../controllers/admin/role.controller");
const validateAdminToken = require("../../middleware/verifyAdminAuthToken.middleware");

const checkAccessWithSecretKey = require("../../checkAccess");

router.use(checkAccessWithSecretKey());

// Create Role
router.post("/appointRole", validateAdminToken, roleCtrl.appointRole);

// Update Role
router.patch("/customizeRole", validateAdminToken, roleCtrl.customizeRole);

// Get All Roles
router.get("/surveyRoles", validateAdminToken, roleCtrl.surveyRoles);

// Delete Role
router.delete("/obliterateRole", validateAdminToken, roleCtrl.obliterateRole);

// Get All Roles ( When Create Staff )
router.get("/eligibleRoleList", validateAdminToken, roleCtrl.eligibleRoleList);

// Toggle Role Active Status
router.patch("/moderateRoleState", validateAdminToken, roleCtrl.moderateRoleState);

module.exports = router;
