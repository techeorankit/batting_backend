const FollowerFollowing = require("../../models/followerFollowing.model");

//import model
const User = require("../../models/user.model");
const Host = require("../../models/host.model");

//mongoose
const mongoose = require("mongoose");

//get list of following
exports.fetchFollowing = async (req, res) => {
  try {
    if (!req.query.userId) {
      return res.status(200).json({ status: false, message: "userId must be requried." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const search = req.query.search?.trim();

    const userId = new mongoose.Types.ObjectId(req.query.userId);

    const [user, result] = await Promise.all([
      User.findById(userId).select("_id").lean(),
      FollowerFollowing.aggregate([
        { $match: { followerId: userId } },
        {
          $lookup: {
            from: "hosts",
            localField: "followingId",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  name: 1,
                  image: 1,
                  uniqueId: 1,
                  coin: 1,
                  countryFlagImage: 1,
                  country: 1,
                },
              },
            ],
            as: "followingId",
          },
        },
        { $unwind: "$followingId" },
        ...(search
          ? [
              {
                $match: {
                  $or: [
                    { "followingId.name": { $regex: search, $options: "i" } },
                    { "followingId.country": { $regex: search, $options: "i" } },
                    { "followingId.uniqueId": { $regex: search, $options: "i" } },
                  ],
                },
              },
            ]
          : []),
        {
          $facet: {
            total: [{ $count: "count" }],
            list: [{ $sort: { createdAt: -1 } }, { $skip: (start - 1) * limit }, { $limit: limit }],
          },
        },
      ]),
    ]);

    const total = result[0].total[0]?.count || 0;
    const followingList = result[0].list;

    if (!user) {
      return res.status(200).json({ status: false, message: "User not found." });
    }

    return res.status(200).json({
      status: true,
      message: `Retrieved following users successfully.`,
      total,
      followingList,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

//get list of followers
exports.fetchFollowers = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "hostId is required." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const search = req.query.search?.trim();

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

    const [host, result] = await Promise.all([
      Host.findById(hostId).select("_id isBlock").lean(),
      FollowerFollowing.aggregate([
        { $match: { followingId: hostId } },
        {
          $lookup: {
            from: "users",
            localField: "followerId",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  name: 1,
                  image: 1,
                  uniqueId: 1,
                  coin: 1,
                  countryFlagImage: 1,
                  country: 1,
                },
              },
            ],
            as: "followerId",
          },
        },

        { $unwind: "$followerId" },
        ...(search
          ? [
              {
                $match: {
                  $or: [
                    { "followerId.name": { $regex: search, $options: "i" } },
                    { "followerId.country": { $regex: search, $options: "i" } },
                    { "followerId.uniqueId": { $regex: search, $options: "i" } },
                  ],
                },
              },
            ]
          : []),
        {
          $facet: {
            total: [{ $count: "count" }],
            list: [{ $sort: { createdAt: -1 } }, { $skip: (start - 1) * limit }, { $limit: limit }],
          },
        },
      ]),
    ]);

    const total = result[0].total[0]?.count || 0;
    const followerList = result[0].list;

    if (!host) {
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    return res.status(200).json({
      status: true,
      message: "Retrieved followers successfully.",
      total,
      followerList,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};
