const Host = require("../../models/host.model");

//import model
const Agency = require("../../models/agency.model");
const Impression = require("../../models/impression.model");
const History = require("../../models/history.model");
const LiveBroadcaster = require("../../models/liveBroadcaster.model");
const Block = require("../../models/block.model");
const HostMatchHistory = require("../../models/hostMatchHistory.model");
const FollowerFollowing = require("../../models/followerFollowing.model");
const User = require("../../models/user.model");
const Chat = require("../../models/chat.model");
const LiveBroadcastHistory = require("../../models/liveBroadcastHistory.model");
const Withdrawalrequest = require("../../models/withdrawalRequest.model");

//deleteFiles
const { deleteFile, deleteFiles } = require("../../util/deletefile");

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

//validate agencyCode ( user )
exports.validateAgencyCode = async (req, res) => {
  try {
    const { agencyCode } = req.query;

    if (!agencyCode) {
      return res.status(200).json({ status: false, message: "Agency code is required." });
    }

    const agencyExists = await Agency.exists({ agencyCode: agencyCode });

    if (agencyExists) {
      return res.status(200).json({ status: true, message: "Valid agency code.", isValid: true });
    } else {
      return res.status(200).json({ status: false, message: "Invalid agency code.", isValid: false });
    }
  } catch (error) {
    console.error("Error validating agency code:", error);
    return res.status(500).json({ status: false, message: "Internal server error." });
  }
};

