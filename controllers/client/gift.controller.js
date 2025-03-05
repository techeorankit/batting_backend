const Gift = require("../../models/gift.model");

//get gifts
exports.fetchGiftList = async (req, res, next) => {
  try {
    const gift = await Gift.find().select("type image svgaImage coin createdAt").sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      status: true,
      message: "Retrive gifts.",
      data: gift,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
