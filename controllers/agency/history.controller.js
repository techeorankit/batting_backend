const History = require("../../models/history.model");
const Host = require("../../models/host.model");
const Agency = require("../../models/agency.model");

//mongoose
const mongoose = require("mongoose");

//get coin history ( host )
exports.getCoinTransactions = async (req, res) => {
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

    const [host, result] = await Promise.all([
      Host.findOne({ _id: hostId }).select("_id").lean(),
      History.aggregate([
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
            pipeline: [{ $project: { name: 1, image: 1, uniqueId: 1 } }],
            as: "sender",
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
          $facet: {
            totalCount: [{ $count: "count" }],
            paginatedHistory: [
              { $sort: { createdAt: -1 } },
              { $skip: (start - 1) * limit },
              { $limit: limit },
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
                  userCoin: 1,
                  hostCoin: 1,
                  adminCoin: 1,
                  payoutStatus: 1,
                  createdAt: 1,
                  senderName: { $ifNull: ["$sender.name", ""] },
                  senderImage: { $ifNull: ["$sender.image", ""] },
                  senderUniqueId: { $ifNull: ["$sender.uniqueId", ""] },
                },
              },
            ],
          },
        },
      ]),
    ]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host does not found." });
    }

    const total = result[0]?.totalCount?.[0]?.count || 0;
    const transactionHistory = result[0]?.paginatedHistory || [];

    return res.status(200).json({
      status: true,
      message: "Transaction history fetch successfully.",
      total: total,
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Something went wrong. Please try again later." });
  }
};

//get call history ( host )
exports.getCallTransactions = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid details." });
    }

    if (req.query.hostId && !mongoose.Types.ObjectId.isValid(req.query.hostId)) {
      return res.status(200).json({ status: false, message: "Invalid hostId. Please provide a valid ObjectId." });
    }

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

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

    const [host, result] = await Promise.all([
      Host.findOne({ _id: hostId }).select("_id").lean(),
      History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            type: { $in: [11, 12, 13] },
            hostId,
            hostCoin: { $ne: 0 },
          },
        },

        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            pipeline: [{ $project: { name: 1, image: 1, uniqueId: 1 } }],
            as: "sender",
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
            durationInSeconds: {
              $cond: [
                { $regexMatch: { input: "$duration", regex: /^\d{2}:\d{2}:\d{2}$/ } },
                {
                  $add: [
                    { $multiply: [{ $toInt: { $arrayElemAt: [{ $split: ["$duration", ":"] }, 0] } }, 3600] },
                    { $multiply: [{ $toInt: { $arrayElemAt: [{ $split: ["$duration", ":"] }, 1] } }, 60] },
                    { $toInt: { $arrayElemAt: [{ $split: ["$duration", ":"] }, 2] } },
                  ],
                },
                0,
              ],
            },
          },
        },
        {
          $facet: {
            totalCount: [{ $count: "count" }],
            durationSummary: [
              {
                $group: {
                  _id: null,
                  totalSeconds: { $sum: "$durationInSeconds" },
                },
              },
            ],
            data: [
              { $sort: { createdAt: -1 } },
              { $skip: (start - 1) * limit },
              { $limit: limit },
              {
                $addFields: {
                  typeDescription: {
                    $switch: {
                      branches: [
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
                  userCoin: 1,
                  hostCoin: 1,
                  adminCoin: 1,
                  callType: 1,
                  isRandom: 1,
                  isPrivate: 1,
                  callStartTime: 1,
                  callEndTime: 1,
                  duration: 1,
                  createdAt: 1,
                  senderName: { $ifNull: ["$sender.name", ""] },
                  senderImage: { $ifNull: ["$sender.image", ""] },
                  senderUniqueId: { $ifNull: ["$sender.uniqueId", ""] },
                },
              },
            ],
          },
        },
      ]),
    ]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host does not found." });
    }

    const total = result[0]?.totalCount?.[0]?.count || 0;
    const data = result[0]?.data || [];
    const totalSeconds = result[0]?.durationSummary?.[0]?.totalSeconds || 0;

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const totalDuration = `${String(hours).padStart(2, "0")}:` + `${String(minutes).padStart(2, "0")}:` + `${String(seconds).padStart(2, "0")}`;

    return res.status(200).json({
      status: true,
      message: "✅ Transaction history fetched successfully.",
      total: total,
      totalDuration,
      data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "🚨 Something went wrong. Please try again later.",
    });
  }
};

