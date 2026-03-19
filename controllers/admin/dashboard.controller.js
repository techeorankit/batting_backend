const Impression = require("../../models/impression.model");
const User = require("../../models/user.model");
const Host = require("../../models/host.model");
const Agency = require("../../models/agency.model");
const History = require("../../models/history.model");
const LiveBroadcaster = require("../../models/liveBroadcaster.model");
const WithdrawalRequest = require("../../models/withdrawalRequest.model");

//get dashboard count
exports.fetchDashboardMetrics = async (req, res) => {
  try {
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const s = new Date(startDate);
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);

      dateFilterQuery = {
        createdAt: { $gte: s, $lte: e },
      };
    }

    const revenueMatch = {
      ...dateFilterQuery,
      type: { $in: [7, 8] }, // coin + vip
    };

    const [userAgg, hostAgg, totalAgency, totalImpressions, totalCurrentLiveHosts, historyAgg, payoutAgg] = await Promise.all([
      User.aggregate([
        { $match: dateFilterQuery },
        {
          $facet: {
            totalUsers: [{ $count: "count" }],
            totalBlockedUsers: [{ $match: { isBlock: true } }, { $count: "count" }],
            totalVipUsers: [{ $match: { isVip: true } }, { $count: "count" }],
          },
        },
      ]),
      Host.aggregate([
        { $match: { status: { $in: [1, 2] } } },
        {
          $facet: {
            totalPendingHosts: [{ $match: { status: 1, agencyId: null } }, { $count: "count" }],
            totalHosts: [{ $match: { status: 2, isFake: false } }, { $count: "count" }],
            pendingPayoutLiability: [
              { $match: { status: 2, isFake: false } },
              {
                $group: {
                  _id: null,
                  pendingLiability: { $sum: { $subtract: ["$coin", "$redeemedCoins"] } },
                },
              },
            ],
          },
        },
      ]),
      Agency.countDocuments(dateFilterQuery),
      Impression.countDocuments(dateFilterQuery),
      LiveBroadcaster.countDocuments(dateFilterQuery),
      History.aggregate([
        {
          $facet: {
            revenue: [{ $match: revenueMatch }, { $group: { _id: null, totalRevenue: { $sum: "$price" } } }],
            coinsSold: [{ $match: revenueMatch }, { $group: { _id: null, coinsSold: { $sum: "$userCoin" } } }],
            adminCommission: [{ $match: dateFilterQuery }, { $group: { _id: null, totalAdmin: { $sum: "$adminCoin" } } }],
            hostEarnings: [{ $match: dateFilterQuery }, { $group: { _id: null, totalHost: { $sum: "$hostCoin" } } }],
          },
        },
      ]),
      WithdrawalRequest.aggregate([{ $match: { ...dateFilterQuery, status: 2, person: 2 } }, { $group: { _id: null, payoutCompleted: { $sum: "$coin" } } }]),
    ]);

    const totalUsers = userAgg[0].totalUsers[0]?.count || 0;
    const totalBlockedUsers = userAgg[0].totalBlockedUsers[0]?.count || 0;
    const totalVipUsers = userAgg[0].totalVipUsers[0]?.count || 0;

    const totalPendingHosts = hostAgg[0].totalPendingHosts[0]?.count || 0;
    const totalHosts = hostAgg[0].totalHosts[0]?.count || 0;
    const pendingPayoutLiability = hostAgg[0].pendingPayoutLiability[0]?.pendingLiability || 0;

    const metrics = historyAgg[0];
    const grossPaymentsCollected = metrics.revenue[0]?.totalRevenue || 0;
    const netPaymentsReceived = metrics.revenue[0]?.totalRevenue || 0; // gateway fees handled on UI
    const coinsSold = metrics.coinsSold[0]?.coinsSold || 0;
    const adminCommissionEarned = metrics.adminCommission[0]?.totalAdmin || 0;
    const hostEarningsGenerated = metrics.hostEarnings[0]?.totalHost || 0;

    const hostPayoutsCompleted = payoutAgg[0]?.payoutCompleted || 0;

    return res.status(200).json({
      status: true,
      message: "Admin dashboard metrics fetched successfully",
      data: {
        totalUsers,
        totalBlockedUsers,
        totalVipUsers,
        totalPendingHosts,
        totalHosts,
        totalAgency,
        totalImpressions,
        totalCurrentLiveHosts,
        grossPaymentsCollected,
        netPaymentsReceived,
        coinsSold,
        adminCommissionEarned,
        hostEarningsGenerated,
        hostPayoutsCompleted,
        pendingPayoutLiability,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: error.message || "Internal Server Error",
    });
  }
};