//host request ( user )
exports.initiateHostRequest = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const { email, fcmToken, name, bio, dob, gender, countryFlagImage, country, language, impression, agencyCode, identityProofType } = req.body;

    if (!email || !fcmToken || !name || !bio || !dob || !gender || !countryFlagImage || !country || !impression || !language || !identityProofType || !req.files) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Oops ! Invalid details." });
    }

    if (!req.files.identityProof) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Identity proof is missing. Please upload a valid file." });
    }

    if (!req.files.photoGallery) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Photo gallery is missing. Please upload the required photos." });
    }

    if (!req.files.image) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Image is missing. Please upload a valid image." });
    }

    const [uniqueId, agencyDetails, existingHost, declineHostRequest] = await Promise.all([
      generateUniqueId(),
      agencyCode ? Agency.findOne({ agencyCode: agencyCode }).select("_id").lean() : null,
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

    const impressions = typeof impression === "string" ? impression.split(",").map((topic) => topic.trim()) : [];
    const languages = typeof language === "string" ? language.split(",").map((lang) => lang.trim()) : [];

    const newHost = new Host({
      email,
      fcmToken,
      userId,
      agencyId: agencyDetails ? agencyDetails._id : null,
      name,
      bio,
      dob,
      gender,
      countryFlagImage,
      country,
      language: languages,
      impression: impressions,
      identityProofType,
      identityProof: req.files.identityProof?.map((file) => file.path) || [],
      image: req.files.image ? req.files.image[0].path : "",
      photoGallery: req.files.photoGallery?.map((file) => file.path) || [],
      profileVideo: req.files.profileVideo?.map((file) => file.path) || [],
      uniqueId,
      status: 1,
      date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    });

    await newHost.save();

    if (fcmToken && fcmToken !== null) {
      const payload = {
        token: fcmToken,
        data: {
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
// exports.retrieveHosts = async (req, res) => {
//   try {
//     const start = req.query.start ? parseInt(req.query.start) : 1;
//     const limit = req.query.limit ? parseInt(req.query.limit) : 20;

//     if (!req.user || !req.user.userId) {
//       return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
//     }

//     if (!settingJSON) {
//       return res.status(200).json({ status: false, message: "Configuration settings not found." });
//     }

//     if (!req.query.country) {
//       return res.status(200).json({ status: false, message: "Please provide a country name." });
//     }

//     const userId = new mongoose.Types.ObjectId(req.user.userId);
//     const country = req.query.country.trim().toLowerCase();
//     const isGlobal = country === "global";

//     const fakeMatchQuery = isGlobal ? { isFake: true, isBlock: false, userId: { $ne: userId } } : { country: country, isFake: true, isBlock: false, userId: { $ne: userId } };
//     const fakeLiveMatchQuery = isGlobal
//       ? {
//           isFake: true,
//           isBlock: false,
//           userId: { $ne: userId },
//           video: { $ne: [] },
//         }
//       : {
//           country: country,
//           isFake: true,
//           isBlock: false,
//           userId: { $ne: userId },
//           video: { $ne: [] },
//         };
//     const matchQuery = isGlobal ? { isFake: false, isBlock: false, status: 2, userId: { $ne: userId } } : { country: country, isFake: false, isBlock: false, status: 2, userId: { $ne: userId } };

//     const [fakeHost, host, followedHost, liveHost, fakeLiveHost] = await Promise.all([
//       Host.aggregate([
//         { $match: fakeMatchQuery },
//         {
//           $lookup: {
//             from: "blocks",
//             let: { hostId: "$_id", userId: userId },
//             pipeline: [
//               {
//                 $match: {
//                   $expr: {
//                     $or: [{ $and: [{ $eq: ["$hostId", "$$hostId"] }, { $eq: ["$userId", "$$userId"] }] }, { $and: [{ $eq: ["$userId", "$$hostId"] }, { $eq: ["$hostId", "$$userId"] }] }],
//                   },
//                 },
//               },
//             ],
//             as: "blockInfo",
//           },
//         },
//         { $match: { blockInfo: { $eq: [] } } },
//         {
//           $addFields: {
//             status: {
//               $switch: {
//                 branches: [
//                   { case: { $lte: [{ $rand: {} }, 0.33] }, then: "Live" },
//                   { case: { $lte: [{ $rand: {} }, 0.66] }, then: "Busy" },
//                 ],
//                 default: "Online",
//               },
//             },
//             audioCallRate: 0,
//             privateCallRate: 0,
//             liveHistoryId: "",
//             token: "",
//             channel: "",
//             randomSort: { $rand: {} },
//           },
//         },
//         { $sort: { randomSort: 1 } },
//         {
//           $project: {
//             _id: 1,
//             name: 1,
//             countryFlagImage: 1,
//             country: 1,
//             image: 1,
//             audioCallRate: 1,
//             privateCallRate: 1,
//             isFake: 1,
//             status: 1,
//             video: 1,
//             liveVideo: 1,
//             liveHistoryId: 1,
//             token: 1,
//             channel: 1,
//             uniqueId: 1,
//             gender: 1,
//           },
//         },
//       ]),
//       Host.aggregate([
//         { $match: matchQuery },
//         {
//           $lookup: {
//             from: "blocks",
//             let: { hostId: "$_id", userId: userId },
//             pipeline: [
//               {
//                 $match: {
//                   $expr: {
//                     $or: [{ $and: [{ $eq: ["$hostId", "$$hostId"] }, { $eq: ["$userId", "$$userId"] }] }, { $and: [{ $eq: ["$userId", "$$hostId"] }, { $eq: ["$hostId", "$$userId"] }] }],
//                   },
//                 },
//               },
//             ],
//             as: "blockInfo",
//           },
//         },
//         { $match: { blockInfo: { $eq: [] } } },
//         {
//           $addFields: {
//             status: {
//               $switch: {
//                 branches: [
//                   { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", false] }, { $eq: ["$isBusy", false] }] }, then: "Online" },
//                   { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", true] }, { $eq: ["$isBusy", true] }] }, then: "Live" },
//                   { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", true] }] }, then: "Busy" },
//                 ],
//                 default: "Offline",
//               },
//             },
//             randomSort: { $rand: {} },
//           },
//         },
//         { $sort: { randomSort: 1 } },
//         {
//           $project: {
//             _id: 1,
//             name: 1,
//             countryFlagImage: 1,
//             country: 1,
//             image: 1,
//             audioCallRate: 1,
//             privateCallRate: 1,
//             isFake: 1,
//             status: 1,
//             liveHistoryId: 1,
//             token: 1,
//             channel: 1,
//           },
//         },
//       ]),
//       Host.aggregate([
//         {
//           $lookup: {
//             from: "followerfollowings",
//             let: { hostId: "$_id" },
//             pipeline: [
//               {
//                 $match: {
//                   $expr: {
//                     $and: [{ $eq: ["$followerId", userId] }, { $eq: ["$followingId", "$$hostId"] }],
//                   },
//                 },
//               },
//             ],
//             as: "followInfo",
//           },
//         },
//         {
//           $match: {
//             followInfo: { $ne: [] },
//             isBlock: false,
//             status: 2,
//             userId: { $ne: userId },
//           },
//         },
//         {
//           $lookup: {
//             from: "blocks",
//             let: { hostId: "$_id", userId: userId },
//             pipeline: [
//               {
//                 $match: {
//                   $expr: {
//                     $or: [{ $and: [{ $eq: ["$hostId", "$$hostId"] }, { $eq: ["$userId", "$$userId"] }] }, { $and: [{ $eq: ["$userId", "$$hostId"] }, { $eq: ["$hostId", "$$userId"] }] }],
//                   },
//                 },
//               },
//             ],
//             as: "blockInfo",
//           },
//         },
//         { $match: { blockInfo: { $eq: [] } } },
//         {
//           $addFields: {
//             isFollowed: { $gt: [{ $size: "$followInfo" }, 0] },
//             status: {
//               $switch: {
//                 branches: [
//                   { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", false] }, { $eq: ["$isBusy", false] }] }, then: "Online" },
//                   { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", true] }, { $eq: ["$isBusy", true] }] }, then: "Live" },
//                   { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", true] }] }, then: "Busy" },
//                 ],
//                 default: "Offline",
//               },
//             },
//           },
//         },
//         { $sort: { createdAt: -1 } },
//         { $skip: (start - 1) * limit },
//         { $limit: limit },
//         {
//           $project: {
//             _id: 1,
//             name: 1,
//             countryFlagImage: 1,
//             country: 1,
//             image: 1,
//             audioCallRate: 1,
//             privateCallRate: 1,
//             isFake: 1,
//             status: 1,
//             uniqueId: 1,
//             gender: 1,
//           },
//         },
//       ]),
//       LiveBroadcaster.aggregate([
//         { $match: { userId: { $ne: userId } } },
//         {
//           $lookup: {
//             from: "blocks",
//             let: { hostId: "$hostId", userId: userId },
//             pipeline: [
//               {
//                 $match: {
//                   $expr: {
//                     $or: [{ $and: [{ $eq: ["$hostId", "$$hostId"] }, { $eq: ["$userId", "$$userId"] }] }, { $and: [{ $eq: ["$userId", "$$hostId"] }, { $eq: ["$hostId", "$$userId"] }] }],
//                   },
//                 },
//               },
//             ],
//             as: "blockInfo",
//           },
//         },
//         { $match: { blockInfo: { $eq: [] } } },
//         {
//           $addFields: {
//             video: [],
//             liveVideo: [],
//             randomSort: { $rand: {} },
//           },
//         },
//         { $sort: { randomSort: 1 } },
//         {
//           $project: {
//             _id: 1,
//             hostId: 1,
//             name: 1,
//             countryFlagImage: 1,
//             country: 1,
//             image: 1,
//             isFake: 1,
//             liveHistoryId: 1,
//             channel: 1,
//             token: 1,
//             view: 1,
//             video: 1,
//             liveVideo: 1,
//           },
//         },
//       ]),
//       Host.aggregate([
//         { $match: fakeLiveMatchQuery },
//         {
//           $lookup: {
//             from: "blocks",
//             let: { hostId: "$_id", userId: userId },
//             pipeline: [
//               {
//                 $match: {
//                   $expr: {
//                     $or: [{ $and: [{ $eq: ["$hostId", "$$hostId"] }, { $eq: ["$userId", "$$userId"] }] }, { $and: [{ $eq: ["$userId", "$$hostId"] }, { $eq: ["$hostId", "$$userId"] }] }],
//                   },
//                 },
//               },
//             ],
//             as: "blockInfo",
//           },
//         },
//         { $match: { blockInfo: { $eq: [] } } },
//         {
//           $addFields: {
//             randomSort: { $rand: {} },
//           },
//         },
//         { $sort: { randomSort: 1 } },
//         {
//           $project: {
//             _id: 1,
//             hostId: "$_id",
//             name: 1,
//             countryFlagImage: 1,
//             country: 1,
//             image: 1,
//             isFake: 1,
//             liveHistoryId: 1,
//             channel: 1,
//             token: 1,
//             view: 1,
//             video: 1,
//             liveVideo: 1,
//           },
//         },
//       ]),
//     ]);

//     const statusPriority = { Live: 1, Online: 2, Busy: 3, Offline: 4 };

//     // Pagination for hosts
//     let allHosts = settingJSON.isDemoData ? [...fakeHost, ...host] : host;
//     allHosts.sort((a, b) => (statusPriority[a.status] || 5) - (statusPriority[b.status] || 5));
//     const paginatedHosts = allHosts.slice((start - 1) * limit, start * limit);

//     // Pagination for liveHost
//     let allLiveHosts = settingJSON.isDemoData ? [...liveHost, ...fakeLiveHost] : liveHost;
//     const paginatedLiveHosts = allLiveHosts.slice((start - 1) * limit, start * limit);

//     return res.status(200).json({
//       status: true,
//       message: "Hosts list retrieved successfully.",
//       followedHost,
//       liveHost: paginatedLiveHosts,
//       hosts: paginatedHosts,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       status: false,
//       message: "An error occurred while fetching the hosts list.",
//       error: error.message || "Internal Server Error",
//     });
//   }
// };

exports.retrieveHosts = async (req, res) => {
  try {
    const start = parseInt(req.query.start || 1);
    const limit = parseInt(req.query.limit || 20);
    const skip = (start - 1) * limit;

    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!settingJSON) {
      return res.status(200).json({ status: false, message: "Configuration settings not found." });
    }

    if (!req.query.country) {
      return res.status(200).json({ status: false, message: "Country required" });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const country = req.query.country.trim().toLowerCase();
    const isGlobal = country === "global";

    const now = new Date();
    const timeBlock = Math.floor(now.getMinutes() / 1);
    const userSeed =
      userId
        .toString()
        .split("")
        .reduce((a, c) => a + c.charCodeAt(0), 0) + timeBlock;

    const baseMatch = {
      isBlock: false,
      userId: { $ne: userId },
      ...(isGlobal ? {} : { country }),
      ...(settingJSON.isDemoData
        ? {
            $or: [
              { isFake: false, status: 2 },
              { isFake: true, status: 2 },
            ],
          }
        : {
            isFake: false,
            status: 2,
          }),
    };

    const fakeLiveMatchQuery = isGlobal
      ? {
          isFake: true,
          isBlock: false,
          userId: { $ne: userId },
          video: { $ne: [] },
        }
      : {
          country: country,
          isFake: true,
          isBlock: false,
          userId: { $ne: userId },
          video: { $ne: [] },
        };

    let [hosts, followedHost, liveHost, fakeLiveHost] = await Promise.all([
      Host.aggregate(
        [
          { $match: baseMatch },
          {
            $lookup: {
              from: "blocks",
              let: { hostId: "$_id", userId },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $or: [
                        {
                          $and: [{ $eq: ["$hostId", "$$hostId"] }, { $eq: ["$userId", "$$userId"] }],
                        },
                        {
                          $and: [{ $eq: ["$userId", "$$hostId"] }, { $eq: ["$hostId", "$$userId"] }],
                        },
                      ],
                    },
                  },
                },
              ],
              as: "blockInfo",
            },
          },
          { $match: { blockInfo: { $eq: [] } } },

          {
            $addFields: {
              status: {
                $cond: [
                  { $eq: ["$isFake", true] },
                  {
                    $switch: {
                      branches: [
                        { case: { $lte: [{ $rand: {} }, 0.33] }, then: "Live" },
                        { case: { $lte: [{ $rand: {} }, 0.66] }, then: "Busy" },
                      ],
                      default: "Online",
                    },
                  },
                  {
                    $switch: {
                      branches: [
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
                        {
                          case: { $eq: ["$isOnline", true] },
                          then: "Online",
                        },
                      ],
                      default: "Offline",
                    },
                  },
                ],
              },

              audioCallRate: { $ifNull: ["$audioCallRate", 0] },
              privateCallRate: { $ifNull: ["$privateCallRate", 0] },
              liveHistoryId: { $ifNull: ["$liveHistoryId", ""] },
              token: { $ifNull: ["$token", ""] },
              channel: { $ifNull: ["$channel", ""] },

              randomSortField: {
                $mod: [
                  {
                    $abs: {
                      $multiply: [{ $toLong: { $toDate: "$_id" } }, userSeed],
                    },
                  },
                  1234567,
                ],
              },

              statusRank: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$status", "Live"] }, then: 1 },
                    { case: { $eq: ["$status", "Online"] }, then: 2 },
                    { case: { $eq: ["$status", "Busy"] }, then: 3 },
                    { case: { $eq: ["$status", "Offline"] }, then: 4 },
                  ],
                  default: 5,
                },
              },
            },
          },

          {
            $sort: {
              statusRank: 1,
              randomSortField: 1,
              _id: 1,
            },
          },

          { $skip: skip },
          { $limit: limit },

          {
            $project: {
              _id: 1,
              name: 1,
              image: 1,
              country: 1,
              countryFlagImage: 1,
              audioCallRate: 1,
              privateCallRate: 1,
              isFake: 1,
              status: 1,
              video: 1,
              liveVideo: 1,
              liveHistoryId: 1,
              token: 1,
              channel: 1,
              uniqueId: 1,
              gender: 1,
            },
          },
        ],
        { allowDiskUse: true },
      ),
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
            isBlock: false,
            status: 2,
            userId: { $ne: userId },
          },
        },
        {
          $lookup: {
            from: "blocks",
            let: { hostId: "$_id", userId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      {
                        $and: [{ $eq: ["$hostId", "$$hostId"] }, { $eq: ["$userId", "$$userId"] }],
                      },
                      {
                        $and: [{ $eq: ["$userId", "$$hostId"] }, { $eq: ["$hostId", "$$userId"] }],
                      },
                    ],
                  },
                },
              },
            ],
            as: "blockInfo",
          },
        },
        { $match: { blockInfo: { $eq: [] } } },
        {
          $addFields: {
            isFollowed: { $gt: [{ $size: "$followInfo" }, 0] },
            status: {
              $switch: {
                branches: [
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
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            name: 1,
            countryFlagImage: 1,
            country: 1,
            image: 1,
            audioCallRate: 1,
            privateCallRate: 1,
            isFake: 1,
            status: 1,
            uniqueId: 1,
            gender: 1,
          },
        },
      ]),
      LiveBroadcaster.aggregate([
        { $match: { userId: { $ne: userId } } },
        {
          $lookup: {
            from: "blocks",
            let: { hostId: "$hostId", userId: userId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [{ $and: [{ $eq: ["$hostId", "$$hostId"] }, { $eq: ["$userId", "$$userId"] }] }, { $and: [{ $eq: ["$userId", "$$hostId"] }, { $eq: ["$hostId", "$$userId"] }] }],
                  },
                },
              },
            ],
            as: "blockInfo",
          },
        },
        { $match: { blockInfo: { $eq: [] } } },
        {
          $addFields: {
            randomSortField: {
              $mod: [
                {
                  $abs: {
                    $multiply: [{ $toLong: { $toDate: "$_id" } }, userSeed],
                  },
                },
                1234567,
              ],
            },
            video: [],
            liveVideo: [],
          },
        },
        {
          $sort: {
            randomSortField: 1,
            _id: 1,
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
            liveVideo: 1,
          },
        },
      ]),
      Host.aggregate([
        { $match: fakeLiveMatchQuery },
        {
          $lookup: {
            from: "blocks",
            let: { hostId: "$_id", userId: userId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [{ $and: [{ $eq: ["$hostId", "$$hostId"] }, { $eq: ["$userId", "$$userId"] }] }, { $and: [{ $eq: ["$userId", "$$hostId"] }, { $eq: ["$hostId", "$$userId"] }] }],
                  },
                },
              },
            ],
            as: "blockInfo",
          },
        },
        { $match: { blockInfo: { $eq: [] } } },
        {
          $addFields: {
            randomSortField: {
              $mod: [
                {
                  $abs: {
                    $multiply: [{ $toLong: { $toDate: "$_id" } }, userSeed],
                  },
                },
                1234567,
              ],
            },
          },
        },
        {
          $sort: {
            randomSortField: 1,
            _id: 1,
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
            liveVideo: 1,
          },
        },
      ]),
    ]);

    // hosts = hosts.sort(() => Math.random() - 0.5);

    let allLiveHosts = settingJSON.isDemoData ? [...liveHost, ...fakeLiveHost] : liveHost;
    const paginatedLiveHosts = allLiveHosts.slice((start - 1) * limit, start * limit);

    return res.json({
      status: true,
      message: "Hosts list retrieved successfully.",
      followedHost,
      liveHost: paginatedLiveHosts,
      hosts: hosts,
    });
  } catch (error) {
    console.error("Retrieve Hosts Error:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get host profile ( user )
exports.retrieveHostDetails = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid details." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(200).json({ status: false, message: "Valid userId is required." });
    }

    const [host, receivedGifts, isFollowing, totalFollower] = await Promise.all([
      Host.findOne({ _id: hostId, isBlock: false })
        .select(
          "name email gender bio uniqueId countryFlagImage country impression language image photoGallery profileVideo randomCallRate randomCallFemaleRate randomCallMaleRate privateCallRate audioCallRate chatRate coin isFake video liveVideo",
        )
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
            giftsvgaImage: { $first: "$giftsvgaImage" },
            giftType: { $first: "$giftType" },
          },
        },
        {
          $project: {
            giftId: "$_id",
            giftCoin: { $ifNull: ["$giftCoin", 0] },
            giftImage: 1,
            giftsvgaImage: 1,
            giftType: 1,
            totalReceived: 1,
            lastReceivedAt: 1,
          },
        },
      ]),
      FollowerFollowing.exists({ followerId: userId, followingId: hostId }),
      FollowerFollowing.countDocuments({ followingId: hostId }),
    ]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    host.isFollowing = Boolean(isFollowing);
    host.totalFollower = totalFollower || 0;

    return res.status(200).json({
      status: true,
      message: "The host profile retrieved.",
      host,
      receivedGifts,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get host profile ( host )
exports.fetchHostInfo = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid details." });
    }

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

    const [host] = await Promise.all([
      Host.findOne({ _id: hostId, isBlock: false })
        .select(
          "name email gender dob bio uniqueId countryFlagImage country impression language image photoGallery profileVideo randomCallRate randomCallFemaleRate randomCallMaleRate privateCallRate audioCallRate chatRate coin",
        )
        .lean(),
    ]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    return res.status(200).json({ status: true, message: "The host profile retrieved.", host });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get random free host ( random video call ) ( user )
exports.retrieveAvailableHost = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const { gender } = req.query;

    if (!gender || !["male", "female", "both"].includes(gender.trim().toLowerCase())) {
      return res.status(200).json({ status: false, message: "Gender must be one of: male, female, or both." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(200).json({ status: false, message: "Valid userId is required." });
    }

    const normalizedGender = gender.trim().toLowerCase();

    const [blockedHosts, lastMatch] = await Promise.all([
      Block.aggregate([{ $match: { userId, blockedBy: "user" } }, { $project: { _id: 0, hostId: 1 } }, { $group: { _id: null, ids: { $addToSet: "$hostId" } } }]),
      HostMatchHistory.findOne({ userId }).lean(),
    ]);

    const blockedHostIds = blockedHosts[0]?.ids || [];
    const lastMatchedHostId = lastMatch?.lastHostId;

    const realHostQuery = {
      isOnline: true,
      isBusy: false,
      isLive: false,
      isBlock: false,
      status: 2,
      callId: null,
      isFake: false,
    };

    if (normalizedGender !== "both") {
      realHostQuery.gender = normalizedGender;
    }

    // Step 1: Try real hosts
    let availableHosts = await Host.find(realHostQuery).lean();

    // Step 2: Fallback to fake hosts (only use isFake + block filter)
    if (availableHosts.length === 0) {
      const fakeHostQuery = {
        isFake: true,
        _id: { $nin: blockedHostIds.map((id) => new mongoose.Types.ObjectId(id)) },
      };

      if (normalizedGender !== "both") {
        fakeHostQuery.gender = normalizedGender;
      }

      availableHosts = await Host.find(fakeHostQuery).lean();
    }

    // Step 3: Filter out last matched host if needed
    let filteredHosts = availableHosts;
    if (availableHosts.length > 1 && lastMatchedHostId) {
      filteredHosts = availableHosts.filter((host) => host._id.toString() !== lastMatchedHostId.toString());
    }

    if (filteredHosts.length === 0) {
      return res.status(200).json({ status: false, message: "No available hosts found!" });
    }

    const matchedHost = filteredHosts[Math.floor(Math.random() * filteredHosts.length)];

    res.status(200).json({
      status: true,
      message: "Matched host retrieved!",
      data: matchedHost,
    });

    await HostMatchHistory.findOneAndUpdate({ userId }, { lastHostId: matchedHost._id }, { upsert: true, new: true });
  } catch (error) {
    console.error("Match Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

//update host's info  ( host )
exports.modifyHostDetails = async (req, res) => {
  try {
    console.log("📥 req.body modifyHostDetails:", req.body);
    console.log("📁 req.files modifyHostDetails:", req.files);

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
      removePhotoGalleryIndex,
      removeProfileVideoIndex,
    } = req.body;

    const arrayFields = ["removePhotoGalleryIndex", "removeProfileVideoIndex"];
    for (const key of arrayFields) {
      if (req.body[key]) {
        if (typeof req.body[key] === "string") {
          try {
            req.body[key] = JSON.parse(req.body[key]);
          } catch (e) {
            if (req.files) deleteFiles(req.files);
            return res.status(200).json({
              status: false,
              message: `Invalid format for ${key}. Expected an array.`,
            });
          }
        }
        if (!Array.isArray(req.body[key])) {
          if (req.files) deleteFiles(req.files);
          return res.status(200).json({
            status: false,
            message: `${key} must be an array.`,
          });
        }
      }
    }

    if (!hostId) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({
        status: false,
        message: "Missing or invalid host details. Please check and try again.",
      });
    }

    const [host, existingHost] = await Promise.all([
      Host.findOne({ _id: hostId }),
      email
        ? Host.findOne({ email: email?.trim(), _id: { $ne: hostId } })
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
      return res.status(200).json({
        status: false,
        message: "A host profile with this email already exists.",
      });
    }

    host.name = name || host.name;
    host.email = email || host.email;
    host.bio = bio || host.bio;
    host.dob = dob || host.dob;
    host.gender = gender || host.gender;
    host.countryFlagImage = countryFlagImage || host.countryFlagImage;
    host.country = country || host.country;
    host.impression = typeof impression === "string" ? impression.split(",") : Array.isArray(impression) ? impression : host.impression;
    host.language = typeof language === "string" ? language.split(",") : Array.isArray(language) ? language : host.language;
    host.randomCallRate = randomCallRate || host.randomCallRate;
    host.randomCallFemaleRate = randomCallFemaleRate || host.randomCallFemaleRate;
    host.randomCallMaleRate = randomCallMaleRate || host.randomCallMaleRate;
    host.privateCallRate = privateCallRate || host.privateCallRate;
    host.audioCallRate = audioCallRate || host.audioCallRate;
    host.chatRate = chatRate || host.chatRate;

    if (req.files?.image) {
      if (host.image) {
        const imagePath = host.image.includes("storage") ? "storage" + host.image.split("storage")[1] : "";
        if (imagePath && fs.existsSync(imagePath)) {
          const imageName = imagePath.split("/").pop();
          if (!["male.png", "female.png"].includes(imageName)) {
            fs.unlinkSync(imagePath);
            console.log(`🗑️ Deleted existing profile image: ${imagePath}`);
          }
        }
      }
      host.image = req.files.image[0].path;
      console.log(`🆕 Set new profile image: ${host.image}`);
    }

    if (Array.isArray(req.body.removePhotoGalleryIndex)) {
      const sorted = req.body.removePhotoGalleryIndex
        .map(Number)
        .filter((i) => !isNaN(i))
        .sort((a, b) => b - a);
      for (const i of sorted) {
        const filePath = host.photoGallery?.[i];
        if (filePath && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Deleted photoGallery[${i}]: ${filePath}`);
          } catch (err) {
            console.error(`❌ Error deleting photoGallery[${i}]:`, err);
          }
        }
        host.photoGallery.splice(i, 1);
      }
    }

    if (req.files?.photoGallery) {
      const newPhotos = req.files.photoGallery.filter((f) => f?.path).map((f) => f.path);
      host.photoGallery = [...(host.photoGallery || []), ...newPhotos];
      newPhotos.forEach((p, idx) => {
        console.log(`🆕 Added photoGallery[${host.photoGallery.length - newPhotos.length + idx}]: ${p}`);
      });
    }

    if (Array.isArray(req.body.removeProfileVideoIndex)) {
      const sorted = req.body.removeProfileVideoIndex
        .map(Number)
        .filter((i) => !isNaN(i))
        .sort((a, b) => b - a);
      for (const i of sorted) {
        const filePath = host.profileVideo?.[i];
        if (filePath && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Deleted profileVideo[${i}]: ${filePath}`);
          } catch (err) {
            console.error(`❌ Error deleting profileVideo[${i}]:`, err);
          }
        }
        host.profileVideo.splice(i, 1);
      }
    }

    if (req.files?.profileVideo) {
      const newVideos = req.files.profileVideo.filter((f) => f?.path).map((f) => f.path);
      host.profileVideo = [...(host.profileVideo || []), ...newVideos];
      newVideos.forEach((v, idx) => {
        console.log(`🆕 Added profileVideo[${host.profileVideo.length - newVideos.length + idx}]: ${v}`);
      });
    }

    await host.save();

    console.log("✅ Final image:", host.image);
    console.log("✅ Final photoGallery:", host.photoGallery);
    console.log("✅ Final profileVideo:", host.profileVideo);

    return res.status(200).json({
      status: true,
      message: "Host profile updated successfully.",
      host,
    });
  } catch (error) {
    if (req.files) deleteFiles(req.files);
    console.error("❌ modifyHostDetails Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Failed to update host profile due to server error.",
    });
  }
};

//get host thumblist ( host )
// exports.fetchHostsList = async (req, res) => {
//   try {
//     const start = req.query.start ? parseInt(req.query.start) : 1;
//     const limit = req.query.limit ? parseInt(req.query.limit) : 20;

//     if (!req.query.hostId) {
//       return res.status(200).json({ status: false, message: "hostId is required." });
//     }

//     if (!settingJSON) {
//       return res.status(200).json({ status: false, message: "Configuration settings not found." });
//     }

//     if (!req.query.country) {
//       return res.status(200).json({ status: false, message: "Please provide a country name." });
//     }

//     const hostId = new mongoose.Types.ObjectId(req.query.hostId);
//     const country = req.query.country.trim().toLowerCase();
//     const isGlobal = country === "global";

//     const fakeMatchQuery = isGlobal ? { isFake: true, isBlock: false, _id: { $ne: hostId } } : { country: country, isFake: true, isBlock: false, _id: { $ne: hostId } };
//     const matchQuery = isGlobal ? { isFake: false, isBlock: false, status: 2, _id: { $ne: hostId } } : { country: country, isFake: false, isBlock: false, status: 2, _id: { $ne: hostId } };

//     const [fakeHost, host, followerList] = await Promise.all([
//       Host.aggregate([
//         { $match: fakeMatchQuery },
//         {
//           $addFields: {
//             status: {
//               $switch: {
//                 branches: [
//                   { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", false] }, { $eq: ["$isBusy", false] }] }, then: "Online" },
//                   { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", true] }, { $eq: ["$isBusy", true] }] }, then: "Live" },
//                   { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", true] }] }, then: "Busy" },
//                 ],
//                 default: "Offline",
//               },
//             },
//             audioCallRate: 0,
//             privateCallRate: 0,
//             liveHistoryId: "",
//             token: "",
//             channel: "",
//           },
//         },
//         {
//           $project: {
//             _id: 1,
//             name: 1,
//             countryFlagImage: 1,
//             country: 1,
//             image: 1,
//             audioCallRate: 1,
//             privateCallRate: 1,
//             isFake: 1,
//             status: 1,
//             video: 1,
//             liveVideo: 1,
//             liveHistoryId: 1,
//             token: 1,
//             channel: 1,
//           },
//         },
//       ]),
//       Host.aggregate([
//         { $match: matchQuery },
//         {
//           $addFields: {
//             status: {
//               $switch: {
//                 branches: [
//                   { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", false] }, { $eq: ["$isBusy", false] }] }, then: "Online" },
//                   { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isLive", true] }, { $eq: ["$isBusy", true] }] }, then: "Live" },
//                   { case: { $and: [{ $eq: ["$isOnline", true] }, { $eq: ["$isBusy", true] }] }, then: "Busy" },
//                 ],
//                 default: "Offline",
//               },
//             },
//           },
//         },
//         {
//           $project: {
//             _id: 1,
//             name: 1,
//             countryFlagImage: 1,
//             country: 1,
//             image: 1,
//             audioCallRate: 1,
//             privateCallRate: 1,
//             isFake: 1,
//             status: 1,
//           },
//         },
//       ]),
//       FollowerFollowing.find({ followingId: hostId })
//         .populate("followerId", "_id name image uniqueId")
//         .sort({ createdAt: -1 })
//         .skip((start - 1) * limit)
//         .limit(limit)
//         .lean(),
//     ]);

//     const statusPriority = { Live: 1, Online: 2, Busy: 3, Offline: 4 };

//     // Pagination for hosts
//     let allHosts = settingJSON.isDemoData ? [...fakeHost, ...host] : host;
//     allHosts.sort((a, b) => (statusPriority[a.status] || 5) - (statusPriority[b.status] || 5));
//     const paginatedHosts = allHosts.slice((start - 1) * limit, start * limit);

//     return res.status(200).json({
//       status: true,
//       message: "Hosts list retrieved successfully.",
//       hosts: paginatedHosts,
//       followerList,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       status: false,
//       message: "An error occurred while fetching the hosts list.",
//       error: error.message || "Internal Server Error",
//     });
//   }
// };

exports.fetchHostsList = async (req, res) => {
  try {
    const start = parseInt(req.query.start || 1);
    const limit = parseInt(req.query.limit || 20);
    const skip = (start - 1) * limit;

    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "hostId is required." });
    }

    if (!settingJSON) {
      return res.status(200).json({ status: false, message: "Configuration settings not found." });
    }

    if (!req.query.country) {
      return res.status(200).json({ status: false, message: "Please provide a country name." });
    }

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);
    const country = req.query.country.trim().toLowerCase();
    const isGlobal = country === "global";

    const now = new Date();
    const timeBlock = Math.floor(now.getMinutes() / 1);
    const hostSeed =
      hostId
        .toString()
        .split("")
        .reduce((a, c) => a + c.charCodeAt(0), 0) + timeBlock;

    const baseMatch = {
      isBlock: false,
      _id: { $ne: hostId },
      ...(isGlobal ? {} : { country }),
      ...(settingJSON.isDemoData
        ? {
            $or: [
              { isFake: false, status: 2 },
              { isFake: true, status: 2 },
            ],
          }
        : {
            isFake: false,
            status: 2,
          }),
    };

    const [hosts, followerList] = await Promise.all([
      Host.aggregate(
        [
          { $match: baseMatch },

          {
            $addFields: {
              status: {
                $cond: [
                  { $eq: ["$isFake", true] },
                  {
                    $switch: {
                      branches: [
                        { case: { $lte: [{ $rand: {} }, 0.33] }, then: "Live" },
                        { case: { $lte: [{ $rand: {} }, 0.66] }, then: "Busy" },
                      ],
                      default: "Online",
                    },
                  },
                  {
                    $switch: {
                      branches: [
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
                        {
                          case: { $eq: ["$isOnline", true] },
                          then: "Online",
                        },
                      ],
                      default: "Offline",
                    },
                  },
                ],
              },

              audioCallRate: { $ifNull: ["$audioCallRate", 0] },
              privateCallRate: { $ifNull: ["$privateCallRate", 0] },
              liveHistoryId: { $ifNull: ["$liveHistoryId", ""] },
              token: { $ifNull: ["$token", ""] },
              channel: { $ifNull: ["$channel", ""] },

              randomSortField: {
                $mod: [
                  {
                    $abs: {
                      $multiply: [{ $toLong: { $toDate: "$_id" } }, hostSeed],
                    },
                  },
                  1234567,
                ],
              },

              statusRank: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$status", "Live"] }, then: 1 },
                    { case: { $eq: ["$status", "Online"] }, then: 2 },
                    { case: { $eq: ["$status", "Busy"] }, then: 3 },
                    { case: { $eq: ["$status", "Offline"] }, then: 4 },
                  ],
                  default: 5,
                },
              },
            },
          },

          {
            $sort: {
              statusRank: 1,
              randomSortField: 1,
              _id: 1,
            },
          },

          { $skip: skip },
          { $limit: limit },

          {
            $project: {
              _id: 1,
              name: 1,
              countryFlagImage: 1,
              country: 1,
              image: 1,
              audioCallRate: 1,
              privateCallRate: 1,
              isFake: 1,
              status: 1,
              video: 1,
              liveVideo: 1,
              liveHistoryId: 1,
              token: 1,
              channel: 1,
            },
          },
        ],
        { allowDiskUse: true },
      ),
      FollowerFollowing.find({ followingId: hostId }).populate("followerId", "_id name image uniqueId").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    return res.status(200).json({
      status: true,
      message: "Hosts list retrieved successfully.",
      hosts,
      followerList,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching the hosts list.",
      error: error.message || "Internal Server Error",
    });
  }
};

