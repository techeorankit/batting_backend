const User = require("../../models/user.model");

//get users
exports.retrieveUserList = async (req, res) => {
  try {
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const searchString = req.query.search || "";
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";
    const userType = parseInt(req.query.type);

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
      isFake: userType === 2,
    };

    const aggregationPipeline = [
      { $match: filter },
      { $sort: { createdAt: -1 } },
      { $skip: (start - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: "followerfollowings",
          localField: "_id",
          foreignField: "toUserId",
          as: "followers",
        },
      },
      {
        $lookup: {
          from: "followerfollowings",
          localField: "_id",
          foreignField: "fromUserId",
          as: "followings",
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
          gender: 1,
          coin: 1,
          rechargedCoins: 1,
          isHost: 1,
          isVip: 1,
          isBlock: 1,
          isFake: 1,
          loginType: 1,
          createdAt: 1,
          totalFollowers: { $size: "$followers" },
          totalFollowings: { $size: "$followings" },
        },
      },
    ];

    const [users, totalUsers] = await Promise.all([User.aggregate(aggregationPipeline), User.countDocuments(filter)]);

    const message = userType === 1 ? "Retrieved real users!" : "Retrieved users added by admin!";

    return res.status(200).json({
      status: true,
      message,
      total: totalUsers,
      data: users,
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
