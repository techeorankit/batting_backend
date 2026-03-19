const ReportReason = require("../../models/reportReason.model");

// Get all report reasons
exports.fetchReportReasons = async (req, res) => {
  try {
    const reportReasons = await ReportReason.find().sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      status: true,
      message: "Report reasons retrieved successfully.",
      data: reportReasons,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