//get random fake host ( user ) ( auto call )
exports.getRandomAvailableFakeHost = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized. Please log in again." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(200).json({ status: false, message: "Invalid user ID provided." });
    }

    const [blockedHosts, lastMatch] = await Promise.all([
      Block.aggregate([{ $match: { userId, blockedBy: "user" } }, { $project: { _id: 0, hostId: 1 } }, { $group: { _id: null, ids: { $addToSet: "$hostId" } } }]),
      HostMatchHistory.findOne({ userId }).lean(),
    ]);

    const blockedHostIds = blockedHosts[0]?.ids || [];
    const lastMatchedHostId = lastMatch?.lastHostId;

    const query = {
      isFake: true,
      _id: { $nin: blockedHostIds.map((id) => new mongoose.Types.ObjectId(id)) },
    };

    const availableHosts = await Host.find(query).lean();

    let filteredHosts = availableHosts;
    if (availableHosts.length > 1 && lastMatchedHostId) {
      filteredHosts = availableHosts.filter((host) => host._id.toString() !== lastMatchedHostId.toString());
    }

    if (filteredHosts.length === 0) {
      return res.status(200).json({ status: false, message: "No fake hosts available for matching." });
    }

    const matchedHost = filteredHosts[Math.floor(Math.random() * filteredHosts.length)];

    res.status(200).json({
      status: true,
      message: "Successfully retrieved a random fake host.",
      data: matchedHost,
    });

    await HostMatchHistory.findOneAndUpdate({ userId }, { lastHostId: matchedHost._id }, { upsert: true, new: true });
  } catch (error) {
    console.error("getRandomAvailableFakeHost Error:", error);
    return res.status(500).json({ status: false, message: "Internal server error. Please try again later." });
  }
};

