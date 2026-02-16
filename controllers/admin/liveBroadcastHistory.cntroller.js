const LiveBroadcastHistory = require("../../models/liveBroadcastHistory.model");

//mongoose
const mongoose = require("mongoose");

//import model
const Host = require("../../models/host.model");

//get live history ( host )
exports.fetchLiveHistory = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid request parameters." });
    }

    if (req.query.hostId && !mongoose.Types.ObjectId.isValid(req.query.hostId)) {
      return res.status(200).json({ status: false, message: "Invalid hostId. Please provide a valid ObjectId." });
    }

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
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

    const [host, total, liveHistoryAgg] = await Promise.all([
      Host.findOne({ _id: hostId }).lean().select("_id"),
      LiveBroadcastHistory.countDocuments({ hostId, ...dateFilterQuery }),
      LiveBroadcastHistory.aggregate([
        {
          $match: { hostId, ...dateFilterQuery },
        },
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
            data: [
              {
                $project: {
                  coins: 1,
                  gifts: 1,
                  audienceCount: 1,
                  liveComments: 1,
                  startTime: 1,
                  endTime: 1,
                  duration: 1,
                  createdAt: 1,
                },
              },
              { $sort: { createdAt: -1 } },
              { $skip: (start - 1) * limit },
              { $limit: limit },
            ],

            durationSummary: [
              {
                $group: {
                  _id: null,
                  totalSeconds: { $sum: "$durationInSeconds" },
                },
              },
            ],
          },
        },
      ]),
    ]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    const data = liveHistoryAgg[0]?.data || [];
    const totalSeconds =
      liveHistoryAgg[0]?.durationSummary[0]?.totalSeconds || 0;

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const totalDuration =
      `${String(hours).padStart(2, "0")}:` +
      `${String(minutes).padStart(2, "0")}:` +
      `${String(seconds).padStart(2, "0")}`;

    return res.status(200).json({
      status: true,
      message: "User live history retrieved successfully.",
      total,
      totalDuration,
      data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};
