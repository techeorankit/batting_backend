const express = require('express');
const route = express.Router();
const checkAccessWithSecretKey = require('../../checkAccess');
const AdminController = require('../../controllers/admin/admin.controller');
const multer = require('multer');
const storage = require('../../util/multer');
const upload = multer({ storage: storage });
const validateAdminToken = require('../../middleware/verifyAdminAuthToken.middleware');

route.post('/registerAdmin', checkAccessWithSecretKey(), AdminController.registerAdmin);
route.post('/adminLogin', validateAdminToken, checkAccessWithSecretKey(), AdminController.adminLogin);
route.patch('/modifyAdminProfile', checkAccessWithSecretKey(), validateAdminToken, upload.single('image'), AdminController.modifyAdminProfile);
route.get('/retrieveAdminProfile', checkAccessWithSecretKey(), validateAdminToken, AdminController.getAdminProfile);
route.patch('/modifyPassword', checkAccessWithSecretKey(), validateAdminToken, AdminController.modifyAdminPassword);
route.patch('/performPasswordReset', checkAccessWithSecretKey(), validateAdminToken, AdminController.performPasswordReset);
route.get('/validateAdminEmail', checkAccessWithSecretKey(), AdminController.validateAdminEmail);

module.exports = route;