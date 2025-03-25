//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const GiftCategoryController = require("../../controllers/admin/giftCategory.controller");

//retrieve all giftCategories
route.get("/getAllGiftCategories", checkAccessWithSecretKey(), GiftCategoryController.getAllGiftCategories);

module.exports = route;
                                                                                                                                                                                                                                                    