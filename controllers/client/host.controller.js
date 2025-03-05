const Host = require("../../models/host.model");

//import model
const Agency = require("../../models/agency.model");
const Impression = require("../../models/impression.model");

//deleteFiles
const { deleteFiles } = require("../../util/deletefile");

//generateUniqueId
const generateUniqueId = require("../../util/generateUniqueId");

//private key
const admin = require("../../util/privateKey");

//mongoose
const mongoose = require("mongoose");

//get impression list
exports.getPersonalityImpressions = async (req, res) => {
  try {
    const personalityImpressions = await Impression.find({}).select("name").sort({ createdAt: -1 }).lean();

    res.status(200).json({
      status: true,
      message: `Personality impressions retrieved successfully.`,
      personalityImpressions,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Failed to retrieve personality impressions." });
  }
};

//host request by user
exports.initiateHostRequest = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: "Unauthorized access. Invalid token." });
    }
    
    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const { fcmToken, name, bio, dob, gender, countryFlagImage, country, language, impression, agencyCode } = req.body;

    if (
      !fcmToken ||
      !name ||
      !bio ||
      !dob ||
      !gender ||
      !countryFlagImage ||
      !country ||
      !impression ||
      !req.files //
    ) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Oops ! Invalid details." });
    }

    const [uniqueId, agencyDetails, existingHost] = await Promise.all([
      generateUniqueId(),
      agencyCode ? Agency.findOne({ code: agencyCode }).select("_id").lean() : null,
      Host.findOne({ status: 1, userId: userId }).select("_id").lean(),
    ]);

    if (existingHost) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Oops! A host request already exists under an agency." });
    }

    if (agencyCode && !agencyDetails) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Invalid agency ID." });
    }

    res.status(200).json({
      status: true,
      message: "Host request successfully sent.",
    });

    const newHost = new Host({
      fcmToken,
      userId,
      agencyId: agencyDetails ? agencyDetails._id : null,
      name,
      bio,
      dob,
      gender,
      countryFlagImage,
      country,
      language: language || "",
      impression,
      image: req.files.image ? req.files.image[0].path : "",
      identityProof: req.files.identityProof ? req.files.identityProof[0].path : "",
      photoGallery: req.files.photoGallery?.map((file) => file.path) || [],
      uniqueId,
      status: 1,
      date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    });

    await newHost.save();

    if (fcmToken && fcmToken !== null) {
      const payload = {
        token: fcmToken,
        notification: {
          title: "🎙️ Host Application Received 🚀",
          body: "Thank you for applying as a host! Our team is reviewing your request, and we'll update you soon. Stay tuned! 🤝✨",
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
  } catch (error) {
    if (req.files) deleteFiles(req.files);
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get host's request status
exports.verifyHostRequestStatus = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: "Unauthorized access. Invalid token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const host = await Host.findOne({ userId: userId }).select("status").lean();
    if (!host) {
      return res.status(200).json({ status: false, message: "Request not found for that user!" });
    }

    return res.status(200).json({
      status: true,
      message: "Request status retrieved successfully",
      data: host?.status,
    });
  } catch (error) {
    console.error("Error fetching request status:", error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
