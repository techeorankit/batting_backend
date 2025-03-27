const Host = require("../../models/host.model");
const User = require("../../models/user.model");
const Agency = require("../../models/agency.model");

//private key
const admin = require("../../util/privateKey");

//mongoose
const mongoose = require("mongoose");

//retrive host requests
exports.fetchHostRequest = async (req, res) => {
  try {
    if (!req.query.status) {
      return res.status(200).json({ status: false, message: "Oops ! Invalid details!" });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    let statusQuery = {};
    if (req.query.status !== "All") {
      statusQuery.status = parseInt(req.query.status);
    }

    const [total, request] = await Promise.all([
      Host.countDocuments({ ...statusQuery }),
      Host.find({ ...statusQuery })
        .populate("agencyId", "name agencyCode")
        .skip((start - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 }),
    ]);

    return res.status(200).json({
      status: true,
      message: "Retrive host's request for admin.",
      total: total ? total : 0,
      data: request,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//accept Or decline host request
exports.handleHostRequest = async (req, res) => {
  try {
    const { requestId, userId, status, reason } = req.query;

    if (!requestId || !userId || !status) {
      return res.status(200).json({ status: false, message: "Invalid details provided." });
    }

    const hostObjectId = new mongoose.Types.ObjectId(requestId);
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const statusNumber = Number(status);

    const host = await Host.findById(hostObjectId);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host request not found." });
    }

    if (host.status === 2) {
      return res.status(200).json({ status: false, message: "Host request has already been accepted." });
    }

    if (host.status === 3) {
      return res.status(200).json({ status: false, message: "Host request has already been rejected." });
    }

    if (statusNumber === 2) {
      host.status = 2;
      await host.save();

      res.status(200).json({ status: true, message: "Host request accepted successfully.", data: host });

      const user = await User.findOne({ _id: userObjectId }).select("isHost hostId");
      if (user) {
        user.isHost = true;
        user.hostId = host._id;
        await user.save();
      }

      if (host.fcmToken) {
        const payload = {
          token: host.fcmToken,
          notification: {
            title: "🎉 Host Verification Successful!",
            body: "Congratulations! Your host request has been approved. You’re now ready to go live! 🚀",
          },
        };

        try {
          const adminInstance = await admin;
          await adminInstance.messaging().send(payload);
          console.log("Notification sent successfully.");
        } catch (error) {
          console.error("Error sending notification:", error);
        }
      }
    } else if (statusNumber === 3) {
      if (!reason || reason.trim() === "") {
        return res.status(200).json({ status: false, message: "Please provide a reason for rejection." });
      }

      host.status = 3;
      host.reason = reason.trim();
      await host.save();

      res.status(200).json({ status: true, message: "Host request rejected successfully.", data: host });

      if (host.fcmToken) {
        const payload = {
          token: host.fcmToken,
          notification: {
            title: "❌ Host Request Declined",
            body: "Unfortunately, your host request was declined. Please check your details or contact support for assistance. 📩",
          },
        };

        try {
          const adminInstance = await admin;
          await adminInstance.messaging().send(payload);
          console.log("Notification sent successfully.");
        } catch (error) {
          console.error("Error sending notification:", error);
        }
      }
    } else {
      return res.status(200).json({ status: false, message: "Invalid status value provided." });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error", error: error.message });
  }
};

//handle block or not the host
exports.toggleHostBlockStatus = async (req, res) => {
  try {
    const { hostId } = req.query;

    if (!hostId) {
      return res.status(200).json({ status: false, message: "Host ID is required!" });
    }

    if (!mongoose.Types.ObjectId.isValid(hostId)) {
      return res.status(200).json({ status: false, message: "Invalid hostId format." });
    }

    const host = await Host.findOne({ _id: hostId });
    if (!host) {
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    host.isBlock = !host.isBlock;
    await host.save();

    return res.status(200).json({
      status: true,
      message: `Host has been ${host.isBlock ? "blocked" : "unblocked"} successfully.`,
      data: host,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error", error: error.message });
  }
};

//assign host under agency
exports.assignHostToAgency = async (req, res) => {
  try {
    const { requestId, agencyId } = req.query;

    if (!requestId || !agencyId) {
      return res.status(200).json({
        status: false,
        message: "Required parameters missing: requestId or agencyId.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(requestId) || !mongoose.Types.ObjectId.isValid(agencyId)) {
      return res.status(200).json({
        status: false,
        message: "Invalid requestId or agencyId format. Must be a valid ObjectId.",
      });
    }

    const requestObjectId = new mongoose.Types.ObjectId(requestId);
    const [hostRequest, agency] = await Promise.all([Host.findOne({ _id: requestObjectId, status: 1 }), Agency.findById(agencyId).select("_id name agencyCode").lean()]);

    if (!hostRequest) {
      return res.status(200).json({ status: false, message: "Host request not found." });
    }

    if (hostRequest.agencyId !== null) {
      return res.status(200).json({ status: false, message: "This host request is already assigned to an agency." });
    }

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found." });
    }

    if (hostRequest.status === 2) {
      return res.status(200).json({ status: false, message: "This host request has already been accepted." });
    }

    if (hostRequest.status === 3) {
      return res.status(200).json({ status: false, message: "This host request has already been rejected." });
    }

    hostRequest.agencyId = agency._id;
    await hostRequest.save();

    return res.status(200).json({
      status: true,
      message: "Host successfully assigned to the agency.",
      request: { ...hostRequest.toObject(), agency },
    });
  } catch (error) {
    console.error("Error in assignHostToAgency:", error);
    return res.status(500).json({ status: false, message: "Internal Server Error", error: error.message });
  }
};
