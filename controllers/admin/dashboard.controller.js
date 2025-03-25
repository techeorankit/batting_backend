const Impression = require("../../models/impression.model");
const User = require("../../models/user.model");
const Host = require("../../models/host.model");
const Agency = require("../../models/agency.model");

//get dashboard count
exports.fetchDashboardMetrics = async (req, res) => {
  try {
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const formatStartDate = new Date(startDate);
      const formatEndDate = new Date(endDate);
      formatEndDate.setHours(23, 59, 59, 999);

      dateFilterQuery = {
        createdAt: {
          $gte: formatStartDate,
          $lte: formatEndDate,
        },
      };
    }

    const [totalUsers, totalBlockedUsers, totalVipUsers, totalPendingHosts, totalHosts, totalAgency, totalImpressions] = await Promise.all([
      User.countDocuments(dateFilterQuery),
      User.countDocuments({ ...dateFilterQuery, isBlock: true }),
      User.countDocuments({ ...dateFilterQuery, isVip: true }),
      Host.countDocuments({ ...dateFilterQuery, status: 1 }),
      Host.countDocuments({ ...dateFilterQuery, status: 2 }),
      Agency.countDocuments({ ...dateFilterQuery }),
      Impression.countDocuments({ ...dateFilterQuery }),
    ]);

    return res.status(200).json({
      status: true,
      message: "Get admin panel dashboard count.",
      data: {
        totalUsers,
        totalBlockedUsers,
        totalVipUsers,
        totalPendingHosts,
        totalHosts,
        totalAgency,
        totalImpressions,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(200).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
