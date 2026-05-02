//express
const express = require("express");
const route = express.Router();

//checkAccessWithSecretKey
const checkAccessWithSecretKey = require("../../checkAccess");

//controller
const GiftController = require("../../controllers/admin/gift.controller");

const { checkPermission, MODULES } = require("../../middleware/checkPermission.middleware");

//multer
const multer = require("multer");
const storage = require("../../util/multer");
const upload = multer({ storage });

//create gift
route.post(
  "/addGift",
  checkPermission(MODULES.GIFT),
  checkAccessWithSecretKey(),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "svgaImage", maxCount: 1 },
  ]),
  GiftController.addGift,
);

//update gift
route.patch(
  "/modifyGift",
  checkPermission(MODULES.GIFT),
  checkAccessWithSecretKey(),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "svgaImage", maxCount: 1 },
  ]),
  GiftController.modifyGift,
);

//get gifts
route.get("/retrieveGifts", checkPermission(MODULES.GIFT), checkAccessWithSecretKey(), GiftController.retrieveGifts);

//delete gift
route.delete("/discardGift", checkPermission(MODULES.GIFT), checkAccessWithSecretKey(), GiftController.discardGift);

module.exports = route;
