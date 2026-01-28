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

    const [total, coinPlans] = await Promise.all([
      CoinPlan.countDocuments(),
      CoinPlan.find()
        .select("coins bonusCoins price iconUrl productId isActive isFeatured")
        .sort({ coins: 1, price: 1 })
        .skip((start - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({ status: true, message: "Coin plans retrieved successfully.", total, data: coinPlans });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get coinplan histories of users (admin earning)
exports.retrieveUserPurchaseRecords = async (req, res) => {
  try {
    const start = parseInt(req.query.start) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";
    const search = req.query.search?.trim();
    const purchaseType = parseInt(req.query.type);

    if (![7, 8].includes(purchaseType)) {
      return res.status(400).json({
        status: false,
        message: "Invalid purchase type. Allowed values: 7 (Coin), 8 (VIP)",
      });
    }

    let dateFilter = {};
    if (startDate !== "All" && endDate !== "All") {
      const from = new Date(startDate);
      const to = new Date(endDate);
      to.setHours(23, 59, 59, 999);
      dateFilter.createdAt = { $gte: from, $lte: to };
    }

    const baseFilter = {
      ...dateFilter,
      type: purchaseType,
      price: { $exists: true, $ne: 0 },
    };

    if (req.query.userId && mongoose.Types.ObjectId.isValid(req.query.userId)) {
      baseFilter.userId = new mongoose.Types.ObjectId(req.query.userId);
    }

    const result = await History.aggregate([
      { $match: baseFilter },
      {
        $lookup: {
          from: "users",
          let: { userId: "$userId" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$_id", "$$userId"] },
              },
            },
            {
              $project: {
                _id: 1,
                name: 1,
                userName: 1,
                uniqueId: 1,
                image: 1,
              },
            },
          ],
          as: "userDetails",
        },
      },
      { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } },

      ...(search
        ? [
            {
              $match: {
                $or: [
                  { "userDetails.name": { $regex: search, $options: "i" } },
                  { "userDetails.userName": { $regex: search, $options: "i" } },
                  { "userDetails.uniqueId": { $regex: search, $options: "i" } },
                ],
              },
            },
          ]
        : []),

      {
        $facet: {
          adminEarnings: [
            {
              $group: {
                _id: null,
                totalEarnings: { $sum: "$price" },
              },
            },
          ],

          total: [{ $group: { _id: "$userDetails._id" } }, { $count: "count" }],

          data: [
            {
              $group: {
                _id: "$userDetails._id",
                name: { $first: "$userDetails.name" },
                userName: { $first: "$userDetails.userName" },
                uniqueId: { $first: "$userDetails.uniqueId" },
                image: { $first: "$userDetails.image" },
                transactionId: { $first: "$uniqueId" },
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
          ],
        },
      },
    ]);

    return res.status(200).json({
      status: true,
      message: "User purchase transactions retrieved successfully.",
      adminEarnings: result[0].adminEarnings[0]?.totalEarnings || 0,
      total: result[0].total[0]?.count || 0,
      data: result[0].data || [],
    });
  } catch (error) {
    console.error("Purchase history API error:", error);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};

//get coinplan histories of users (admin earning)
exports.retrieveCoinPlanPurchase = async (req, res) => {
  try {
    const page = parseInt(req.query.start) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim();
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

    const result = await History.aggregate([
      { $match: matchQuery },

      ...(search
        ? [
            {
              $match: {
                $or: [{ uniqueId: { $regex: search, $options: "i" } }, { paymentGateway: { $regex: search, $options: "i" } }, { userCoin: { $regex: search, $options: "i" } }],
              },
            },
          ]
        : []),

      { $sort: { createdAt: -1 } },

      {
        $facet: {
          totalRecords: [{ $count: "count" }],

          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                coin: "$userCoin",
                uniqueId: "$uniqueId",
                paymentGateway: 1,
                price: 1,
                date: 1,
              },
            },
          ],
        },
      },
    ]);

    return res.status(200).json({
      status: true,
      message: "Purchase records retrieved successfully.",
      totalRecords: result[0].totalRecords[0]?.count || 0,
      data: result[0].data || [],
    });
  } catch (error) {
    console.error("Error fetching purchase pagination:", error);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};
