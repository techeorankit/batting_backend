const Host = require("../../models/host.model");
const User = require("../../models/user.model");
const Agency = require("../../models/agency.model");
const WithdrawalRequest = require("../../models/withdrawalRequest.model");
const Block = require("../../models/block.model");
const FollowerFollowing = require("../../models/followerFollowing.model");
const History = require("../../models/history.model");
const HostMatchHistory = require("../../models/hostMatchHistory.model");
const LiveBroadcaster = require("../../models/liveBroadcaster.model");
const LiveBroadcastHistory = require("../../models/liveBroadcastHistory.model");
const Report = require("../../models/report.model");

//private key
const admin = require("../../util/privateKey");

//mongoose
const mongoose = require("mongoose");

//fs
const fs = require("fs");

//deletefile
const { deleteFiles } = require("../../util/deletefile");

//generateUniqueId
const generateUniqueId = require("../../util/generateUniqueId");

//retrive host requests
exports.fetchHostRequest = async (req, res) => {
  try {
    if (!req.query.status) {
      return res.status(200).json({ status: false, message: "Oops ! Invalid details!" });
    }

    const start = Math.max(parseInt(req.query.start) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 20, 1);

    const statusParam = req.query.status;
    const search = req.query.search && req.query.search.trim().toLowerCase() !== "all" ? req.query.search.trim() : null;

    let matchQuery = { isFake: false };
    if (statusParam !== "All") {
      const statusInt = parseInt(statusParam);
      matchQuery.status = statusInt;
      if (statusInt === 1) matchQuery.agencyId = null;
    }

    const result = await Host.aggregate([
      { $match: matchQuery },

      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userId",
          pipeline: [{ $project: { _id: 1, name: 1, image: 1, uniqueId: 1 } }],
        },
      },
      { $unwind: { path: "$userId", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "agencies",
          localField: "agencyId",
          foreignField: "_id",
          as: "agency",
          pipeline: [{ $project: { _id: 1, name: 1, image: 1, agencyCode: 1 } }],
        },
      },
      { $unwind: { path: "$agency", preserveNullAndEmptyArrays: true } },

      ...(search
        ? [
            {
              $match: {
                $or: [
                  { "userId.name": { $regex: search, $options: "i" } },
                  { "userId.uniqueId": { $regex: search, $options: "i" } },

                  { "agency.name": { $regex: search, $options: "i" } },
                  { "agency.agencyCode": { $regex: search, $options: "i" } },

                  { name: { $regex: search, $options: "i" } },
                  { uniqueId: { $regex: search, $options: "i" } },
                  { email: { $regex: search, $options: "i" } },
                ],
              },
            },
          ]
        : []),

      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $sort: { createdAt: -1 } }, { $skip: (start - 1) * limit }, { $limit: limit }],
        },
      },
    ]);

    const total = result[0]?.metadata[0]?.total || 0;
    const request = result[0]?.data || [];

    return res.status(200).json({
      status: true,
      message: "Retrieve host's request for admin.",
      total,
      data: request,
    });
  } catch (error) {
    console.error("fetchHostRequest error:", error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//accept Or decline host request
exports.handleHostRequest = async (req, res) => {
  try {
    if (!settingJSON) {
      return res.status(200).json({ status: false, message: "Setting not found." });
    }

    const { requestId, userId, status, reason } = req.body || {};

    if (!requestId || !userId || !status) {
      return res.status(200).json({ status: false, message: "Invalid details provided." });
    }

    const hostObjectId = new mongoose.Types.ObjectId(requestId);
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const statusNumber = Number(status);

    const host = await Host.findOne({ _id: hostObjectId });

    if (!host) {
      return res.status(200).json({ status: false, message: "Host request not found." });
    }

    if (host.status === 2) {
      return res.status(200).json({
        status: false,
        message: "Host request has already been accepted.",
      });
    }

    if (host.status === 3) {
      return res.status(200).json({
        status: false,
        message: "Host request has already been rejected.",
      });
    }

    if (statusNumber === 2) {
      if (host.agencyId === null) {
        return res.status(200).json({
          status: false,
          message: "Please assign this host to an agency before accepting the request.",
        });
      }

      host.status = 2;
      host.randomCallRate = settingJSON.generalRandomCallRate;
      host.randomCallFemaleRate = settingJSON.femaleRandomCallRate;
      host.randomCallMaleRate = settingJSON.maleRandomCallRate;
      host.privateCallRate = settingJSON.videoPrivateCallRate;
      host.audioCallRate = settingJSON.audioPrivateCallRate;
      host.chatRate = settingJSON.chatInteractionRate;
      await host.save();

      res.status(200).json({
        status: true,
        message: "Host request accepted successfully.",
        data: host,
      });

      const user = await User.findOne({ _id: userObjectId }).select("isHost hostId");
      if (user) {
        user.isHost = true;
        user.hostId = host._id;
        await user.save();
      }

      if (host.fcmToken) {
        const payload = {
          token: host.fcmToken,
          data: {
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
        return res.status(200).json({
          status: false,
          message: "Please provide a reason for rejection.",
        });
      }

      host.status = 3;
      host.reason = reason.trim();
      await host.save();

      res.status(200).json({
        status: true,
        message: "Host request rejected successfully.",
        data: host,
      });

      if (host.fcmToken) {
        const payload = {
          token: host.fcmToken,
          data: {
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
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

//assign host under agency
exports.assignHostToAgency = async (req, res) => {
  try {
    const { requestId, agencyId, userId } = req.query;

    if (!requestId || !agencyId || !userId) {
      return res.status(200).json({
        status: false,
        message: "Required parameters missing: requestId or agencyId.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(requestId) || !mongoose.Types.ObjectId.isValid(agencyId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(200).json({
        status: false,
        message: "Invalid requestId or agencyId or userId format. Must be a valid ObjectId.",
      });
    }

    const requestObjectId = new mongoose.Types.ObjectId(requestId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const [hostRequest, agency, user] = await Promise.all([
      Host.findOne({ _id: requestObjectId, status: 1 }),
      Agency.findById(agencyId).select("_id name agencyCode").lean(),
      User.findById(userObjectId).select("_id").lean(),
    ]);

    if (!hostRequest) {
      return res.status(200).json({ status: false, message: "Host request not found." });
    }

    if (hostRequest.agencyId !== null) {
      return res.status(200).json({ status: false, message: "This host request is already assigned to an agency." });
    }

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found." });
    }

    if (!user) {
      return res.status(200).json({ status: false, message: "User not found." });
    }

    if (hostRequest.status === 2) {
      return res.status(200).json({ status: false, message: "This host request has already been accepted." });
    }

    if (hostRequest.status === 3) {
      return res.status(200).json({ status: false, message: "This host request has already been rejected." });
    }

    hostRequest.agencyId = agency._id;
    hostRequest.status = 2;
    hostRequest.randomCallRate = settingJSON.generalRandomCallRate;
    hostRequest.randomCallFemaleRate = settingJSON.femaleRandomCallRate;
    hostRequest.randomCallMaleRate = settingJSON.maleRandomCallRate;
    hostRequest.privateCallRate = settingJSON.videoPrivateCallRate;
    hostRequest.audioCallRate = settingJSON.audioPrivateCallRate;
    hostRequest.chatRate = settingJSON.chatInteractionRate;

    res.status(200).json({
      status: true,
      message: "Host successfully assigned to the agency.",
      request: { ...hostRequest.toObject(), agency },
    });

    await Promise.all([
      hostRequest.save(),
      User.updateOne(
        { _id: user._id },
        {
          $set: {
            isHost: true,
            hostId: hostRequest._id,
          },
        },
      ),
    ]);

    if (hostRequest.fcmToken) {
      const payload = {
        token: hostRequest.fcmToken,
        data: {
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
  } catch (error) {
    console.error("Error in assignHostToAgency:", error);
    return res.status(500).json({ status: false, message: "Internal Server Error", error: error.message });
  }
};

//get agency's hosts
exports.listAgencyHosts = async (req, res) => {
  try {
    if (!req.query.agencyId || !mongoose.Types.ObjectId.isValid(req.query.agencyId)) {
      return res.status(200).json({
        status: false,
        message: "Valid agencyId is required",
      });
    }

    const agencyId = new mongoose.Types.ObjectId(req.query.agencyId);

    const start = Math.max(parseInt(req.query.start) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 20, 1);

    const search = req.query.search?.trim() || "All";
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    const genderFilter = req?.query?.gender;
    const isBlockFilter = req?.query?.isBlock;
    const isOnlineFilter = req?.query?.isOnline;
    const isBusyFilter = req?.query?.isBusy;
    const isLiveFilter = req?.query?.isLive;
    const countryFilter = req?.query?.country?.trim()?.toLowerCase() || "";

    let dateFilter = {};
    if (startDate && endDate && startDate !== "All" && endDate !== "All") {
      const s = new Date(startDate);
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      dateFilter.createdAt = { $gte: s, $lte: e };
    }

    let searchFilter = {};
    if (search && search !== "All") {
      searchFilter.$or = [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }, { uniqueId: { $regex: search, $options: "i" } }];
    }

    let matchStage = {
      agencyId,
      status: 2,
      isFake: false,
      ...dateFilter,
      ...searchFilter,
    };

    if (genderFilter) {
      matchStage.gender = genderFilter;
    }

    if (isBlockFilter) {
      matchStage.isBlock = isBlockFilter === "true";
    }

    if (isOnlineFilter) {
      matchStage.isOnline = isOnlineFilter === "true";
    }

    if (isBusyFilter) {
      matchStage.isBusy = isBusyFilter === "true";
    }

    if (isLiveFilter) {
      matchStage.isLive = isLiveFilter === "true";
    }

    if (countryFilter) {
      matchStage.country = { $regex: `^${countryFilter}$`, $options: "i" };
    }

    const result = await Host.aggregate([
      { $match: matchStage },

      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: (start - 1) * limit },
            { $limit: limit },
            {
              $lookup: {
                from: "followerfollowings",
                localField: "_id",
                foreignField: "followingId",
                pipeline: [{ $count: "count" }],
                as: "followers",
              },
            },
            {
              $addFields: {
                totalFollowers: {
                  $ifNull: [{ $arrayElemAt: ["$followers.count", 0] }, 0],
                },
              },
            },
            {
              $project: {
                name: 1,
                coin: 1,
                gender: 1,
                image: 1,
                profileVideo: 1,
                impression: 1,
                identityProofType: 1,
                identityProof: 1,
                uniqueId: 1,
                isOnline: 1,
                isBusy: 1,
                isLive: 1,
                countryFlagImage: 1,
                country: 1,
                totalFollowers: 1,
                createdAt: 1,
                photoGallery: 1,
                profileVideo: 1,
                isBlock: 1,
                randomCallRate: 1,
                randomCallFemaleRate: 1,
                randomCallMaleRate: 1,
                privateCallRate: 1,
                audioCallRate: 1,
                chatRate: 1,
              },
            },
          ],
        },
      },
    ]);

    const totalHosts = result[0]?.metadata[0]?.total || 0;
    const hosts = result[0]?.data || [];

    return res.status(200).json({
      status: true,
      message: "Agency wise hosts fetched successfully",
      total: totalHosts,
      hosts,
    });
  } catch (error) {
    console.error("listAgencyHosts error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

//create host
exports.createHost = async (req, res) => {
  try {
    const { name, bio, dob, gender, countryFlagImage, country, language, impression, email } = req.body;

    if (
      !name ||
      !bio ||
      !dob ||
      !gender ||
      !countryFlagImage ||
      !country ||
      !impression ||
      !language ||
      !req.files ||
      !Array.isArray(req.files.image) ||
      req.files.image.length === 0 ||
      !Array.isArray(req.files.video) ||
      req.files.video.length === 0 ||
      !Array.isArray(req.files.liveVideo) ||
      req.files.liveVideo.length === 0 ||
      !Array.isArray(req.files.profileVideo) ||
      req.files.profileVideo.length === 0
    ) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({
        status: false,
        message: "Missing or invalid host details or required media files (image, video, liveVideo, profileVideo).",
      });
    }

    const hasInvalidFile = (arr) => arr?.some((file) => !file?.path);

    if (hasInvalidFile(req.files.image) || hasInvalidFile(req.files.video) || hasInvalidFile(req.files.liveVideo) || (req.files.photoGallery && hasInvalidFile(req.files.photoGallery))) {
      deleteFiles(req.files);
      return res.status(200).json({
        status: false,
        message: "Invalid file(s) uploaded. Ensure files are uploaded properly without 'url' fields.",
      });
    }

    const [uniqueId, existingHost] = await Promise.all([generateUniqueId(), Host.findOne({ email: email?.trim() }).select("_id").lean()]);

    if (existingHost) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({
        status: false,
        message: "A host profile with this email already exists.",
      });
    }

    const newHost = new Host({
      name,
      email,
      bio,
      dob,
      gender,
      countryFlagImage,
      country: country.trim().toLowerCase(),
      language,
      impression,
      image: req.files.image ? req.files.image[0].path : "",
      photoGallery: req.files.photoGallery?.map((file) => file.path) || [],
      video: req.files.video?.map((file) => file.path) || [],
      profileVideo: req.files.profileVideo?.map((file) => file.path) || [],
      liveVideo: req.files.liveVideo?.map((file) => file.path) || [],
      uniqueId,
      status: 2,
      isFake: true,
      randomCallRate: settingJSON.generalRandomCallRate,
      randomCallFemaleRate: settingJSON.femaleRandomCallRate,
      randomCallMaleRate: settingJSON.maleRandomCallRate,
      privateCallRate: settingJSON.videoPrivateCallRate,
      audioCallRate: settingJSON.audioPrivateCallRate,
      chatRate: settingJSON.chatInteractionRate,
      date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    });

    await newHost.save();

    return res.status(200).json({
      status: true,
      message: "Host created successfully.",
      host: newHost,
    });
  } catch (error) {
    if (req.files) deleteFiles(req.files);
    console.error("Create Host Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Failed to create host profile due to server error.",
    });
  }
};

//update host
exports.updateHost = async (req, res) => {
  try {
    console.log("📥 req.body updateHost:", req.body);
    console.log("📁 req.files updateHost:", req.files);

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
      removeProfileVideoIndex,
      removeLiveVideoIndex,
      removePhotoGalleryIndex,
      removeVideoIndexes,
    } = req.body;

    const isProvided = (v) => v !== undefined && v !== null;
    const validateRate = (value, min, fieldName) => {
      const num = Number(value);
      if (Number.isNaN(num)) {
        return `${fieldName} must be a valid number.`;
      }
      if (num < min) {
        return `${fieldName} cannot be less than minimum allowed (${min}).`;
      }
      return null;
    };

    const arrayFields = ["removeProfileVideoIndex", "removeLiveVideoIndex", "removePhotoGalleryIndex", "removeVideoIndexes"];

    for (const key of arrayFields) {
      if (req.body[key]) {
        if (typeof req.body[key] === "string") {
          try {
            req.body[key] = JSON.parse(req.body[key]);
          } catch (e) {
            if (req.files) deleteFiles(req.files);
            return res.status(200).json({
              status: false,
              message: `Invalid format for '${key}'. It must be a valid JSON array.`,
            });
          }
        }

        if (!Array.isArray(req.body[key])) {
          if (req.files) deleteFiles(req.files);
          return res.status(200).json({
            status: false,
            message: `'${key}' must be an array.`,
          });
        }
      }
    }

    if (!hostId) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Missing hostId." });
    }

    const [host, existingHost] = await Promise.all([
      Host.findById(hostId),
      email
        ? Host.findOne({ email: email.trim(), _id: { $ne: hostId } })
            .select("_id")
            .lean()
        : null,
    ]);

    if (!host) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    if (existingHost) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Email already in use." });
    }

    const validations = [];

    if (isProvided(randomCallRate)) validations.push(validateRate(randomCallRate, settingJSON.generalRandomCallRate, "Random call rate"));
    if (isProvided(randomCallFemaleRate)) validations.push(validateRate(randomCallFemaleRate, settingJSON.femaleRandomCallRate, "Female random call rate"));
    if (isProvided(randomCallMaleRate)) validations.push(validateRate(randomCallMaleRate, settingJSON.maleRandomCallRate, "Male random call rate"));
    if (isProvided(privateCallRate)) validations.push(validateRate(privateCallRate, settingJSON.videoPrivateCallRate, "Private video call rate"));
    if (isProvided(audioCallRate)) validations.push(validateRate(audioCallRate, settingJSON.audioPrivateCallRate, "Audio call rate"));
    if (isProvided(chatRate)) validations.push(validateRate(chatRate, settingJSON.chatInteractionRate, "Chat rate"));

    const error = validations.find(Boolean);
    if (error) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: error });
    }

    host.name = name || host?.name;
    host.email = email || host?.email;
    host.bio = bio || host?.bio;
    host.dob = dob || host?.dob;
    host.gender = gender || host?.gender;
    host.countryFlagImage = countryFlagImage || host?.countryFlagImage;
    host.country = country?.trim()?.toLowerCase() || host?.country;
    host.impression = typeof impression === "string" ? impression?.split(",") : Array.isArray(impression) ? impression : host?.impression;
    host.language = typeof language === "string" ? language?.split(",") : Array.isArray(language) ? language : host?.language;
    host.randomCallRate = randomCallRate || host?.randomCallRate;
    host.randomCallFemaleRate = randomCallFemaleRate || host?.randomCallFemaleRate;
    host.randomCallMaleRate = randomCallMaleRate || host?.randomCallMaleRate;
    host.privateCallRate = privateCallRate || host?.privateCallRate;
    host.audioCallRate = audioCallRate || host?.audioCallRate;
    host.chatRate = chatRate || host?.chatRate;

    if (req.files?.image?.[0]) {
      if (host.image && fs.existsSync(host.image)) {
        fs.unlinkSync(host.image);
        console.log("🗑️ Deleted previous image:", host.image);
      }
      host.image = req.files.image[0].path;
      console.log("🆕 Updated image:", host.image);
    }

    if (Array.isArray(req.body.removePhotoGalleryIndex)) {
      const sorted = req.body.removePhotoGalleryIndex
        .map(Number)
        .filter((i) => !isNaN(i))
        .sort((a, b) => b - a);
      for (const i of sorted) {
        const filePath = host.photoGallery?.[i];
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Deleted photoGallery[${i}]: ${filePath}`);
        }
        host.photoGallery.splice(i, 1);
      }
    }

    if (req.files?.photoGallery) {
      const newPhotos = req.files.photoGallery.filter((f) => f?.path).map((f) => f.path);
      host.photoGallery = [...(host.photoGallery || []), ...newPhotos];
      newPhotos.forEach((path, idx) => console.log(`🆕 Added photoGallery[${host.photoGallery.length - newPhotos.length + idx}]: ${path}`));
    }

    if (Array.isArray(req.body.removeVideoIndexes)) {
      const sorted = req.body.removeVideoIndexes
        .map(Number)
        .filter((i) => !isNaN(i))
        .sort((a, b) => b - a);
      for (const i of sorted) {
        const videoPath = host.video?.[i];
        if (videoPath && fs.existsSync(videoPath)) {
          fs.unlinkSync(videoPath);
          console.log(`🗑️ Deleted video[${i}]: ${videoPath}`);
        }
        host.video.splice(i, 1);
      }
    }

    if (req.files?.video?.length) {
      const newVideos = req.files.video.map((file) => file.path);
      host.video = host.video.concat(newVideos);
      newVideos.forEach((path, idx) => console.log(`🆕 Added video[${host.video.length - newVideos.length + idx}]: ${path}`));
    }

    if (Array.isArray(req.body.removeLiveVideoIndex)) {
      const sorted = req.body.removeLiveVideoIndex
        .map(Number)
        .filter((i) => !isNaN(i))
        .sort((a, b) => b - a);
      for (const i of sorted) {
        const filePath = host.liveVideo?.[i];
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Deleted liveVideo[${i}]: ${filePath}`);
        }
        host.liveVideo.splice(i, 1);
      }
    }

    if (req.files?.liveVideo) {
      const newVideos = req.files.liveVideo.filter((f) => f?.path).map((f) => f.path);
      host.liveVideo = [...(host.liveVideo || []), ...newVideos];
      newVideos.forEach((path, idx) => console.log(`🆕 Added liveVideo[${host.liveVideo.length - newVideos.length + idx}]: ${path}`));
    }

    if (Array.isArray(req.body.removeProfileVideoIndex)) {
      const sorted = req.body.removeProfileVideoIndex
        .map(Number)
        .filter((i) => !isNaN(i))
        .sort((a, b) => b - a);
      for (const i of sorted) {
        const filePath = host.profileVideo?.[i];
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Deleted profileVideo[${i}]: ${filePath}`);
        }
        host.profileVideo.splice(i, 1);
      }
    }

    if (req.files?.profileVideo) {
      const newVideos = req.files.profileVideo.filter((f) => f?.path).map((f) => f.path);
      host.profileVideo = [...(host.profileVideo || []), ...newVideos];
      newVideos.forEach((path, idx) => console.log(`🆕 Added profileVideo[${host.profileVideo.length - newVideos.length + idx}]: ${path}`));
    }

    await host.save();

    console.log("✅ Final image:", host.image);
    console.log("✅ Final photoGallery:", host.photoGallery);
    console.log("✅ Final video:", host.video);
    console.log("✅ Final liveVideo:", host.liveVideo);
    console.log("✅ Final profileVideo:", host.profileVideo);

    return res.status(200).json({
      status: true,
      message: "Host profile updated successfully.",
      host,
    });
  } catch (error) {
    if (req.files) deleteFiles(req.files);
    console.error("❌ Update Host Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Failed to update host profile due to server error.",
    });
  }
};

//toggle host status
exports.toggleHostStatusByType = async (req, res) => {
  try {
    const { hostId, type } = req.query;

    if (!hostId || !type) {
      return res.status(200).json({ status: false, message: "Host ID and type are required!" });
    }

    if (!mongoose.Types.ObjectId.isValid(hostId)) {
      return res.status(200).json({ status: false, message: "Invalid hostId format." });
    }

    const validTypes = ["isBlock", "isBusy", "isLive"];
    if (!validTypes.includes(type)) {
      return res.status(200).json({
        status: false,
        message: `Invalid type. Valid types: ${validTypes.join(", ")}`,
      });
    }

    const host = await Host.findOne({ _id: hostId });
    if (!host) {
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    host[type] = !host[type];
    await host.save();

    return res.status(200).json({
      status: true,
      message: `Host ${type} status has been ${host[type] ? "enabled" : "disabled"} successfully.`,
      data: host,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

//get host's profile
exports.fetchHostProfile = async (req, res) => {
  try {
    const { hostId } = req.query;

    if (!hostId) {
      return res.status(200).json({ status: false, message: "Host ID must be required!" });
    }

    if (!mongoose.Types.ObjectId.isValid(hostId)) {
      return res.status(200).json({ status: false, message: "Invalid hostId format." });
    }

    const [host] = await Promise.all([Host.findOne({ _id: hostId }).populate("agencyId", "name image agencyCode")]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    return res.status(200).json({
      status: true,
      message: "Host profile retrieved successfully.",
      host: host,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get hosts
exports.fetchHostList = async (req, res) => {
  try {
    if (!req.query.type) {
      return res.status(200).json({ status: false, message: "Host type is required!" });
    }

    const start = Math.max(parseInt(req.query.start) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 20, 1);

    const hostType = parseInt(req.query.type);
    const search = req.query.search?.trim() || "All";
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    const genderFilter = req.query.gender;
    const isBlockFilter = req.query.isBlock;
    const isOnlineFilter = req.query.isOnline;
    const isBusyFilter = req.query.isBusy;
    const isLiveFilter = req.query.isLive;
    const countryFilter = req?.query?.country?.trim()?.toLowerCase() || "";

    let dateFilter = {};
    if (startDate && endDate && startDate !== "All" && endDate !== "All") {
      const s = new Date(startDate);
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      dateFilter.createdAt = { $gte: s, $lte: e };
    }

    let filter = {
      status: 2,
      isFake: hostType === 1 ? false : true,
      ...dateFilter,
    };

    if (genderFilter) {
      filter.gender = genderFilter;
    }

    if (isBlockFilter) {
      filter.isBlock = isBlockFilter === "true";
    }

    if (isOnlineFilter) {
      filter.isOnline = isOnlineFilter === "true";
    }

    if (isBusyFilter) {
      filter.isBusy = isBusyFilter === "true";
    }

    if (isLiveFilter) {
      filter.isLive = isLiveFilter === "true";
    }

    if (countryFilter) {
      filter.country = { $regex: `^${countryFilter}$`, $options: "i" };
    }

    const result = await Host.aggregate([
      { $match: filter },

      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          pipeline: [{ $project: { _id: 1, name: 1, image: 1, uniqueId: 1 } }],
          as: "userId",
        },
      },
      { $unwind: { path: "$userId", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "agencies",
          localField: "agencyId",
          foreignField: "_id",
          pipeline: [{ $project: { _id: 1, name: 1, image: 1, agencyCode: 1 } }],
          as: "agencyId",
        },
      },
      { $unwind: { path: "$agencyId", preserveNullAndEmptyArrays: true } },

      ...(search && search !== "All"
        ? [
            {
              $match: {
                $or: [
                  { "userId.name": { $regex: search, $options: "i" } },
                  { "userId.uniqueId": { $regex: search, $options: "i" } },

                  { "agencyId.name": { $regex: search, $options: "i" } },
                  { "agencyId.agencyCode": { $regex: search, $options: "i" } },

                  { name: { $regex: search, $options: "i" } },
                  { uniqueId: { $regex: search, $options: "i" } },
                  { email: { $regex: search, $options: "i" } },
                ],
              },
            },
          ]
        : []),

      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: (start - 1) * limit },
            { $limit: limit },
            {
              $lookup: {
                from: "followerfollowings",
                localField: "_id",
                foreignField: "followingId",
                pipeline: [{ $count: "count" }],
                as: "followers",
              },
            },
            {
              $addFields: {
                totalFollowers: {
                  $ifNull: [{ $arrayElemAt: ["$followers.count", 0] }, 0],
                },
              },
            },
            {
              $project: {
                name: 1,
                gender: 1,
                bio: 1,
                age: 1,
                dob: 1,
                email: 1,
                image: 1,
                video: 1,
                liveVideo: 1,
                profileVideo: 1,
                impression: 1,
                identityProofType: 1,
                identityProof: 1,
                photoGallery: 1,
                uniqueId: 1,
                isBlock: 1,
                isOnline: 1,
                isBusy: 1,
                isLive: 1,
                countryFlagImage: 1,
                country: 1,
                randomCallRate: 1,
                randomCallFemaleRate: 1,
                randomCallMaleRate: 1,
                privateCallRate: 1,
                audioCallRate: 1,
                chatRate: 1,
                coin: 1,
                totalGifts: 1,
                language: 1,
                totalFollowers: 1,
                createdAt: 1,
                userId: 1,
                agencyId: 1,
              },
            },
          ],
        },
      },
    ]);

    const totalHosts = result[0]?.metadata[0]?.total || 0;
    const hostList = result[0]?.data || [];

    return res.status(200).json({
      status: true,
      message: "Hosts retrieved successfully",
      totalHosts,
      hostList,
    });
  } catch (error) {
    console.error("fetchHostList error:", error);
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

//delete host
exports.deleteHost = async (req, res) => {
  try {
    const { hostId } = req.query;

    if (!hostId) {
      return res.status(200).json({
        status: false,
        message: "Missing or invalid host details. Please check and try again.",
      });
    }

    const host = await Host.findOne({ _id: hostId }).select("_id image photoGallery video liveVideo profileVideo").lean();

    if (!host) {
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    res.status(200).json({
      status: true,
      message: "Host deleted successfully.",
    });

    if (host.image) {
      const imagePath = host.image.includes("storage") ? "storage" + host.image.split("storage")[1] : "";
      if (imagePath && fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
        } catch (error) {
          console.error(`Error deleting profile image: ${imagePath}`, error);
        }
      }
    }

    if (Array.isArray(host.photoGallery) && host.photoGallery.length > 0) {
      for (const photoUrl of host.photoGallery) {
        if (photoUrl) {
          const photoGalleryPath = photoUrl?.split("storage");
          if (photoGalleryPath?.[1]) {
            const filePath = "storage" + photoGalleryPath[1];
            if (fs.existsSync(filePath)) {
              try {
                fs.unlinkSync(filePath);
              } catch (error) {
                console.error(`Error deleting gallery image: ${filePath}`, error);
              }
            }
          }
        }
      }
    }

    if (Array.isArray(host.video) && host.video.length > 0) {
      for (const videoUrl of host.video) {
        const videoPath = videoUrl?.split("storage");
        if (videoPath?.[1]) {
          const filePath = "storage" + videoPath[1];
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (error) {
              console.error(`Error deleting gallery image: ${filePath}`, error);
            }
          }
        }
      }
    }

    if (Array.isArray(host.liveVideo) && host.liveVideo.length > 0) {
      for (const liveVideo of host.liveVideo) {
        const liveVideoPath = liveVideo?.split("storage");
        if (liveVideoPath?.[1]) {
          const filePath = "storage" + liveVideoPath[1];
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (error) {
              console.error(`Error deleting gallery image: ${filePath}`, error);
            }
          }
        }
      }
    }

    if (Array.isArray(host.profileVideo) && host.profileVideo.length > 0) {
      for (const profileVideo of host.profileVideo) {
        const profileVideoPath = profileVideo?.split("storage");
        if (profileVideoPath?.[1]) {
          const filePath = "storage" + profileVideoPath[1];
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (error) {
              console.error(`Error deleting gallery image: ${filePath}`, error);
            }
          }
        }
      }
    }

    await Promise.all([
      WithdrawalRequest.deleteMany({ hostId }),
      Block.deleteMany({ hostId }),
      FollowerFollowing.deleteMany({ followingId: hostId }),
      History.deleteMany({ hostId }),
      HostMatchHistory.deleteMany({ $or: [{ lastHostId: hostId }, { hostId: hostId }] }),
      LiveBroadcaster.deleteMany({ hostId }),
      LiveBroadcastHistory.deleteMany({ hostId }),
      Report.deleteMany({
        $or: [
          { targetId: host?._id, targetRole: "host" },
          { reporterId: host?._id, reporterRole: "host" },
        ],
      }),
      Host.deleteOne({ _id: hostId }),
    ]);
  } catch (error) {
    console.error("Delete Host Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Failed to delete host due to server error.",
    });
  }
};
