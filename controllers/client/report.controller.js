const Report = require("../../models/report.model");
const User = require("../../models/user.model");
const Host = require("../../models/host.model");

const admin = require("../../util/privateKey");

// Submit a report (user → host or host → user)
exports.submitReport = async (req, res) => {
  try {
    const { reporterId, reporterRole, targetId, targetRole, reason } = req.body;

    if (!reporterId || !reporterRole || !targetId || !targetRole || !reason) {
      return res.status(400).json({ status: false, message: "All fields are required." });
    }

    if (!["user", "host"].includes(reporterRole) || !["user", "host"].includes(targetRole)) {
      return res.status(400).json({ status: false, message: "Invalid reporterRole or targetRole." });
    }

    if (reporterId === targetId && reporterRole === targetRole) {
      return res.status(400).json({ status: false, message: "You cannot report yourself." });
    }

    const reporterModel = reporterRole === "user" ? User : Host;
    const targetModel = targetRole === "user" ? User : Host;

    const [reporter, target] = await Promise.all([reporterModel.findById(reporterId).select("_id isBlock fcmToken name").lean(), targetModel.findById(targetId).select("_id isBlock name").lean()]);

    if (!reporter) {
      return res.status(404).json({ status: false, message: "Reporter not found." });
    }

    if (reporter.isBlock) {
      return res.status(403).json({ status: false, message: "You are blocked by admin." });
    }

    if (!target) {
      return res.status(404).json({ status: false, message: "Target not found." });
    }

    if (target.isBlock) {
      return res.status(403).json({ status: false, message: "Target is blocked." });
    }

    const existingReport = await Report.findOne({
      reporterId,
      reporterRole,
      targetId,
      targetRole,
      status: 1, // pending
    }).lean();

    if (existingReport) {
      return res.status(200).json({
        status: false,
        message: `A report has already been submitted.`,
      });
    }

    const newReport = new Report({
      reporterId,
      reporterRole,
      targetId,
      targetRole,
      reason: reason.trim(),
    });
    await newReport.save();

    if (reporter.fcmToken) {
      const payload = {
        token: reporter.fcmToken,
        data: {
          title: "🚨 Report Submitted",
          body: "Your report has been successfully submitted and is under review.",
          type: "REPORT_SUBMISSION",
        },
      };

      const adminPromise = await admin;
      adminPromise.messaging().send(payload).catch(console.error);
    }

    return res.status(200).json({
      status: true,
      message: "Report submitted successfully.",
      data: newReport,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error." });
  }
};
