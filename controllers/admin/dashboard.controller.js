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

//get chat analytic
exports.retrieveChartStats = async (req, res) => {
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

    if (req.query.type === "user") {
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
    } else if (req.query.type === "host") {
      const data = await Host.aggregate([
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

      return res.status(200).json({ status: true, message: "Success", chartHost: data });
    } else {
      return res.status(200).json({ status: false, message: "type must be passed valid." });
    }
  } catch (error) {
    console.log(error);
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
    return res.status(500).json({
      status: false,
      message: error.message || "Internal Server Error",
    });
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

    const [users] = await Promise.all([
      User.aggregate([
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
      ]),
    ]);

    return res.status(200).json({
      status: true,
      message: "Newly signed up users retrieved successfully!",
      data: users,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: error.message || "Internal Server Error",
    });
  }
};
