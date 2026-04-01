const Block = require("../../models/block.model");

const mongoose = require("mongoose");

//get blocked hosts for a user
exports.listBlockedHostsForUser = async (req, res) => {
  try {
    const { userId, search } = req.query;

    if (!userId) {
      return res.status(200).json({ status: false, message: "userId is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(200).json({ status: false, message: "Invalid userId." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const matchStage = {
      userId: new mongoose.Types.ObjectId(userId),
      isUserBlocked: true,
    };

    const searchMatch = search
      ? {
          $match: {
            $or: [{ "host.name": { $regex: search, $options: "i" } }, { "host.uniqueId": { $regex: search, $options: "i" } }, { "host.country": { $regex: search, $options: "i" } }],
          },
        }
      : null;

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "hosts",
          localField: "hostId",
          foreignField: "_id",
          as: "host",
          pipeline: [
            {
              $project: {
                name: 1,
                image: 1,
                uniqueId: 1,
                coin: 1,
                countryFlagImage: 1,
                country: 1,
              },
            },
          ],
        },
      },
      { $unwind: "$host" },
      ...(searchMatch ? [searchMatch] : []),
      {
        $facet: {
          total: [{ $count: "count" }],
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: (start - 1) * limit },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                createdAt: 1,
                hostId: "$host",
              },
            },
          ],
        },
      },
    ];

    const result = await Block.aggregate(pipeline);

    const blockedHosts = result[0].data;
    const total = result[0].total[0]?.count || 0;

    return res.status(200).json({
      status: true,
      message: blockedHosts.length > 0 ? "Blocked hosts retrieved successfully." : "No blocked hosts found.",
      total,
      blockedHosts,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

//get blocked users for a host
exports.listBlockedUsersForHost = async (req, res) => {
  try {
    const { hostId, search } = req.query;

    if (!hostId) {
      return res.status(200).json({ status: false, message: "hostId is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(hostId)) {
      return res.status(200).json({ status: false, message: "Invalid hostId." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const matchStage = {
      hostId: new mongoose.Types.ObjectId(hostId),
      isHostBlocked: true,
    };

    const searchMatch = search
      ? {
          $match: {
            $or: [{ "user.name": { $regex: search, $options: "i" } }, { "user.uniqueId": { $regex: search, $options: "i" } }, { "user.country": { $regex: search, $options: "i" } }],
          },
        }
      : null;

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
          pipeline: [
            {
              $project: {
                name: 1,
                image: 1,
                uniqueId: 1,
                coin: 1,
                countryFlagImage: 1,
                country: 1,
              },
            },
          ],
        },
      },
      { $unwind: "$user" },
      ...(searchMatch ? [searchMatch] : []),
      {
        $facet: {
          total: [{ $count: "count" }],
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: (start - 1) * limit },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                createdAt: 1,
                userId: "$user",
              },
            },
          ],
        },
      },
    ];

    const result = await Block.aggregate(pipeline);

    const blockedUsers = result[0].data;
    const total = result[0].total[0]?.count || 0;

    return res.status(200).json({
      status: true,
      message: blockedUsers.length > 0 ? "Blocked users retrieved successfully." : "No blocked users found.",
      total,
      blockedUsers,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};
