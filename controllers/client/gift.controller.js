const Gift = require("../../models/gift.model");

//get gifts grouped by category
exports.fetchGiftList = async (req, res, next) => {
  try {
    const giftsByCategory = await Gift.aggregate([
      {
        $lookup: {
          from: "giftcategories",
          localField: "giftCategoryId",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: "$giftCategoryId",
          categoryName: { $first: "$category.name" },
          gifts: {
            $push: {
              _id: "$_id",
              type: "$type",
              image: "$image",
              svgaImage: "$svgaImage",
              coin: "$coin",
              createdAt: "$createdAt",
            },
          },
        },
      },
      { $sort: { "gifts.createdAt": -1 } },
    ]);

    return res.status(200).json({
      status: true,
      message: "Retrieved gifts by category.",
      data: giftsByCategory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
