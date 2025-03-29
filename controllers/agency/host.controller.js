const Host = require("../../models/host.model");
const Agency = require("../../models/agency.model");

//private key
const admin = require("../../util/privateKey");

//mongoose
const mongoose = require("mongoose");

//get agency wise host requests
exports.fetchHostRequestsByAgency = async (req, res) => {
  try {
    if (!req.agency || !req.agency.agencyId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!req.query.status) {
      return res.status(200).json({ status: false, message: "Oops ! Invalid details!" });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const agencyId = new mongoose.Types.ObjectId(req.agency.agencyId);

    const [agency, hosts] = await Promise.all([
      Agency.findOne({ _id: agencyId, isBlock: false }).lean(),
      Host.find({ agency: agencyId, isBlock: false, status: parseInt(req.query.status) })
        .select("_id name gender image impression identityProofType uniqueId isOnline isBusy isLive")
        .skip((start - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    if (!agency) {
      return res.status(200).json({ status: false, message: "Request not found for that agency!" });
    }

    return res.status(200).json({
      status: true,
      message: "Agency wise hosts fetched successfully!",
      hosts: hosts,
    });
  } catch (error) {
    console.error("Error fetching agency wise hosts:", error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//accept Or decline host request
exports.manageHostRequest = async (req, res) => {
  try {
    if (!req.agency || !req.agency.agencyId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!settingJSON) {
      return res.status(200).json({ status: false, message: "Setting not found." });
    }

    const { requestId, userId, status, reason } = req.query;

    if (!requestId || !userId || !status) {
      return res.status(200).json({ status: false, message: "Invalid details provided." });
    }

    const agencyObjectId = new mongoose.Types.ObjectId(req.agency.agencyId);
    const hostObjectId = new mongoose.Types.ObjectId(requestId);
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const statusNumber = Number(status);

    const host = await Host.findOne({ _id: hostObjectId, agencyId: agencyObjectId });

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
      host.randomCallRate = settingJSON.generalRandomCallRate;
      host.randomCallFemaleRate = settingJSON.femaleRandomCallRate;
      host.randomCallMaleRate = settingJSON.maleRandomCallRate;
      host.privateCallRate = settingJSON.videoPrivateCallRate;
      host.audioCallRate = settingJSON.audioPrivateCallRate;
      host.chatRate = settingJSON.chatInteractionRate;
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

//get agency wise host
exports.retrieveAgencyHosts = async (req, res) => {
  try {
    if (!req.agency || !req.agency.agencyId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const agencyId = new mongoose.Types.ObjectId(req.agency.agencyId);

    const [agency, hosts] = await Promise.all([
      Agency.findOne({ _id: agencyId, isBlock: false }).lean(),
      Host.find({ agency: agencyId, isBlock: false, status: 2 })
        .select("name gender image impression identityProofType uniqueId isOnline isBusy isLive")
        .skip((start - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    if (!agency) {
      return res.status(200).json({ status: false, message: "Request not found for that agency!" });
    }

    return res.status(200).json({
      status: true,
      message: "Agency wise hosts fetched successfully!",
      hosts: hosts,
    });
  } catch (error) {
    console.error("Error fetching agency wise hosts:", error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
