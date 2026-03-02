const VipPlan = require("../../models/vipPlan.model");
const VipPlanPrivilege = require("../../models/vipPlanPrivilege.model");

//import model
const User = require("../../models/user.model");
const History = require("../../models/history.model");

//mongoose
const mongoose = require("mongoose");

//moment
const moment = require("moment");

//generateHistoryUniqueId
const generateHistoryUniqueId = require("../../util/generateHistoryUniqueId");

//get vipPlan
exports.fetchVipPlans = async (req, res) => {
  try {
    const vipPlans = await VipPlan.find({ isActive: true }).select("validity validityType coin price productId").sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      status: true,
      message: "VIP plans retrieved successfully",
      data: vipPlans,
    });
  } catch (error) {
    console.error("Error fetching VIP plans:", error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//purchase vipPlan ( vipPlan history )
exports.purchaseVipPlan = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const { vipPlanId, paymentGateway } = req.query;

    if (!vipPlanId || !paymentGateway) {
      return res.status(200).json({ status: false, message: "Missing required parameters: vipPlanId and paymentGateway." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const [uniqueId, user, vipPlan, vipPrivilege] = await Promise.all([
      generateHistoryUniqueId(),
      User.findById(userId).select("_id isVip vipPlanStartDate vipPlanEndDate vipPlan").lean(),
      VipPlan.findById(vipPlanId).select("_id validity validityType price coin").lean(),
      VipPlanPrivilege.findOne().select("topUpCoinBonus").lean(),
    ]);

    if (!user) {
      return res.json({ status: false, message: "User does not found." });
    }

    if (!vipPlan) {
      return res.status(200).json({ status: false, message: "VIP plan not found." });
    }

    const vipPlanStartDate = moment().toISOString();
    let planEndDate = moment(vipPlanStartDate);

    switch (vipPlan.validityType.toLowerCase()) {
      case "days":
        planEndDate.add(vipPlan.validity, "days");
        break;
      case "months":
        planEndDate.add(vipPlan.validity, "months");
        break;
      case "years":
        planEndDate.add(vipPlan.validity, "years");
        break;
      default:
        return res.status(200).json({ status: false, message: "Invalid validity type in VIP plan." });
    }

    res.status(200).json({
      status: true,
      message: "VIP plan purchased successfully.",
    });

    const totalCoins = user.isVip ? vipPlan.coin + (vipPrivilege?.topUpCoinBonus || 0) : vipPlan.coin;

    await Promise.all([
      User.updateOne(
        { _id: userId },
        {
          $set: {
            isVip: true,
            vipPlanStartDate,
            vipPlanEndDate: planEndDate.toISOString(),
            vipPlanId: vipPlan._id,
            "vipPlan.validity": vipPlan.validity,
            "vipPlan.validityType": vipPlan.validityType,
            "vipPlan.amount": vipPlan.amount,
          },
          $inc: {
            coin: totalCoins,
            rechargedCoins: totalCoins,
          },
        },
      ),
      History.create({
        uniqueId: uniqueId,
        type: 8,
        userId: user._id,
        userCoin: totalCoins,
        bonusCoins: user.isVip ? vipPrivilege?.topUpCoinBonus || 0 : 0,
        validity: vipPlan.validity,
        validityType: vipPlan.validityType,
        price: vipPlan.price,
        paymentGateway: paymentGateway.trim(),
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      }),
    ]);
  } catch (error) {
    console.log(error);
    return res.json({ status: false, error: error.message || "Internal Server Error" });
  }
};
