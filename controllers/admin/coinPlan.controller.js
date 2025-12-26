const CoinPlan = require("../../models/coinPlan.model");
const History = require("../../models/history.model");

const mongoose = require("mongoose");

//create a new coin plan
exports.createCoinPlan = async (req, res) => {
  try {
    const { coins, bonusCoins, price, iconUrl, productId } = req.body;

    if (!coins || !price || !productId) {
      return res.status(200).json({ status: false, message: "Invalid details provided." });
    }

    const coinPlan = new CoinPlan({ coins, bonusCoins, price, iconUrl, productId });
    await coinPlan.save();

    return res.status(200).json({ status: true, message: "Coin plan created successfully.", data: coinPlan });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//update an existing coin plan
exports.modifyCoinPlan = async (req, res) => {
  try {
    const { coinPlanId } = req.body;
    if (!coinPlanId) {
      return res.status(200).json({ status: false, message: "coinPlanId is required." });
    }

    const coinPlan = await CoinPlan.findById(coinPlanId).lean();
    if (!coinPlan) {
      return res.status(200).json({ status: false, message: "CoinPlan not found." });
    }

    const updateFields = {
      coins: req.body.coins !== undefined ? Number(req.body.coins) : coinPlan.coins,
      bonusCoins: req.body.bonusCoins !== undefined ? Number(req.body.bonusCoins) : coinPlan.bonusCoins,
      price: req.body.price !== undefined ? Number(req.body.price) : coinPlan.price,
      iconUrl: req.body.iconUrl || coinPlan.iconUrl,
      productId: req.body.productId || coinPlan.productId,
    };

    const updatedCoinPlan = await CoinPlan.findByIdAndUpdate(coinPlanId, updateFields, {
      new: true,
      select: "coins bonusCoins price iconUrl productId isActive isFeatured",
      lean: true,
    });

    return res.status(200).json({ status: true, message: "Coin plan updated successfully.", data: updatedCoinPlan });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//toggle coin plan status (isActive or isFeatured)
exports.toggleCoinPlanStatus = async (req, res) => {
  try {
    const { coinPlanId, field } = req.query;

    if (!coinPlanId || !["isActive", "isFeatured"].includes(field)) {
      return res.status(200).json({ status: false, message: "Valid coinPlanId and field (isActive or isFeatured) are required." });
    }

    const coinPlan = await CoinPlan.findById(coinPlanId).select("isActive isFeatured").lean();
    if (!coinPlan) {
      return res.status(200).json({ status: false, message: "CoinPlan not found." });
    }

    const updateField = field === "isActive" ? { isActive: !coinPlan.isActive } : { isFeatured: !coinPlan.isFeatured };
    const updatedCoinPlan = await CoinPlan.findByIdAndUpdate(coinPlanId, updateField, { new: true }).lean();

    return res.status(200).json({ status: true, message: "Coin plan status updated successfully.", data: updatedCoinPlan });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//delete a coin plan
exports.removeCoinPlan = async (req, res) => {
  try {
    const { coinPlanId } = req.query;
    if (!coinPlanId) {
      return res.status(200).json({ status: false, message: "coinPlanId is required." });
    }

    const coinPlan = await CoinPlan.findById(coinPlanId).select("_id").lean();
    if (!coinPlan) {
      return res.status(200).json({ status: false, message: "CoinPlan not found." });
    }

    res.status(200).json({ status: true, message: "Coin plan deleted successfully." });

    await CoinPlan.deleteOne({ _id: coinPlanId });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//retrieve all coin plans
exports.fetchCoinPlans = async (req, res) => {
  try {
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const coinPlans = await CoinPlan.find()
      .select("coins bonusCoins price iconUrl productId isActive isFeatured")
      .sort({ coins: 1, price: 1 })
      .skip((start - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({ status: true, message: "Coin plans retrieved successfully.", data: coinPlans });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get coinplan histories of users (admin earning)
exports.retrieveUserPurchaseRecords = async (req, res) => {
  try {
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const startDate = req?.query?.startDate || "All";
    const endDate = req?.query?.endDate || "All";

    const purchaseType = parseInt(req.query.type);

    if (![7, 8].includes(purchaseType)) {
      return res.status(400).json({ status: false, message: "Invalid purchase type. Allowed values: 7 (Coin), 8 (VIP)" });
    } //Accept purchase type dynamically (7 = Coin, 8 = VIP)

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const formatStartDate = new Date(startDate);
      const formatEndDate = new Date(endDate);
      formatEndDate.setHours(23, 59, 59, 999);

      dateFilterQuery.createdAt = {
        $gte: formatStartDate,
        $lte: formatEndDate,
      };
    }

    const baseFilter = {
      ...dateFilterQuery,
      type: purchaseType,
      price: { $exists: true, $ne: 0 },
    };

    if (req.query.userId && mongoose.Types.ObjectId.isValid(req.query.userId)) {
      baseFilter.userId = new mongoose.Types.ObjectId(req.query.userId);
    }

    const [adminEarnings, total, history] = await Promise.all([
      History.aggregate([{ $match: baseFilter }, { $group: { _id: null, totalEarnings: { $sum: "$price" } } }]).then((result) => (result.length > 0 ? result[0].totalEarnings : 0)),
      History.countDocuments(baseFilter),
      History.aggregate([
        { $match: baseFilter },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        {
          $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true },
        },
        {
          $group: {
            _id: "$userDetails._id",
            name: { $first: "$userDetails.name" },
            userName: { $first: "$userDetails.userName" },
            uniqueId: { $first: "$userDetails.uniqueId" },
            image: { $first: "$userDetails.image" },
            totalPlansPurchased: { $sum: 1 },
            totalPriceSpent: { $sum: "$price" },
            // coinPlanPurchase: {
            //   $push: {
            //     coin: "$userCoin",
            //     uniqueId: "$uniqueId",
            //     paymentGateway: "$paymentGateway",
            //     price: "$price",
            //     date: "$date",
            //   },
            // },
          },
        },
        { $sort: { totalPlansPurchased: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
      ]),
    ]);

    return res.status(200).json({
      status: true,
      message: "User coin plan transactions retrieved successfully.",
      adminEarnings,
      total: total || 0,
      data: history || [],
    });
  } catch (error) {
    console.error("Error fetching coin plan transactions:", error);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};

//get coinplan histories of users (admin earning)
exports.retrieveCoinPlanPurchase = async (req, res) => {
  try {
    const page = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const skip = (page - 1) * limit;

    const purchaseType = parseInt(req.query.type); // 7 = Coin, 8 = VIP

    if (![7, 8].includes(purchaseType)) {
      return res.status(400).json({
        status: false,
        message: "Invalid purchase type. Allowed values: 7 (Coin), 8 (VIP)",
      });
    }

    const matchQuery = {
      type: purchaseType,
      price: { $exists: true, $ne: 0 },
    };

    if (req.query.userId && mongoose.Types.ObjectId.isValid(req.query.userId)) {
      matchQuery.userId = new mongoose.Types.ObjectId(req.query.userId);
    }

    const [totalRecords, records] = await Promise.all([
      History.countDocuments(matchQuery),
      History.aggregate([
        { $match: matchQuery },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            coin: "$userCoin",
            uniqueId: "$uniqueId",
            paymentGateway: "$paymentGateway",
            price: "$price",
            date: "$date",
          },
        },
      ]),
    ]);

    return res.status(200).json({
      status: true,
      message: "Purchase records retrieved successfully.",
      totalRecords,
      data: records,
    });
  } catch (error) {
    console.error("Error fetching purchase pagination:", error);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};