//get gift history ( host )
exports.getGiftTransactions = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid details." });
    }

    if (req.query.hostId && !mongoose.Types.ObjectId.isValid(req.query.hostId)) {
      return res.status(200).json({ status: false, message: "Invalid hostId. Please provide a valid ObjectId." });
    }

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

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

    const [host, result] = await Promise.all([
      Host.findOne({ _id: hostId }).select("_id").lean(),
      History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            type: { $in: [2, 3, 10] },
            hostId,
            hostCoin: { $ne: 0 },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            pipeline: [{ $project: { name: 1, image: 1, uniqueId: 1 } }],
            as: "sender",
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
          $facet: {
            totalCount: [{ $count: "count" }],
            data: [
              { $sort: { createdAt: -1 } },
              { $skip: (start - 1) * limit },
              { $limit: limit },
              {
                $addFields: {
                  typeDescription: {
                    $switch: {
                      branches: [
                        { case: { $eq: ["$type", 2] }, then: "🎁 Live Gift" },
                        { case: { $eq: ["$type", 3] }, then: "🎥 Video Call Gift" },
                        { case: { $eq: ["$type", 10] }, then: "💬 Chat Gift" },
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
                  userCoin: 1,
                  hostCoin: 1,
                  adminCoin: 1,
                  createdAt: 1,
                  senderName: { $ifNull: ["$sender.name", ""] },
                  senderImage: { $ifNull: ["$sender.image", ""] },
                  senderUniqueId: { $ifNull: ["$sender.uniqueId", ""] },
                },
              },
            ],
          },
        },
      ]),
    ]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host does not found." });
    }

    const total = result[0]?.totalCount?.[0]?.count || 0;
    const transactionHistory = result[0]?.data || [];

    return res.status(200).json({
      status: true,
      message: "✅ Transaction history fetched successfully.",
      total: total,
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "🚨 Something went wrong. Please try again later.",
    });
  }
};

//get agency's earnings
exports.retrieveAgencyEarnings = async (req, res) => {
  try {
    if (!req.agency || !req.agency._id) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const agencyObjectId = new mongoose.Types.ObjectId(req.agency._id);
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

    const [agency, historyData] = await Promise.all([
      Agency.findOne({ _id: agencyObjectId }).select("_id isBlock").lean(),
      History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            agencyId: agencyObjectId,
            type: { $in: [2, 3, 9, 10, 11, 12, 13] },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            pipeline: [{ $project: { name: 1, image: 1, uniqueId: 1 } }],
            as: "sender",
          },
        },
        { $unwind: { path: "$sender", preserveNullAndEmptyArrays: false } },
        {
          $lookup: {
            from: "hosts",
            localField: "hostId",
            foreignField: "_id",
            pipeline: [{ $project: { name: 1, image: 1, uniqueId: 1 } }],
            as: "receiver",
          },
        },
        { $unwind: { path: "$receiver", preserveNullAndEmptyArrays: false } },
        ...(search
          ? [
              {
                $match: {
                  $or: [
                    { "sender.name": { $regex: search, $options: "i" } },
                    { "sender.uniqueId": { $regex: search, $options: "i" } },
                    { "receiver.name": { $regex: search, $options: "i" } },
                    { "receiver.uniqueId": { $regex: search, $options: "i" } },
                    { uniqueId: { $regex: search, $options: "i" } },
                  ],
                },
              },
            ]
          : []),
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  totalAgencyEarnings: { $sum: "$agencyCoin" },
                },
              },
            ],
            transactions: [
              {
                $match: { agencyCoin: { $ne: 0 } },
              },
              { $sort: { createdAt: -1 } },
              { $skip: (start - 1) * limit },
              { $limit: limit },
              {
                $addFields: {
                  typeDescription: {
                    $switch: {
                      branches: [
                        { case: { $eq: ["$type", 2] }, then: "Live Gift" },
                        { case: { $eq: ["$type", 3] }, then: "Video Call Gift" },
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
                  userCoin: 1,
                  hostCoin: 1,
                  adminCoin: 1,
                  agencyCoin: 1,
                  callStartTime: 1,
                  callEndTime: 1,
                  duration: 1,
                  createdAt: 1,
                  senderName: { $ifNull: ["$sender.name", ""] },
                  senderImage: { $ifNull: ["$sender.image", ""] },
                  senderUniqueId: { $ifNull: ["$sender.uniqueId", ""] },
                  receiverName: { $ifNull: ["$receiver.name", ""] },
                  receiverImage: { $ifNull: ["$receiver.image", ""] },
                  receiverUniqueId: { $ifNull: ["$receiver.uniqueId", ""] },
                },
              },
            ],
          },
        },
      ]),
    ]);

    const summary = historyData[0]?.summary[0] || { total: 0, totalAgencyEarnings: 0 };
    const transactionHistory = historyData[0]?.transactions || [];

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found." });
    }

    if (agency.isBlock) {
      return res.status(200).json({ status: false, message: "Agency is currently inactive." });
    }

    const total = summary.total || 0;
    const totalAgencyEarnings = Number((summary.totalAgencyEarnings || 0).toFixed(2));

    return res.status(200).json({
      status: true,
      message: "Transaction history fetch successfully.",
      total,
      totalAgencyEarnings,
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Something went wrong. Please try again later." });
  }
};
