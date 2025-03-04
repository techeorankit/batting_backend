const Gift = require("../../models/gift.model");
const History = require("../../models/history.model");

//fs
const fs = require("fs");

//deletefile
const { deleteFiles } = require("../../util/deletefile");

//create gift
exports.addGift = async (req, res, next) => {
  try {
    if (!req.body.type) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Oops ! Invalid details." });
    }

    const gift = new Gift();
    gift.type = req?.body?.type;
    gift.image = req.files?.image ? req.files.image[0].path : gift.image;
    gift.svgaImage = req?.body?.type == 3 && req.files?.svgaImage ? req.files.svgaImage[0].path : gift.svgaImage;
    gift.coin = req?.body?.coin;
    await gift.save();

    return res.status(200).json({ status: true, message: "Gift has been created by the admin.", data: gift });
  } catch (error) {
    if (req.files) deleteFiles(req.files);
    console.log(error);
    return res.status(200).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//update gift
exports.modifyGift = async (req, res, next) => {
  try {
    if (!req.query.giftId) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "giftId must be required." });
    }

    const gift = await Gift.findById(req.query.giftId);
    if (!gift) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "gift does not found." });
    }

    gift.type = req.body.type ? req.body.type : gift.type;
    gift.coin = req.body.coin ? req.body.coin : gift.coin;

    if (req.files.image) {
      if (gift.image) {
        const image = gift?.image?.split("storage");
        if (image) {
          if (fs.existsSync("storage" + image[1])) {
            fs.unlinkSync("storage" + image[1]);
          }
        }
      }

      gift.image = req.files.image ? req.files.image[0].path : gift.image;
    }

    if (req.body.type == 3 && req.files.svgaImage) {
      if (gift.svgaImage) {
        const svgaImage = gift?.svgaImage?.split("storage");
        if (svgaImage) {
          if (fs.existsSync("storage" + svgaImage[1])) {
            fs.unlinkSync("storage" + svgaImage[1]);
          }
        }
      }

      gift.svgaImage = req.files.svgaImage ? req.files.svgaImage[0].path : gift.svgaImage;
    }

    await gift.save();

    return res.status(200).json({ status: true, message: "Gift has been updated by the admin.", data: gift });
  } catch (error) {
    if (req.files) deleteFiles(req.files);
    console.log(error);
    return res.status(200).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get gifts
exports.retrieveGifts = async (req, res, next) => {
  try {
    const gift = await Gift.find().select("image svgaImage coin createdAt").sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      status: true,
      message: "Retrive gifts for the admin.",
      data: gift,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//delete gift
exports.discardGift = async (req, res, next) => {
  try {
    if (!req.query.giftId) {
      return res.status(200).json({ status: false, message: "giftId must be required." });
    }

    const gift = await Gift.findById(req.query.giftId).select("_id").lean();
    if (!gift) {
      return res.status(200).json({ status: false, message: "gift does not found." });
    }

    res.status(200).json({ status: true, message: "Gift has been deleted by the admin." });

    if (gift.image) {
      const image = gift?.image?.split("storage");
      if (image) {
        if (fs.existsSync("storage" + image[1])) {
          fs.unlinkSync("storage" + image[1]);
        }
      }
    }

    if (gift.svgaImage) {
      const svgaImage = gift?.svgaImage?.split("storage");
      if (svgaImage) {
        if (fs.existsSync("storage" + svgaImage[1])) {
          fs.unlinkSync("storage" + svgaImage[1]);
        }
      }
    }

    await History.deleteMany({ giftId: gift._id });
    await Gift.deleteOne({ _id: gift._id });
  } catch (error) {
    return res.status(200).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