//get user ( host ) ( auto call )
exports.getRandomAvailableUser = async (req, res) => {
  try {
    const { hostId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(hostId)) {
      return res.status(200).json({ status: false, message: "Invalid host ID provided." });
    }

    const hostObjectId = new mongoose.Types.ObjectId(hostId);

    const [blockedUsers, lastMatch] = await Promise.all([
      Block.find({
        hostId: hostObjectId,
        blockedBy: "host",
      })
        .select("userId -_id")
        .lean(), //Get users blocked by this host
      HostMatchHistory.findOne({ hostId: hostObjectId }).lean(), //Get last matched user
    ]);

    const blockedUserIds = blockedUsers.map((b) => b.userId.toString());
    const lastMatchedUserId = lastMatch?.lastUserId?.toString();

    const allEligibleUsers = await User.find({
      _id: { $nin: blockedUserIds },
      isHost: false,
      hostId: null,
      isBlock: false,
      isOnline: true,
      isBusy: false,
      callId: null,
    })
      .select("_id name uniqueId image coin")
      .lean();

    if (!allEligibleUsers.length) {
      return res.status(200).json({ status: false, message: "No available user found." });
    }

    //Apply last match exclusion logic
    let finalCandidates;
    if (allEligibleUsers.length === 1) {
      finalCandidates = allEligibleUsers;
    } else {
      const filtered = allEligibleUsers.filter((u) => u._id.toString() !== lastMatchedUserId);
      finalCandidates = filtered.length > 0 ? filtered : allEligibleUsers;
    }

    //Select a random user
    const randomIndex = Math.floor(Math.random() * finalCandidates.length);
    const selectedUser = finalCandidates[randomIndex];

    res.status(200).json({
      status: true,
      message: "Successfully retrieved a random available user.",
      data: {
        userId: selectedUser._id,
        username: selectedUser.name,
        uniqueId: selectedUser.uniqueId,
        userImage: selectedUser.image,
        userCoin: selectedUser.coin,
      },
    });

    await HostMatchHistory.findOneAndUpdate({ hostId: hostObjectId }, { lastUserId: selectedUser._id }, { upsert: true, new: true });
  } catch (error) {
    console.error("getRandomAvailableUser Error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

//delete host
exports.disableHostAccount = async (req, res, next) => {
  try {
    const { hostId } = req.query;

    if (!hostId) {
      return res.status(200).json({ status: false, message: "Missing required query parameter: hostId." });
    }

    if (!mongoose.Types.ObjectId.isValid(hostId)) {
      return res.status(200).json({ status: false, message: "Invalid hostId. It must be a valid MongoDB ObjectId." });
    }

    const host = await Host.findOne({ _id: hostId, isFake: false }).lean();
    if (!host) {
      return res.status(200).json({ status: false, message: "host not found." });
    }

    res.status(200).json({
      status: true,
      message: "Host deleted successfully.",
    });

    const [user, chats] = await Promise.all([User.findOne({ hostId }).select("_id").lean(), Chat.find({ senderId: host?._id })]);

    if (user) {
      await User.updateOne({ _id: user._id }, { $set: { isHost: false, hostId: null } });
    }

    for (const chat of chats) {
      deleteFile(chat?.image);
      deleteFile(chat?.audio);
    }

    deleteFile(host?.image);

    if (Array.isArray(host.photoGallery)) {
      for (const imgPath of host.photoGallery) {
        deleteFile(imgPath);
      }
    }

    if (Array.isArray(host.video)) {
      for (const imgPath of host.video) {
        deleteFile(imgPath);
      }
    }

    if (Array.isArray(host.liveVideo)) {
      for (const imgPath of host.liveVideo) {
        deleteFile(imgPath);
      }
    }

    await Promise.all([LiveBroadcastHistory.deleteMany({ hostId: host?._id }), Withdrawalrequest.deleteMany({ hostId: host?._id }), Host.deleteOne({ _id: host?._id })]);
  } catch (error) {
    console.error("Error in disableHostAccount:", error);
    return res.status(500).json({ status: false, message: "An error occurred in disableHostAccount" });
  }
};
