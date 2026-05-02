//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

const { checkPermission, MODULES } = require("../../middleware/checkPermission.middleware");

//controller
const GiftCategoryController = require("../../controllers/admin/giftCategory.controller");

//create giftCategory
route.post("/createGiftCategory", checkPermission(MODULES.GIFT_CATEGORY), checkAccessWithSecretKey(), GiftCategoryController.createGiftCategory);

//update giftCategory
route.patch("/updateGiftCategory", checkPermission(MODULES.GIFT_CATEGORY), checkAccessWithSecretKey(), GiftCategoryController.updateGiftCategory);

//retrieve all giftCategories
route.get("/getAllGiftCategories", checkPermission(MODULES.GIFT_CATEGORY), checkAccessWithSecretKey(), GiftCategoryController.getAllGiftCategories);

//retrieve all giftCategories ( drop-down )
route.get("/listGiftCategories", checkPermission(MODULES.GIFT_CATEGORY), checkAccessWithSecretKey(), GiftCategoryController.listGiftCategories);

//delete giftCategory
route.delete("/deleteGiftCategory", checkPermission(MODULES.GIFT_CATEGORY), checkAccessWithSecretKey(), GiftCategoryController.deleteGiftCategory);

module.exports = route;
