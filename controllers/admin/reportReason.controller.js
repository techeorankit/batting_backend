const ReportReason = require("../../models/reportReason.model");

// Create ReportReason
exports.createReportReason = async (req, res) => {
  try {
    if (!req.body.title) {
      return res.status(200).json({ status: false, message: "Oops! Invalid details." });
    }

    const title = req.body.title.trim();
    const reportReason = new ReportReason({ title });
    await reportReason.save();

    return res.status(200).json({
      status: true,
      message: "ReportReason created successfully.",
      data: reportReason,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server error" });
  }
};

// Update ReportReason
exports.updateReportReason = async (req, res) => {
  try {
    const { reportReasonId } = req.body || {};
    if (!reportReasonId) {
      return res.status(200).json({ status: false, message: "reportReasonId is required." });
    }

    const reportReason = await ReportReason.findById(reportReasonId);
    if (!reportReason) {
      return res.status(200).json({ status: false, message: "ReportReason not found." });
    }

    reportReason.title = req.body.title ? req.body.title.trim() : reportReason.title;
    await reportReason.save();

    return res.status(200).json({
      status: true,
      message: "ReportReason updated successfully.",
      data: reportReason,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server error" });
  }
};

// Get ReportReasons
exports.getReportReasons = async (req, res) => {
  try {
    const reportReasons = await ReportReason.find().sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      status: true,
      message: "ReportReasons retrieved successfully.",
      data: reportReasons,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server error" });
  }
};

// Delete ReportReason
exports.deleteReportReason = async (req, res) => {
  try {
    const { reportReasonId } = req.query;
    if (!reportReasonId) {
      return res.status(200).json({ status: false, message: "reportReasonId is required." });
    }

    const reportReason = await ReportReason.findById(reportReasonId);
    if (!reportReason) {
      return res.status(200).json({ status: false, message: "ReportReason not found." });
    }

    await reportReason.deleteOne();

    return res.status(200).json({
      status: true,
      message: "ReportReason deleted successfully.",
      data: reportReason,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server error" });
  }
};
