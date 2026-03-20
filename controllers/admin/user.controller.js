const User = require("../../models/user.model");
const History = require("../../models/history.model");

const mongoose = require("mongoose");

const generateHistoryUniqueId = require("../../util/generateHistoryUniqueId");

//get users
exports.retrieveUserList = async (req, res) => {
  try {
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const searchString = req.query.search || "";
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    const genderFilter = req.query.gender || "";
    const isVipFilter = req.query.isVip || false;
    const isBlockFilter = req.query.isBlock || false;
    const isOnlineFilter = req.query.isOnline || false;
    const isBusyFilter = req.query.isBusy || false;
    const isHostFilter = req.query.isHost || false;
    const countryFilter = req?.query?.country?.trim().toLowerCase() || "";

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

    let searchQuery = {};
    if (searchString !== "All" && searchString !== "") {
      searchQuery = {
        $or: [{ name: { $regex: searchString, $options: "i" } }, { email: { $regex: searchString, $options: "i" } }, { uniqueId: { $regex: searchString, $options: "i" } }],
      };
    }

    let filter = {
      ...dateFilterQuery,
      ...searchQuery,
    };

    if (genderFilter) {
      filter.gender = genderFilter;
    }

    if (isVipFilter) {
      filter.isVip = isVipFilter === "true";
    }

    if (isBlockFilter) {
      filter.isBlock = isBlockFilter === "true";
    }

    if (isOnlineFilter) {
      filter.isOnline = isOnlineFilter === "true";
    }

    if (isBusyFilter) {
      filter.isBusy = isBusyFilter === "true";
    }

    if (isHostFilter) {
      filter.isHost = isHostFilter === "true";
    }

    if (countryFilter) {
      filter.country = { $regex: `^${countryFilter}$`, $options: "i" };
    }

    const result = await User.aggregate([
      {
        $facet: {
          // totalActiveUsers: [{ $match: { isBlock: false, ...dateFilterQuery } }, { $count: "count" }],
          // totalVIPUsers: [{ $match: { isVip: true, ...dateFilterQuery } }, { $count: "count" }],
          // totalMaleUsers: [{ $match: { gender: "male", ...dateFilterQuery } }, { $count: "count" }],
          // totalFemaleUsers: [{ $match: { gender: "female", ...dateFilterQuery } }, { $count: "count" }],
          totalUsers: [{ $match: filter }, { $count: "count" }],
          users: [
            { $match: filter },
            { $sort: { createdAt: -1 } },
            { $skip: (start - 1) * limit },
            { $limit: limit },
            {
              $lookup: {
                from: "followerfollowings",
                localField: "_id",
                foreignField: "followerId",
                pipeline: [{ $count: "count" }],
                as: "followings",
              },
            },
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
                rechargedCoins: 1,
                isHost: 1,
                isVip: 1,
                isBlock: 1,
                isOnline: 1,
                loginType: 1,
                createdAt: 1,
                lastlogin: 1,
                totalFollowings: { $ifNull: [{ $arrayElemAt: ["$followings.count", 0] }, 0] },
              },
            },
          ],
        },
      },
    ]);

    const data = result[0];

    return res.status(200).json({
      status: true,
      message: "Retrieved real users!",
      // totalActiveUsers: data.totalActiveUsers[0]?.count || 0,
      // totalVIPUsers: data.totalVIPUsers[0]?.count || 0,
      // totalMaleUsers: data.totalMaleUsers[0]?.count || 0,
      // totalFemaleUsers: data.totalFemaleUsers[0]?.count || 0,
      total: data.totalUsers[0]?.count || 0,
      data: data.users,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//toggle user's block status
exports.modifyUserBlockStatus = async (req, res, next) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(200).json({ status: false, message: "User ID is required." });
    }

    const user = await User.findById(userId).select("uniqueId name image countryFlagImage country gender coin rechargedCoins isHost isVip isBlock isFake loginType createdAt");
    if (!user) {
      return res.status(200).json({ status: false, message: "User not found." });
    }

    user.isBlock = !user.isBlock;
    await user.save();

    return res.status(200).json({
      status: true,
      message: `User has been ${user.isBlock ? "blocked" : "unblocked"} successfully.`,
      data: user,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "An error occurred while updating user block status." });
  }
};

//get user's profile
exports.fetchUserProfile = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(200).json({ status: false, message: "User ID is required." });
    }

    const [user] = await Promise.all([
      User.findOne({ _id: userId }).select("name selfIntro gender bio age image email countryFlagImage country loginType uniqueId coin spentCoins rechargedCoins isOnline").lean(),
    ]);

    if (!user) {
      return res.status(200).json({ status: false, message: "User not found." });
    }

    return res.status(200).json({ status: true, message: "The user has retrieved their profile.", user: user });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//admin can add or deduct coins from a user's wallet
exports.updateUserCoin = async (req, res, next) => {
  try {
    const { userId, coin, action } = req.body;

    if (!userId || !coin || !action) {
      return res.status(200).json({
        status: false,
        message: "userId, coin, and action are required fields.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(200).json({ status: false, message: "Invalid userId." });
    }

    if (!["add", "deduct"].includes(action)) {
      return res.status(200).json({
        status: false,
        message: "Invalid action. Must be 'add' or 'deduct'.",
      });
    }

    if (isNaN(coin) || coin <= 0) {
      return res.status(200).json({
        status: false,
        message: "Coin must be a positive number.",
      });
    }

    const [uniqueId, user] = await Promise.all([generateHistoryUniqueId(), User.findById(userId).lean()]);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found.",
      });
    }

    let newCoinBalance = user.coin;
    let updatedFields = {};

    if (action === "add") {
      newCoinBalance += coin;
      updatedFields = {
        coin: newCoinBalance,
        rechargedCoins: (user.rechargedCoins || 0) + coin,
      };
    } else {
      if (user.coin < coin) {
        return res.status(200).json({
          status: false,
          message: "Insufficient balance to deduct coins.",
        });
      }
      newCoinBalance -= coin;
      updatedFields = {
        coin: newCoinBalance,
      };
    }

    await Promise.all([
      User.findByIdAndUpdate(userId, updatedFields, { new: true }).lean(),
      History.create({
        uniqueId: uniqueId,
        type: action === "add" ? 14 : 15,
        userId,
        userCoin: coin,
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      }),
    ]);

    return res.status(200).json({
      status: true,
      message: `Successfully ${action === "add" ? "added" : "deducted"} ${coin} coins.`,
    });
  } catch (error) {
    console.error("Admin Coin Update Error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};
