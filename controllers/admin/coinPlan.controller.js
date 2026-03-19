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

    const result = await CoinPlan.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],
          data: [
            {
              $project: {
                coins: 1,
                bonusCoins: 1,
                price: 1,
                iconUrl: 1,
                productId: 1,
                isActive: 1,
                isFeatured: 1,
              },
            },
            { $sort: { coins: 1, price: 1 } },
            { $skip: (start - 1) * limit },
            { $limit: limit },
          ],
        },
      },
    ]);

    const total = result[0].total[0]?.count || 0;
    const coinPlans = result[0].data;

    return res.status(200).json({ status: true, message: "Coin plans retrieved successfully.", total, data: coinPlans });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get coinplan/vipPlan histories (admin earning)
exports.retrieveCoinPlanPurchase = async (req, res) => {
  try {
    const page = parseInt(req.query.start) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";
    const search = req.query.search?.trim();
    const purchaseType = req.query.type || ""; // 7 = Coin, 8 = VIP
    const paymentGateway = req.query.paymentGateway || "";

    if (purchaseType.trim().toLowerCase() !== "all") {
      if (![7, 8].includes(parseInt(purchaseType))) {
        return res.status(200).json({ status: false, message: "Invalid purchase type. Allowed values: 7 (Coin), 8 (VIP) and all" });
      }
    }

    let dateFilter = {};
    if (startDate !== "All" && endDate !== "All") {
      const from = new Date(startDate);
      const to = new Date(endDate);
      to.setHours(23, 59, 59, 999);
      dateFilter.createdAt = { $gte: from, $lte: to };
    }

    const matchQuery = {
      ...dateFilter,
      price: { $exists: true, $ne: 0 },
    };

    if (req.query.userId && mongoose.Types.ObjectId.isValid(req.query.userId)) {
      matchQuery.userId = new mongoose.Types.ObjectId(req.query.userId);
    }

    if (purchaseType.trim().toLowerCase() !== "all") {
      matchQuery.type = parseInt(purchaseType);
    }

    if (paymentGateway?.trim()) {
      matchQuery.paymentGateway = paymentGateway;
    }

    const result = await History.aggregate([
      { $match: matchQuery },

      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          pipeline: [
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
                  { uniqueId: { $regex: search, $options: "i" } },
                  { paymentGateway: { $regex: search, $options: "i" } },
                  { "userDetails.name": { $regex: search, $options: "i" } },
                  { "userDetails.userName": { $regex: search, $options: "i" } },
                  { "userDetails.uniqueId": { $regex: search, $options: "i" } },
                ],
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
                uniqueId: "$uniqueId",
                coin: "$userCoin",
                bonusCoins: 1,
                paymentGateway: 1,
                price: 1,
                date: 1,
                type: 1,
                userDetails: 1,
                createdAt: 1,
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
