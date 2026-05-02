const Report = require("../../models/report.model");
const User = require("../../models/user.model");

const admin = require("../../util/privateKey");

//Get all user-host reports
exports.getUserHostReports = async (req, res) => {
  try {
    const { reporterId, targetId, status, targetRole, search, start = 1, limit = 20, startDate, endDate } = req.query;
    const page = parseInt(start);
    const pageSize = parseInt(limit);
    const trimmedSearch = search ? search.trim() : null;

    const matchStage = {};
    if (reporterId) matchStage.reporterId = mongoose.Types.ObjectId(reporterId);
    if (targetId) matchStage.targetId = mongoose.Types.ObjectId(targetId);
    if (status && status !== "All") matchStage.status = parseInt(status);
    if (targetRole && targetRole !== "All") matchStage.targetRole = targetRole;

    let dateFilter = {};
    if (startDate && endDate && startDate !== "All" && endDate !== "All") {
      const from = new Date(startDate);
      const to = new Date(endDate);
      to.setHours(23, 59, 59, 999);

      dateFilter.proceedAt = { $gte: from, $lte: to };
    }

    const pipeline = [
      { $match: { ...matchStage, ...dateFilter } },

      // Reporter User
      {
        $lookup: {
          from: "users",
          localField: "reporterId",
          foreignField: "_id",
          pipeline: [{ $project: { _id: 1, name: 1, uniqueId: 1, image: 1 } }],
          as: "reporterUser",
        },
      },
      { $unwind: { path: "$reporterUser", preserveNullAndEmptyArrays: true } },

      // Reporter Host
      {
        $lookup: {
          from: "hosts",
          localField: "reporterId",
          foreignField: "_id",
          pipeline: [{ $project: { _id: 1, name: 1, uniqueId: 1, image: 1 } }],
          as: "reporterHost",
        },
      },
      { $unwind: { path: "$reporterHost", preserveNullAndEmptyArrays: true } },

      // Target User
      {
        $lookup: {
          from: "users",
          localField: "targetId",
          foreignField: "_id",
          pipeline: [{ $project: { _id: 1, name: 1, uniqueId: 1, image: 1 } }],
          as: "targetUser",
        },
      },
      { $unwind: { path: "$targetUser", preserveNullAndEmptyArrays: true } },

      // Target Host
      {
        $lookup: {
          from: "hosts",
          localField: "targetId",
          foreignField: "_id",
          pipeline: [{ $project: { _id: 1, name: 1, uniqueId: 1, image: 1 } }],
          as: "targetHost",
        },
      },
      { $unwind: { path: "$targetHost", preserveNullAndEmptyArrays: true } },
    ];

    // Search filter
    if (trimmedSearch) {
      pipeline.push({
        $match: {
          $or: [
            { "reporterUser.name": { $regex: trimmedSearch, $options: "i" } },
            { "reporterUser.uniqueId": { $regex: trimmedSearch, $options: "i" } },
            { "reporterHost.name": { $regex: trimmedSearch, $options: "i" } },
            { "reporterHost.uniqueId": { $regex: trimmedSearch, $options: "i" } },
            { "targetUser.name": { $regex: trimmedSearch, $options: "i" } },
            { "targetUser.uniqueId": { $regex: trimmedSearch, $options: "i" } },
            { "targetHost.name": { $regex: trimmedSearch, $options: "i" } },
            { "targetHost.uniqueId": { $regex: trimmedSearch, $options: "i" } },
          ],
        },
      });
    }

    pipeline.push({ $sort: { createdAt: -1 } });

    pipeline.push({
      $facet: {
        data: [
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize },
          {
            $project: {
              reporterId: 1,
              reporterRole: 1,
              targetId: 1,
              targetRole: 1,
              reason: 1,
              status: 1,
              proceedAt: 1,
              createdAt: 1,
              updatedAt: 1,
              reporterName: { $ifNull: ["$reporterUser.name", "$reporterHost.name"] },
              reporterUniqueId: { $ifNull: ["$reporterUser.uniqueId", "$reporterHost.uniqueId"] },
              reporterImage: { $ifNull: ["$reporterUser.image", "$reporterHost.image"] },
              targetName: { $ifNull: ["$targetUser.name", "$targetHost.name"] },
              targetUniqueId: { $ifNull: ["$targetUser.uniqueId", "$targetHost.uniqueId"] },
              targetImage: { $ifNull: ["$targetUser.image", "$targetHost.image"] },
            },
          },
        ],
        totalCount: [{ $count: "count" }],
      },
    });

    const result = await Report.aggregate(pipeline);
    const total = result[0].totalCount[0] ? result[0].totalCount[0].count : 0;
    const reports = result[0].data;

    return res.status(200).json({
      status: true,
      message: "User-host reports retrieved successfully.",
      total,
      data: reports,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//Solve a report
exports.solveUserHostReport = async (req, res) => {
  try {
    const { reportId } = req.query;
    if (!reportId) {
      return res.status(400).json({ status: false, message: "reportId is required." });
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(400).json({ status: false, message: "Report not found." });
    }

    if (report.status === 2) {
      return res.status(200).json({ status: false, message: "Report is already solved." });
    }

    report.status = 2;
    report.proceedAt = new Date();
    await report.save();

    res.status(200).json({
      status: true,
      message: "Report marked as solved.",
      data: report,
    });

    if (report.reporterId) {
      const reporter = await User.findById(report.reporterId).lean().select("fcmToken name");
      if (reporter?.fcmToken !== null) {
        const payload = {
          token: reporter?.fcmToken,
          data: {
            title: "Your report has been solved",
            body: `Hi ${reporter.name}, the report you submitted has been resolved.`,
            type: "REPORT_SOLVED",
          },
        };

        const adminPromise = await admin;
        adminPromise
          .messaging()
          .send(payload)
          .then((response) => {
            console.log("Successfully sent with response solveUserHostReport: ", response);
          })
          .catch((error) => {
            console.error("Error sending FCM message:", error);
          });
      }
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error." });
  }
};

//Delete a report
exports.deleteUserHostReport = async (req, res) => {
  try {
    const { reportId } = req.query || {};
    if (!reportId) {
      return res.status(400).json({ status: false, message: "reportId is required." });
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(400).json({ status: false, message: "Report not found." });
    }

    await report.deleteOne();

    return res.status(200).json({ status: true, message: "Report deleted successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error." });
  }
};
