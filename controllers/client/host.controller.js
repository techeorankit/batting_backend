const Host = require("../../models/host.model");

//import model
const Agency = require("../../models/agency.model");
const Impression = require("../../models/impression.model");
const History = require("../../models/history.model");
const LiveBroadcaster = require("../../models/liveBroadcaster.model");
const Block = require("../../models/block.model");

//deleteFiles
const { deleteFiles } = require("../../util/deletefile");

//generateUniqueId
const generateUniqueId = require("../../util/generateUniqueId");

//private key
const admin = require("../../util/privateKey");

//mongoose
const mongoose = require("mongoose");

//fs
const fs = require("fs");

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

    const { fcmToken, name, bio, dob, gender, countryFlagImage, country, language, impression, agencyCode, identityProofType } = req.body;

    if (!fcmToken || !name || !bio || !dob || !gender || !countryFlagImage || !country || !impression || !language || !identityProofType || !req.files) {
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
      identityProofType,
      identityProof: req.files.identityProof?.map((file) => file.path) || [],
      image: req.files.image ? req.files.image[0].path : "",
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
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!settingJSON) {
      return res.status(200).json({ status: false, message: "Configuration settings not found." });
    }

    if (!req.query.country) {
      return res.status(200).json({ status: false, message: "Please provide a country name." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const country = req.query.country.trim().toLowerCase();
    const isGlobal = country === "global";

    const blockedHosts = await Block.find({ userId, blockedBy: "user" }).distinct("hostId");

    const fakeMatchQuery = isGlobal
      ? { isFake: true, isBlock: false, userId: { $ne: userId }, _id: { $nin: blockedHosts } }
      : { country: country, isFake: true, isBlock: false, userId: { $ne: userId }, _id: { $nin: blockedHosts } };

    const matchQuery = isGlobal
      ? { isFake: false, isBlock: false, status: 2, userId: { $ne: userId }, _id: { $nin: blockedHosts } }
      : { country: country, isFake: false, isBlock: false, status: 2, userId: { $ne: userId }, _id: { $nin: blockedHosts } };

    const [fakeHost, host, followedHost, liveHost, fakeLiveHost] = await Promise.all([
      Host.aggregate([
        { $match: fakeMatchQuery },
        {
          $addFields: {
            status: {
              $switch: {
                branches: [
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", false] }, { $eq: ["$isBusy", false] }] }, then: "Online" },
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", true] }, { $eq: ["$isBusy", true] }] }, then: "Live" },
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", true] }] }, then: "Busy" },
                ],
                default: "Offline",
              },
            },
            privateCallRate: 0,
            liveHistoryId: "",
            token: "",
            channel: "",
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
            video: 1,
            liveHistoryId: 1,
            token: 1,
            channel: 1,
          },
        },
      ]),
      Host.aggregate([
        { $match: matchQuery },
        {
          $addFields: {
            status: {
              $switch: {
                branches: [
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", false] }, { $eq: ["$isBusy", false] }] }, then: "Online" },
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", true] }, { $eq: ["$isBusy", true] }] }, then: "Live" },
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", true] }] }, then: "Busy" },
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
        {
          $lookup: {
            from: "followerfollowings",
            let: { hostId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ["$followerId", userId] }, { $eq: ["$followingId", "$$hostId"] }],
                  },
                },
              },
            ],
            as: "followInfo",
          },
        },
        {
          $match: {
            followInfo: { $ne: [] },
            isFake: false,
            isBlock: false,
            status: 2,
            userId: { $ne: userId },
            _id: { $nin: blockedHosts }, // block check here too
          },
        },
        {
          $addFields: {
            isFollowed: { $gt: [{ $size: "$followInfo" }, 0] },
            status: {
              $switch: {
                branches: [
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", false] }, { $eq: ["$isBusy", false] }] }, then: "Online" },
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", true] }, { $eq: ["$isBusy", true] }] }, then: "Live" },
                  { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", true] }] }, then: "Busy" },
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
      LiveBroadcaster.aggregate([
        {
          $match: {
            userId: { $ne: userId },
            hostId: { $nin: blockedHosts }, // block check for live
          },
        },
        {
          $addFields: {
            video: "",
          },
        },
        {
          $project: {
            _id: 1,
            hostId: 1,
            name: 1,
            countryFlagImage: 1,
            country: 1,
            image: 1,
            isFake: 1,
            liveHistoryId: 1,
            channel: 1,
            token: 1,
            view: 1,
            video: 1,
          },
        },
      ]),
      Host.aggregate([
        {
          $match: {
            isFake: true,
            isBlock: false,
            isLive: true,
            video: { $ne: "" },
            userId: { $ne: userId },
            _id: { $nin: blockedHosts },
          },
        },
        {
          $project: {
            _id: 1,
            hostId: "$_id",
            name: 1,
            countryFlagImage: 1,
            country: 1,
            image: 1,
            isFake: 1,
            liveHistoryId: 1,
            channel: 1,
            token: 1,
            view: 1,
            video: 1,
          },
        },
      ]),
    ]);

    return res.status(200).json({
      status: true,
      message: "Hosts list retrieved successfully.",
      followedHost,
      liveHost: settingJSON.isDemoData ? [...fakeLiveHost, ...liveHost] : liveHost,
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
      Host.findOne({ _id: hostId, isBlock: false })
        .select("name email bio countryFlagImage country impression language image photoGallery randomCallRate randomCallFemaleRate randomCallMaleRate privateCallRate audioCallRate chatRate coin")
        .lean(),
      History.aggregate([
        { $match: { hostId: hostId, giftId: { $ne: null } } },
        {
          $group: {
            _id: "$giftId",
            totalReceived: { $sum: "$giftCount" },
            lastReceivedAt: { $max: "$createdAt" },
            giftCoin: { $first: "$giftCoin" },
            giftImage: { $first: "$giftImage" },
            giftType: { $first: "$giftType" },
          },
        },
        {
          $project: {
            giftId: "$_id",
            giftCoin: { $ifNull: ["$giftCoin", 0] },
            giftImage: 1,
            giftType: 1,
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

//get random free host ( random video call ) ( user )
exports.retrieveAvailableHost = async (req, res) => {
  try {
    const { gender } = req.query;

    const validGenders = ["male", "female", "both"];
    if (!gender || !validGenders.includes(gender.trim().toLowerCase())) {
      return res.status(200).json({ status: false, message: "Gender is required and must be one of: male, female, or both." });
    }

    const normalizedGender = gender.trim().toLowerCase();

    if (normalizedGender !== "both") {
      const [genderMatchedHost] = await Promise.all([
        Host.aggregate([
          {
            $match: {
              isOnline: true,
              isBusy: false,
              isFake: false,
              isLive: false,
              status: 2,
              callId: null,
              gender: normalizedGender,
            },
          },
          { $sample: { size: 1 } },
        ]),
      ]);

      if (genderMatchedHost.length) {
        return res.status(200).json({
          status: true,
          message: "Matched host found based on gender!",
          data: genderMatchedHost[0],
        });
      }
    }

    const [anyAvailableHost] = await Promise.all([
      Host.aggregate([
        {
          $match: {
            isOnline: true,
            isBusy: false,
            isFake: false,
            isLive: false,
            status: 2,
            callId: null,
          },
        },
        { $sample: { size: 1 } },
      ]),
    ]);

    if (anyAvailableHost.length) {
      return res.status(200).json({
        status: true,
        message: "No gender match found, but available host retrieved!",
        data: anyAvailableHost[0],
      });
    }

    return res.status(200).json({
      status: false,
      message: "No available hosts found!",
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//update host's info
exports.modifyHostDetails = async (req, res) => {
  try {
    const {
      hostId,
      name,
      bio,
      dob,
      gender,
      countryFlagImage,
      country,
      language,
      impression,
      email,
      randomCallRate,
      randomCallFemaleRate,
      randomCallMaleRate,
      privateCallRate,
      audioCallRate,
      chatRate,
    } = req.body;

    if (!hostId) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Missing or invalid host details. Please check and try again." });
    }

    const [host, existingHost] = await Promise.all([Host.findOne({ _id: hostId }), email ? Host.findOne({ email: email?.trim() }).select("_id").lean() : null]);

    if (!host) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    if (existingHost) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "A host profile with this email already exists." });
    }

    host.name = name || host.name;
    host.email = email || host.email;
    host.bio = bio || host.bio;
    host.dob = dob || host.dob;
    host.gender = gender || host.gender;
    host.countryFlagImage = countryFlagImage || host.countryFlagImage;
    host.country = country || host.country;
    host.countryFlagImage = countryFlagImage || host.countryFlagImage;
    host.impression = typeof impression === "string" ? impression.split(",") : Array.isArray(impression) ? impression : host.impression;
    host.language = typeof language === "string" ? language.split(",") : Array.isArray(language) ? language : host.language;
    host.randomCallRate = randomCallRate || host.randomCallRate;
    host.randomCallFemaleRate = randomCallFemaleRate || host.randomCallFemaleRate;
    host.randomCallMaleRate = randomCallMaleRate || host.randomCallMaleRate;
    host.privateCallRate = privateCallRate || host.privateCallRate;
    host.audioCallRate = audioCallRate || host.audioCallRate;
    host.chatRate = chatRate || host.chatRate;

    if (req.files.image) {
      if (host.image) {
        const imagePath = host.image.includes("storage") ? "storage" + host.image.split("storage")[1] : "";
        if (imagePath && fs.existsSync(imagePath)) {
          const imageName = imagePath.split("/").pop();
          if (!["male.png", "female.png"].includes(imageName)) {
            fs.unlinkSync(imagePath);
          }
        }
      }

      host.image = req.files.image[0].path;
    }

    if (req.files.photoGallery) {
      if (host.photoGallery.length > 0) {
        for (const photo of host.photoGallery) {
          const photoGalleryPath = photo?.url?.split("storage");
          if (photoGalleryPath?.[1]) {
            const filePath = "storage" + photoGalleryPath[1];
            if (fs.existsSync(filePath)) {
              try {
                fs.unlinkSync(filePath);
              } catch (error) {
                console.error(`Error deleting file: ${filePath}`, error);
              }
            }
          }
        }
      }

      let updatedPhotoGallery = req.files.photoGallery.map((file) => ({ url: file.path }));
      host.photoGallery = updatedPhotoGallery;
    }

    await host.save();

    return res.status(200).json({
      status: true,
      message: "Host profile updated successfully.",
      host,
    });
  } catch (error) {
    if (req.files) deleteFiles(req.files);
    console.error("Update Host Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Failed to Update host profile due to server error.",
    });
  }
};
