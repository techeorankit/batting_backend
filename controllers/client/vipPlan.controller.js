const VipPlan = require("../../models/vipPlan.model");

//get vipPlan
exports.fetchVipPlans = async (req, res) => {
  try {
    const vipPlans = await VipPlan.find({ isActive: true }).select("validity validityType coin price").sort({ createdAt: -1 }).lean();

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
