const ChatTopic = require("../../models/chatTopic.model");

//mongoose
const mongoose = require("mongoose");

//get chat thumb list ( user )
exports.fetchChatList = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const userObjectId = new mongoose.Types.ObjectId(req.user.userId);
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const chatList = await ChatTopic.aggregate([
      {
        $match: {
          chatId: { $ne: null },
          $or: [{ senderId: userObjectId }, { receiverId: userObjectId }],
        },
      },
      {
        $addFields: {
          receiverId: {
            $cond: {
              if: { $eq: ["$senderId", userObjectId] },
              then: "$receiverId",
              else: "$senderId",
            },
          },
        },
      },
      {
        $lookup: {
          from: "blocks",
          localField: "receiverId",
          foreignField: "hostId",
          pipeline: [
            {
              $match: {
                userId: userObjectId,
              },
            },
            {
              $project: {
                isUserBlocked: 1,
                isHostBlocked: 1,
              },
            },
            { $limit: 1 },
          ],
          as: "blockInfo",
        },
      },
      {
        $unwind: {
          path: "$blockInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          $or: [
            { blockInfo: null },
            {
              $and: [{ "blockInfo.isUserBlocked": false }, { "blockInfo.isHostBlocked": false }],
            },
          ],
        },
      },
      {
        $lookup: {
          from: "chats",
          localField: "_id",
          foreignField: "chatTopicId",
          pipeline: [
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                chatTopicId: 1,
                senderId: 1,
                messageType: 1,
                message: 1,
                isRead: 1,
                createdAt: 1,
              },
            },
          ],
          as: "chat",
        },
      },
      { $unwind: { path: "$chat", preserveNullAndEmptyArrays: false } },
      { $sort: { "chat.createdAt": -1 } },
      { $skip: (start - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: "hosts",
          localField: "receiverId",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                name: 1,
                image: 1,
                isFake: 1,
                isOnline: 1,
              },
            },
          ],
          as: "host",
        },
      },
      { $unwind: { path: "$host", preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: "chats",
          localField: "_id",
          foreignField: "chatTopicId",
          pipeline: [
            {
              $match: {
                isRead: false,
                senderId: { $ne: userObjectId },
              },
            },
            { $count: "unreadCount" },
          ],
          as: "unreads",
        },
      },
      {
        $addFields: {
          unreadCount: {
            $cond: [{ $gt: [{ $size: "$unreads" }, 0] }, { $arrayElemAt: ["$unreads.unreadCount", 0] }, 0],
          },
        },
      },
      {
        $project: {
          receiverId: 1,
          name: "$host.name",
          image: "$host.image",
          isFake: "$host.isFake",
          isOnline: "$host.isOnline",
          chatTopic: "$chat.chatTopicId",
          senderId: "$chat.senderId",
          messageType: "$chat.messageType",
          message: "$chat.message",
          unreadCount: 1,
          lastChatMessageTime: "$chat.createdAt",
          time: {
            $let: {
              vars: {
                messageDay: {
                  $dateToString: { format: "%Y-%m-%d", date: "$chat.createdAt" },
                },
                today: {
                  $dateToString: { format: "%Y-%m-%d", date: new Date() },
                },
                yesterday: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: new Date(Date.now() - 24 * 60 * 60 * 1000),
                  },
                },
                dayOfWeek: {
                  $dayOfWeek: "$chat.createdAt",
                },
              },
              in: {
                $cond: [
                  { $eq: ["$$messageDay", "$$today"] },
                  "Today",
                  {
                    $cond: [
                      { $eq: ["$$messageDay", "$$yesterday"] },
                      "Yesterday",
                      {
                        $switch: {
                          branches: [
                            { case: { $eq: ["$$dayOfWeek", 1] }, then: "Sunday" },
                            { case: { $eq: ["$$dayOfWeek", 2] }, then: "Monday" },
                            { case: { $eq: ["$$dayOfWeek", 3] }, then: "Tuesday" },
                            { case: { $eq: ["$$dayOfWeek", 4] }, then: "Wednesday" },
                            { case: { $eq: ["$$dayOfWeek", 5] }, then: "Thursday" },
                            { case: { $eq: ["$$dayOfWeek", 6] }, then: "Friday" },
                            { case: { $eq: ["$$dayOfWeek", 7] }, then: "Saturday" },
                          ],
                          default: "Unknown Day",
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    ]);

    return res.status(200).json({
      status: true,
      message: "Success",
      chatList,
    });
  } catch (error) {
    console.error("Error in fetchChatList:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get chat thumb list ( host )
exports.retrieveChatList = async (req, res) => {
  try {
    if (!req.query.hostId || !mongoose.Types.ObjectId.isValid(req.query.hostId)) {
      return res.status(200).json({ status: false, message: "Invalid or missing hostId." });
    }

    const hostObjectId = new mongoose.Types.ObjectId(req.query.hostId);
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const chatList = await ChatTopic.aggregate([
      {
        $match: {
          chatId: { $ne: null },
          $or: [{ senderId: hostObjectId }, { receiverId: hostObjectId }],
        },
      },
      {
        $addFields: {
          userId: {
            $cond: {
              if: { $eq: ["$senderId", hostObjectId] },
              then: "$receiverId",
              else: "$senderId",
            },
          },
        },
      },
      {
        $lookup: {
          from: "blocks",
          localField: "userId",
          foreignField: "userId",
          pipeline: [
            {
              $match: {
                hostId: hostObjectId,
              },
            },
            {
              $project: {
                isUserBlocked: 1,
                isHostBlocked: 1,
              },
            },
            { $limit: 1 },
          ],
          as: "blockInfo",
        },
      },
      {
        $unwind: {
          path: "$blockInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          $or: [
            { blockInfo: null },
            {
              $and: [{ "blockInfo.isUserBlocked": false }, { "blockInfo.isHostBlocked": false }],
            },
          ],
        },
      },
      {
        $lookup: {
          from: "chats",
          localField: "_id",
          foreignField: "chatTopicId",
          pipeline: [
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                chatTopicId: 1,
                senderId: 1,
                message: 1,
                messageType: 1,
                isRead: 1,
                createdAt: 1,
              },
            },
          ],
          as: "chat",
        },
      },
      { $unwind: { path: "$chat", preserveNullAndEmptyArrays: false } },
      { $sort: { "chat.createdAt": -1 } },
      { $skip: (start - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                name: 1,
                image: 1,
                isOnline: 1,
              },
            },
          ],
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: "chats",
          localField: "_id",
          foreignField: "chatTopicId",
          pipeline: [
            {
              $match: {
                isRead: false,
                senderId: { $ne: hostObjectId },
              },
            },
            { $count: "unreadCount" },
          ],
          as: "unreads",
        },
      },
      {
        $addFields: {
          unreadCount: {
            $cond: [{ $gt: [{ $size: "$unreads" }, 0] }, { $arrayElemAt: ["$unreads.unreadCount", 0] }, 0],
          },
        },
      },
      {
        $project: {
          userId: 1,
          name: "$user.name",
          image: "$user.image",
          isOnline: "$user.isOnline",
          chatTopic: "$chat.chatTopicId",
          senderId: "$chat.senderId",
          message: "$chat.message",
          messageType: "$chat.messageType",
          unreadCount: 1,
          lastChatMessageTime: "$chat.createdAt",
          time: {
            $let: {
              vars: {
                messageDay: {
                  $dateToString: { format: "%Y-%m-%d", date: "$chat.createdAt" },
                },
                today: {
                  $dateToString: { format: "%Y-%m-%d", date: "$$NOW" },
                },
                yesterday: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: {
                      $dateSubtract: {
                        startDate: "$$NOW",
                        unit: "day",
                        amount: 1,
                      },
                    },
                  },
                },
                dayOfWeek: {
                  $dayOfWeek: "$chat.createdAt",
                },
              },
              in: {
                $cond: [
                  { $eq: ["$$messageDay", "$$today"] },
                  "Today",
                  {
                    $cond: [
                      { $eq: ["$$messageDay", "$$yesterday"] },
                      "Yesterday",
                      {
                        $switch: {
                          branches: [
                            { case: { $eq: ["$$dayOfWeek", 1] }, then: "Sunday" },
                            { case: { $eq: ["$$dayOfWeek", 2] }, then: "Monday" },
                            { case: { $eq: ["$$dayOfWeek", 3] }, then: "Tuesday" },
                            { case: { $eq: ["$$dayOfWeek", 4] }, then: "Wednesday" },
                            { case: { $eq: ["$$dayOfWeek", 5] }, then: "Thursday" },
                            { case: { $eq: ["$$dayOfWeek", 6] }, then: "Friday" },
                            { case: { $eq: ["$$dayOfWeek", 7] }, then: "Saturday" },
                          ],
                          default: "Unknown day",
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    ]);

    return res.status(200).json({
      status: true,
      message: "Success",
      chatList,
    });
  } catch (error) {
    console.error("Chat list retrieval error:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Internal Server Error",
    });
  }
};