//get chat analytic
exports.retrieveChartStats = async (req, res) => {
  try {
    if (!req.query.type) {
      return res.status(200).json({ status: false, message: "type must be requried!" });
    }

    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";
    const type = req.query.type.trim().toLowerCase();

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

    if (type === "user") {
      const data = await User.aggregate([
        {
          $match: dateFilterQuery,
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      return res.status(200).json({ status: true, message: "Success", chartUser: data });
    } else if (type === "host") {
      const data = await Host.aggregate([
        {
          $match: { ...dateFilterQuery, status: 2 },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      return res.status(200).json({ status: true, message: "Success", chartHost: data });
    } else {
      return res.status(200).json({ status: false, message: "type must be passed valid." });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get new user
exports.getNewUsers = async (req, res) => {
  try {
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

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

    const filter = { ...dateFilterQuery };

    const users = await User.aggregate([
      { $match: filter },
      {
        $project: {
          _id: 1,
          uniqueId: 1,
          name: 1,
          email: 1,
          image: 1,
          countryFlagImage: 1,
          country: 1,
          gender: 1,
          coin: 1,
          isOnline: 1,
          loginType: 1,
          createdAt: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 10 },
    ]);

    return res.status(200).json({
      status: true,
      message: "Newly signed up users retrieved successfully!",
      data: users,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get top agency
exports.getTopPerformingAgencies = async (req, res) => {
  try {
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);

      dateFilterQuery.createdAt = {
        $gte: startDateObj,
        $lte: endDateObj,
      };
    }

    const filter = {
      ...dateFilterQuery,
      totalEarnings: { $gt: 0 },
    };

    const topAgencies = await Agency.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "hosts",
          localField: "_id",
          foreignField: "agencyId",
          as: "hosts",
        },
      },
      {
        $addFields: {
          hostsCount: { $size: "$hosts" },
          totalEarnings: { $round: ["$totalEarnings", 2] },
        },
      },
      {
        $project: {
          _id: 1,
          agencyCode: 1,
          name: 1,
          image: 1,
          commission: 1,
          countryFlagImage: 1,
          country: 1,
          totalEarnings: 1,
          createdAt: 1,
          hostsCount: 1,
        },
      },
      { $sort: { totalEarnings: -1 } },
      { $limit: 10 },
    ]);

    return res.status(200).json({
      status: true,
      message: "Top performing agencies retrieved successfully 🏆",
      data: topAgencies,
    });
  } catch (error) {
    console.error("Error fetching top performing agencies:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get top performing hosts
exports.getTopPerformingHosts = async (req, res) => {
  try {
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);

      dateFilterQuery.createdAt = {
        $gte: startDateObj,
        $lte: endDateObj,
      };
    }

    const filter = {
      ...dateFilterQuery,
      isFake: false,
      coin: { $gt: 0 },
    };

    const topHosts = await Host.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "agencies",
          localField: "agencyId",
          foreignField: "_id",
          as: "agency",
        },
      },
      {
        $unwind: {
          path: "$agency",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          uniqueId: 1,
          name: 1,
          image: 1,
          countryFlagImage: 1,
          country: 1,
          coin: 1,
          isOnline: 1,
          createdAt: 1,
          agencyName: { $ifNull: ["$agency.name", ""] },
        },
      },
      { $sort: { coin: -1 } },
      { $limit: 10 },
    ]);

    return res.status(200).json({
      status: true,
      message: "Top performing hosts retrieved successfully ✅",
      data: topHosts,
    });
  } catch (error) {
    console.error("Error fetching top performers:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Internal Server Error",
    });
  }
};

//get top spenders
exports.fetchTopSpenders = async (req, res) => {
  try {
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

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

    const topSpenders = await History.aggregate([
      {
        $match: {
          ...dateFilterQuery,
          type: { $in: [2, 3, 9, 10, 11, 12, 13] },
        },
      },
      {
        $group: {
          _id: "$userId",
          totalCoinsSpent: { $sum: "$userCoin" },
        },
      },
      {
        $sort: { totalCoinsSpent: -1 },
      },
      {
        $limit: 10,
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $project: {
          _id: 0,
          //userId: "$_id",
          totalCoinsSpent: 1,
          name: "$user.name",
          image: "$user.image",
          email: "$user.email",
          countryFlagImage: "$user.countryFlagImage",
          country: "$user.country",
          isVip: "$user.isVip",
        },
      },
    ]);

    return res.status(200).json({
      status: true,
      message: "Top spenders fetched successfully",
      data: topSpenders,
    });
  } catch (error) {
    console.error("Top Spenders Error:", error);
    return res.status(500).json({ status: false, message: "Something went wrong", error: error.message });
  }
};
