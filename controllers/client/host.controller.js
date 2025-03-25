const Host = require("../../models/host.model");

//import model
const Agency = require("../../models/agency.model");
const Impression = require("../../models/impression.model");
const History = require("../../models/history.model");

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

//host request ( user )
exports.initiateHostRequest = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const { fcmToken, name, bio, dob, gender, countryFlagImage, country, language, impression, agencyCode } = req.body;

    if (!fcmToken || !name || !bio || !dob || !gender || !countryFlagImage || !country || !impression || !language || !req.files) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Oops ! Invalid details." });
    }

    const [uniqueId, agencyDetails, existingHost, declineHostRequest] = await Promise.all([
      generateUniqueId(),
      agencyCode ? Agency.findOne({ code: agencyCode }).select("_id").lean() : null,
      Host.findOne({ status: 1, userId: userId }).select("_id").lean(),
      Host.findOne({ status: 3, userId: userId }).select("_id").lean(),
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

    if (declineHostRequest) {
      await Host.findByIdAndDelete(declineHostRequest);
    }

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
      language,
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

//get host's request status ( user )
exports.verifyHostRequestStatus = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
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

//get host thumblist ( user )
exports.retrieveHosts = async (req, res) => {
  try {
    if (!settingJSON) {
      return res.status(200).json({ status: false, message: "Configuration settings not found." });
    }

    if (!req.query.country) {
      return res.status(200).json({ status: false, message: "Please provide a country name." });
    }

    const country = req.query.country.trim().toLowerCase();
    const isGlobal = country === "global";

    const fakeMatchQuery = isGlobal ? { isFake: true, isBlock: false } : { country: country, isFake: true, isBlock: false };
    const matchQuery = isGlobal ? { isFake: false, isBlock: false } : { country: country, isFake: false, isBlock: false };

    const followedHostQuery = { isFake: false, isBlock: false };

    const [fakeHost, host, followedHost] = await Promise.all([
      Host.find(fakeMatchQuery).select("_id name countryFlagImage country image privateCallRate isFake").lean(),
      Host.aggregate([
        { $match: matchQuery },
        {
          $addFields: {
            status: {
              $switch: {
                branches: [
                  {
                    case: {
                      $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", false] }, { $eq: ["$isBusy", false] }],
                    },
                    then: "Online",
                  },
                  {
                    case: {
                      $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", true] }, { $eq: ["$isBusy", true] }],
                    },
                    then: "Live",
                  },
                  {
                    case: {
                      $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", true] }],
                    },
                    then: "Busy",
                  },
                ],
                default: "Offline",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            countryFlagImage: 1,
            country: 1,
            image: 1,
            privateCallRate: 1,
            isFake: 1,
            status: 1,
          },
        },
      ]),
      Host.aggregate([
        { $match: followedHostQuery },
        {
          $addFields: {
            status: {
              $switch: {
                branches: [
                  {
                    case: {
                      $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", false] }, { $eq: ["$isBusy", false] }],
                    },
                    then: "Online",
                  },
                  {
                    case: {
                      $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", true] }, { $eq: ["$isBusy", true] }],
                    },
                    then: "Live",
                  },
                  {
                    case: {
                      $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", true] }],
                    },
                    then: "Busy",
                  },
                ],
                default: "Offline",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            countryFlagImage: 1,
            country: 1,
            image: 1,
            privateCallRate: 1,
            isFake: 1,
            status: 1,
          },
        },
      ]),
    ]);

    return res.status(200).json({
      status: true,
      message: "Hosts list retrieved successfully.",
      followedHost,
      hosts: settingJSON.isDemoData ? [...fakeHost, ...host] : host,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching the hosts list.",
      error: error.message || "Internal Server Error",
    });
  }
};

//get host profile ( user ) ( host )
exports.fetchHostInfo = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid details." });
    }

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

    const [host, receivedGifts] = await Promise.all([
      Host.findOne({ _id: hostId, isBlock: false }).select("name email bio countryFlagImage country impression language image photoGallery privateCallRate randomCallRate chatRate coin").lean(),
      History.aggregate([
        { $match: { hostId: hostId, giftId: { $ne: null } } },
        {
          $group: {
            _id: "$giftId",
            totalReceived: { $sum: "$giftCount" }, // Sum total gift count for each gift
            lastReceivedAt: { $max: "$createdAt" }, // Get the latest received time
          },
        },
        {
          $lookup: {
            from: "gifts",
            localField: "_id",
            foreignField: "_id",
            as: "giftDetails",
          },
        },
        { $unwind: "$giftDetails" },
        {
          $project: {
            giftId: "$_id",
            giftType: "$giftDetails.type",
            giftImage: "$giftDetails.image",
            giftCoin: "$giftDetails.coin",
            totalReceived: 1,
            lastReceivedAt: 1,
          },
        },
      ]),
    ]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    return res.status(200).json({ status: true, message: "The host profile retrieved.", host, receivedGifts });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
