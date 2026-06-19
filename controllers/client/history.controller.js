const History = require("../../models/history.model");
const Host = require("../../models/host.model");
const User = require("../../models/user.model");
const Gift = require("../../models/gift.model");
const CoinPlan = require("../../models/coinPlan.model");
const VipPlan = require("../../models/vipPlan.model");
const VipPlanPrivilege = require("../../models/vipPlanPrivilege.model");

//generateHistoryUniqueId
const generateHistoryUniqueId = require("../../util/generateHistoryUniqueId");

const mongoose = require("mongoose");
const moment = require("moment");

const Razorpay = require("razorpay");

//get coin history ( user )
exports.getCoinTransactionRecords = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Access denied. Invalid authentication token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const search = req.query.search?.trim();

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);

      dateFilterQuery = {
        createdAt: {
          $gte: startDateObj,
          $lte: endDateObj,
        },
      };
    }

    const transactionHistory = await History.aggregate([
      {
        $match: {
          ...dateFilterQuery,
          type: { $nin: [5] },
          userId: userId,
          userCoin: { $ne: 0 },
        },
      },
      {
        $lookup: {
          from: "hosts",
          localField: "hostId",
          foreignField: "_id",
          as: "receiver",
          pipeline: [{ $project: { name: 1, image: 1, uniqueId: 1 } }],
        },
      },
      {
        $unwind: {
          path: "$receiver",
          preserveNullAndEmptyArrays: true,
        },
      },
      ...(search
        ? [
            {
              $match: {
                $or: [{ "receiver.name": { $regex: search, $options: "i" } }, { "receiver.uniqueId": { $regex: search, $options: "i" } }, { uniqueId: { $regex: search, $options: "i" } }],
              },
            },
          ]
        : []),
      {
        $addFields: {
          typeDescription: {
            $switch: {
              branches: [
                { case: { $eq: ["$type", 1] }, then: "Login Bonus" },
                { case: { $eq: ["$type", 2] }, then: "Live Gift" },
                { case: { $eq: ["$type", 3] }, then: "Video Call Gift" },
                { case: { $eq: ["$type", 6] }, then: "Daily Check-in Reward" },
                { case: { $eq: ["$type", 7] }, then: "Purchased Coin Plan" },
                { case: { $eq: ["$type", 8] }, then: "VIP Plan Purchase" },
                { case: { $eq: ["$type", 9] }, then: "Chat with Host" },
                { case: { $eq: ["$type", 10] }, then: "Chat Gift" },
                { case: { $eq: ["$type", 11] }, then: "Private Audio Call" },
                { case: { $eq: ["$type", 12] }, then: "Private Video Call" },
                { case: { $eq: ["$type", 13] }, then: "Random Video Call" },
              ],
              default: "Unknown Type",
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          uniqueId: 1,
          type: 1,
          typeDescription: 1,
          giftCoin: 1,
          giftCount: 1,
          userCoin: 1,
          payoutStatus: 1,
          createdAt: 1,
          receiverName: { $ifNull: ["$receiver.name", ""] },
          receiverImage: { $ifNull: ["$receiver.image", ""] },
          receiverUniqueId: { $ifNull: ["$receiver.uniqueId", ""] },
          isIncome: {
            $cond: {
              if: { $in: ["$type", [1, 6, 7, 8, 14]] },
              then: true,
              else: {
                $cond: {
                  if: {
                    $in: ["$type", [2, 3, 10, 11, 12, 13, 15]],
                  },
                  then: false,
                  else: false,
                },
              },
            },
          },
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: (start - 1) * limit },
      { $limit: limit },
    ]);

    return res.status(200).json({
      status: true,
      message: "Transaction history fetch successfully.",
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Something went wrong. Please try again later." });
  }
};

//get coin history ( host )
exports.retrieveHostCoinHistory = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid details." });
    }

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

    if (req.query.hostId && !mongoose.Types.ObjectId.isValid(req.query.hostId)) {
      return res.status(200).json({ status: false, message: "Invalid hostId. Please provide a valid ObjectId." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";
    const search = req.query.search?.trim();

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);

      dateFilterQuery = {
        createdAt: {
          $gte: startDateObj,
          $lte: endDateObj,
        },
      };
    }

    const transactionHistory = await History.aggregate([
      {
        $match: {
          ...dateFilterQuery,
          type: { $in: [2, 3, 5, 9, 10, 11, 12, 13] },
          hostId: hostId,
          hostCoin: { $ne: 0 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "sender",
          pipeline: [{ $project: { name: 1, image: 1, uniqueId: 1 } }],
        },
      },
      {
        $unwind: {
          path: "$sender",
          preserveNullAndEmptyArrays: true,
        },
      },
      ...(search
        ? [
            {
              $match: {
                $or: [{ "sender.name": { $regex: search, $options: "i" } }, { "sender.uniqueId": { $regex: search, $options: "i" } }, { uniqueId: { $regex: search, $options: "i" } }],
              },
            },
          ]
        : []),
      {
        $addFields: {
          typeDescription: {
            $switch: {
              branches: [
                { case: { $eq: ["$type", 2] }, then: "Live Gift" },
                { case: { $eq: ["$type", 3] }, then: "Video Call Gift" },
                { case: { $eq: ["$type", 5] }, then: "Withdrawal by Host" },
                { case: { $eq: ["$type", 9] }, then: "Chat with Host" },
                { case: { $eq: ["$type", 10] }, then: "Chat Gift" },
                { case: { $eq: ["$type", 11] }, then: "Private Audio Call" },
                { case: { $eq: ["$type", 12] }, then: "Private Video Call" },
                { case: { $eq: ["$type", 13] }, then: "Random Video Call" },
              ],
              default: "Unknown Type",
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          uniqueId: 1,
          type: 1,
          typeDescription: 1,
          giftCoin: 1,
          giftCount: 1,
          hostCoin: 1,
          payoutStatus: 1,
          createdAt: 1,
          senderName: { $ifNull: ["$sender.name", ""] },
          senderImage: { $ifNull: ["$sender.image", ""] },
          senderUniqueId: { $ifNull: ["$sender.uniqueId", ""] },
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: (start - 1) * limit },
      { $limit: limit },
    ]);

    return res.status(200).json({
      status: true,
      message: "Transaction history fetch successfully.",
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Something went wrong. Please try again later." });
  }
};

//coin deduct for fake content
exports.handleCoinTransaction = async (req, res) => {
  try {
    const { type } = req.body || {};

    if (!type) {
      return res.status(200).json({ status: false, message: "Transaction type is required." });
    }

    const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    if (type === "chatGift") {
      const { senderId, receiverId, giftId, giftCount } = req.body || {};

      if (!senderId || !receiverId || !giftId || !giftCount) {
        return res.status(200).json({ status: false, message: "Missing required fields for chatGift" });
      }

      if (giftId && !mongoose.Types.ObjectId.isValid(giftId)) {
        return res.status(200).json({ status: false, message: "Invalid giftId. Please provide a valid ObjectId." });
      }

      const [uniqueId, sender, receiver, gift] = await Promise.all([
        generateHistoryUniqueId(),
        User.findById(senderId).lean().select("_id name coin"),
        Host.findById(receiverId).lean().select("_id coin totalGifts"),
        Gift.findById(giftId).lean().select("_id coin image svgaImage type"),
      ]);

      if (!sender || !gift) return res.status(404).json({ status: false, message: "Invalid sender/receiver/gift" });

      const count = Number(giftCount);
      const totalCoin = gift.coin * count;

      if (sender.coin < totalCoin) {
        return res.status(200).json({ status: false, message: "Insufficient coins" });
      }

      await Promise.all([
        User.updateOne({ _id: sender._id }, { $inc: { coin: -totalCoin, spentCoins: totalCoin } }),
        History.create({
          uniqueId,
          type: 10,
          userId: sender._id,
          hostId: receiver._id,
          giftId: gift._id,
          giftCoin: gift.coin,
          giftImage: gift.image,
          giftsvgaImage: gift.svgaImage,
          giftType: gift.type,
          giftCount: count,
          userCoin: totalCoin,
          hostCoin: totalCoin,
          adminCoin: 0,
          agencyCoin: 0,
          date: now,
        }),
      ]);

      return res.status(200).json({ success: true, message: "Chat gift sent successfully" });
    } else if (type === "liveGift") {
      const { senderId, receiverId, giftId, giftCount } = req.body || {};

      if (!senderId || !receiverId || !giftId || !giftCount) return res.status(200).json({ status: false, message: "Missing required fields for liveGift" });

      if (giftId && !mongoose.Types.ObjectId.isValid(giftId)) {
        return res.status(200).json({ status: false, message: "Invalid giftId. Please provide a valid ObjectId." });
      }

      const [uniqueId, sender, receiver, gift] = await Promise.all([
        generateHistoryUniqueId(),
        User.findById(senderId).lean().select("_id coin"),
        Host.findById(receiverId).lean().select("_id coin totalGifts"),
        Gift.findById(giftId).lean().select("_id coin image type svgaImage"),
      ]);

      if (!sender || !receiver || !gift) {
        return res.status(404).json({ status: false, message: "Invalid sender/receiver/gift" });
      }

      const count = Number(giftCount);
      const totalCoin = gift.coin * count;

      if (sender.coin < totalCoin) {
        return res.status(200).json({ status: false, message: "Insufficient coins" });
      }

      await Promise.all([
        User.updateOne({ _id: sender._id }, { $inc: { coin: -totalCoin, spentCoins: totalCoin } }),
        History.create({
          uniqueId,
          type: 2,
          userId: sender._id,
          hostId: receiver._id,
          giftId: gift._id,
          giftCoin: gift.coin,
          giftImage: gift.image,
          giftsvgaImage: gift.svgaImage,
          giftType: gift.type,
          giftCount: count,
          userCoin: totalCoin,
          hostCoin: totalCoin,
          adminCoin: 0,
          agencyCoin: 0,
          date: now,
        }),
      ]);

      return res.status(200).json({ success: true, message: "Live gift sent successfully" });
    } else {
      return res.status(200).json({ status: false, message: "Invalid transaction type" });
    }
  } catch (error) {
    console.error("[handleCoinTransaction]status:false, message:", error);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};

//purchase plan through stripe (coinPlan / vipPlan) (web)
exports.purchasePlan = async (req, res) => {
  try {
    console.log("========== PURCHASE PLAN (STRIPE DIRECT) ==========");

    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        status: false,
        message: "Access denied. Invalid authentication token.",
      });
    }

    const { planId, planType, currency, billing_details, payment_method_id } = req.body || {};

    if (!planId || !planType || !currency || !billing_details || !payment_method_id) {
      return res.status(200).json({
        status: false,
        message: "planId, planType, currency, billing_details and payment_method_id are required.",
      });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const stripe = require("stripe")(settingJSON?.stripeSecretKey);

    const [uniqueId, user] = await Promise.all([generateHistoryUniqueId(), User.findById(userId).select("_id isVip isBlock").lean()]);

    if (!user) {
      return res.status(200).json({ status: false, message: "User not found." });
    }

    if (user.isBlock) {
      return res.status(200).json({ status: false, message: "You are blocked by admin." });
    }

    let plan, vipPrivilege;
    let finalPrice = 0;

    if (planType === "coinPlan") {
      plan = await CoinPlan.findById(planId).lean();
      if (!plan) return res.status(200).json({ status: false, message: "Coin plan not found." });

      finalPrice = plan.price;
    }

    if (planType === "vipPlan") {
      [plan, vipPrivilege] = await Promise.all([VipPlan.findById(planId).lean(), VipPlanPrivilege.findOne().select("topUpCoinBonus").lean()]);

      plan = await VipPlan.findById(planId).lean();
      if (!plan) return res.status(200).json({ status: false, message: "VIP plan not found." });

      finalPrice = plan.price;
    }

    if (!finalPrice || finalPrice <= 0) {
      return res.status(200).json({ status: false, message: "Invalid plan price." });
    }

    const customer = await stripe.customers.create({
      email: billing_details.email,
      name: billing_details.name,
      address: billing_details.address,
    });

    let intent = await stripe.paymentIntents.create({
      amount: finalPrice * 100,
      currency,
      customer: customer.id,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
      payment_method: payment_method_id,
      description: `${planType} purchase`,
    });

    intent = await stripe.paymentIntents.confirm(intent.id);
    console.log("Stripe Intent Status:", intent.status);

    if (intent.status === "requires_action" && intent.next_action?.type === "use_stripe_sdk") {
      return res.status(200).json({
        status: true,
        requires_action: true,
        client_secret: intent.client_secret,
      });
    }

    if (intent.status !== "succeeded") {
      return res.status(200).json({
        status: false,
        message: "Payment not completed.",
      });
    }

    if (planType === "coinPlan") {
      const totalCoins = user.isVip ? plan.coins + (plan.bonusCoins || 0) : plan.coins;

      await Promise.all([
        User.updateOne({ _id: userId }, { $inc: { coin: totalCoins, rechargedCoins: totalCoins } }),
        History.create({
          uniqueId,
          type: 7,
          userId,
          userCoin: totalCoins,
          bonusCoins: user.isVip ? plan.bonusCoins || 0 : 0,
          price: plan.price,
          paymentGateway: "Stripe",
          paymentIntentId: intent.id,
          date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
        }),
      ]);

      return res.status(200).json({
        status: true,
        message: "Coin plan purchased successfully.",
        client_secret: intent.client_secret,
      });
    }

    if (planType === "vipPlan") {
      const totalCoins = user.isVip ? plan.coin + (vipPrivilege?.topUpCoinBonus || 0) : plan.coin;

      const startDate = moment();
      let endDate = moment(startDate);

      switch (plan.validityType.toLowerCase()) {
        case "days":
          endDate.add(plan.validity, "days");
          break;
        case "months":
          endDate.add(plan.validity, "months");
          break;
        case "years":
          endDate.add(plan.validity, "years");
          break;
        default:
          return res.status(200).json({
            status: false,
            message: "Invalid validity type.",
          });
      }

      await Promise.all([
        User.updateOne(
          { _id: userId },
          {
            $set: {
              isVip: true,
              vipPlanStartDate: startDate.toISOString(),
              vipPlanEndDate: endDate.toISOString(),
              vipPlanId: plan._id,
              "vipPlan.validity": plan.validity,
              "vipPlan.validityType": plan.validityType,
              "vipPlan.amount": plan.amount,
            },
            $inc: {
              coin: totalCoins,
              rechargedCoins: totalCoins,
            },
          },
        ),
        History.create({
          uniqueId,
          type: 8,
          userId,
          userCoin: totalCoins,
          bonusCoins: user.isVip ? vipPrivilege?.topUpCoinBonus || 0 : 0,
          validity: plan.validity,
          validityType: plan.validityType,
          price: plan.price,
          paymentGateway: "Stripe",
          paymentIntentId: intent.id,
          date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
        }),
      ]);

      return res.status(200).json({
        status: true,
        message: "VIP plan purchased successfully.",
        client_secret: intent.client_secret,
      });
    }

    return res.status(200).json({
      status: false,
      message: "Invalid plan type.",
    });
  } catch (error) {
    console.error("PURCHASE PLAN ERROR:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Internal Server Error",
    });
  }
};

//create razorpay order (web)
exports.createRazorpayOrder = async (req, res) => {
  try {
    console.log("========== CREATE RAZORPAY ORDER ==========", req.body);

    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        status: false,
        message: "Access denied. Invalid authentication token.",
      });
    }

    let { amount, currency = "INR", receipt } = req.body || {};

    if (!amount || !receipt) {
      return res.status(200).json({
        status: false,
        message: "Amount and receipt are required.",
      });
    }

    amount = Number(amount);
    currency = currency?.toUpperCase() || "INR";

    if (isNaN(amount) || amount <= 0) {
      return res.status(200).json({
        status: false,
        message: "Invalid amount.",
      });
    }

    if (!settingJSON?.razorPayId || !settingJSON?.razorSecretKey) {
      return res.status(200).json({
        status: false,
        message: "Razorpay configuration not found.",
      });
    }

    const razorpay = new Razorpay({
      key_id: settingJSON.razorPayId,
      key_secret: settingJSON.razorSecretKey,
    });

    const options = {
      amount: amount * 100, // convert to paisa
      currency,
      receipt,
    };

    const order = await razorpay.orders.create(options);

    console.log("Razorpay Order Created:", order.id);

    return res.status(200).json({
      status: true,
      message: "Razorpay order created successfully.",
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
      },
    });
  } catch (error) {
    console.error("RAZORPAY ORDER ERROR:", error);

    return res.status(error.statusCode || 500).json({
      status: false,
      message: error?.error?.description || error.message || "Internal Server Error",
    });
  }
};
