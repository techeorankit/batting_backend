const History = require("../../models/history.model");

const mongoose = require("mongoose");

//get coin history ( user )
exports.getCoinTransactionRecords = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Access denied. Invalid authentication token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
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

    const [transactionHistory] = await Promise.all([
      History.aggregate([
        {
          $match: {
            ...dateFilterQuery,
            userId: userId,
            userCoin: { $ne: 0 },
          },
        },
        {
          $lookup: {
            from: "hosts",
            localField: "hostId",
            foreignField: "_id",
            as: "receiver",
          },
        },
        {
          $unwind: {
            path: "$receiver",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            uniqueId: 1,
            type: 1,
            userCoin: 1,
            payoutStatus: 1,
            reason: 1,
            createdAt: 1,
            receiverName: { $ifNull: ["$receiver.name", ""] },
            isIncome: {
              $cond: {
                if: { $in: ["$type", [1, 6, 7, 8]] },
                then: true,
                else: {
                  $cond: {
                    if: {
                      $or: [{ $in: ["$type", [2, 3, 10, 11, 12, 13]] }, { $and: [{ $eq: ["$type", 4] }, { $eq: ["$payoutStatus", 2] }] }],
                    },
                    then: false,
                    else: false,
                  },
                },
              },
            },
          },
        },
        { $sort: { createdAt: -1 } },
      ]),
    ]);

    return res.status(200).json({
      status: true,
      message: "Transaction history fetch successfully.",
      data: transactionHistory,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Something went wrong. Please try again later." });
  }
};
