// bullRandomChatJob.js
const Bull = require("bull");
const Chat = require("../models/chat.model");
const ChatTopic = require("../models/chatTopic.model");
const Host = require("../models/host.model");
const User = require("../models/user.model");
const Message = require("../models/message.model");

const admin = require("../util/privateKey");

const chatQueue = new Bull("chat-job-queue", {
  redis: {
    host: "127.0.0.1",
    port: 6379,
  },
});

chatQueue.process("repeat", async (job) => {
  console.log("🆔 Job ID:", job.id);
  console.log("⏱ Repeat Job?", job.opts?.repeat ? "Yes" : "No");
  console.log("🔁 Repeat Info:", job.opts.repeat);

  const usersWithManyTopics = await ChatTopic.aggregate([
    {
      $match: {
        chatId: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$receiverId",
        count: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $unwind: "$user",
    },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        count: 1,
        // name: "$user.name",
        // image: "$user.image",
        // email: "$user.email",
        // isHost: "$user.isHost",
      },
    },
  ]);

  console.log("📌 Found users with >4 chat topics:", usersWithManyTopics);
  console.log(`📌 Users with more than 4 chatId-bound ChatTopics: ${usersWithManyTopics.length}`);

  for (const { userId } of usersWithManyTopics) {
    const allTopics = await ChatTopic.find({
      receiverId: userId,
      chatId: { $ne: null },
    })
      .sort({ _id: -1 }) // newest first
      .select("_id")
      .lean();

    const topicsToKeep = allTopics.slice(0, 4).map((t) => t._id); // keep latest 4
    const topicsToDelete = allTopics.slice(4).map((t) => t._id); // delete the rest

    if (topicsToDelete.length > 0) {
      await Promise.all([Chat.deleteMany({ chatTopicId: { $in: topicsToDelete } }), ChatTopic.deleteMany({ _id: { $in: topicsToDelete } })]);

      console.log(`🗑 Deleted ${topicsToDelete.length} old topics for user ${userId}`);
    } else {
      console.log(`✅ Nothing to delete for user ${userId}`);
    }
  }

  const [hosts, users, latestMessageDoc] = await Promise.all([
    Host.find({ video: { $ne: [] } })
      .sort({ createdAt: -1 })
      .select("_id name image video isFake"),
    User.find({ fcmToken: { $ne: null } })
      .sort({ createdAt: -1 })
      .select("_id name image fcmToken")
      .lean(),
    Message.findOne().sort({ createdAt: -1 }).lean(),
  ]);

  console.log(`Total users found: ${users.length}`);
  console.log(`Total hosts available: ${hosts.length}`);
  console.log(`Using fallback messages: ${!latestMessageDoc?.message?.length}`);

  const fallbackMessages = [
    "Hey there! 👋",
    "How's your day going? 😊",
    "Wanna chat? 💬",
    "You look amazing today! ✨",
    "Let's talk! 💖",
    "Hope you're having a great time! 🌟",
    "What's your favorite movie? 🎬",
    "I’d love to get to know you better! 😄",
  ];

  for (const user of users) {
    const randomHost = hosts[Math.floor(Math.random() * hosts.length)];

    const [chatTopic] = await Promise.all([
      ChatTopic.findOne({
        $or: [
          { senderId: randomHost._id, receiverId: user._id },
          { senderId: user._id, receiverId: randomHost._id },
        ],
      }),
    ]);

    const messageArray = latestMessageDoc?.message?.length > 0 ? latestMessageDoc.message : fallbackMessages;
    const randomIndex = Math.floor(Math.random() * messageArray.length);
    const messageText = messageArray[randomIndex];
    const messageType = Math.random() < 0.5 ? 1 : 2; // 1=message, 2=image
    let imageUrl = "";

    if (messageType === 2) {
      const hostImages = Array.isArray(randomHost.image) ? randomHost.image : [randomHost.image];
      if (hostImages.length > 0) {
        const index = hostImages.length > 1 ? Math.floor(Math.random() * (hostImages.length - 1)) + 1 : 0;
        imageUrl = hostImages[index];
      }
    }

    console.log(`Sending message to user: ${user._id} from host: ${randomHost._id}`);
    console.log(`Selected message: ${messageText}`);
    console.log(`Message type: ${messageType === 1 ? "Text" : "Image"}`);

    await Chat.deleteMany({
      $or: [
        { senderId: randomHost._id, receiverId: user._id },
        { senderId: user._id, receiverId: randomHost._id },
      ],
    });
    console.log(`🗑 Deleted all existing chats between ${randomHost._id} and ${user._id}`);

    let chat;
    if (chatTopic) {
      chat = new Chat({
        chatTopicId: chatTopic._id,
        senderId: randomHost._id,
        messageType,
        message: messageType === 2 ? "📸 Image" : messageText,
        image: messageType === 2 ? imageUrl : "",
        date: new Date().toLocaleString(),
      });

      chatTopic.chatId = chat._id;
      await Promise.all([chat.save(), chatTopic.save()]);
      console.log(`Chat sent for topic: ${chatTopic._id}`);
    } else {
      const newChatTopic = new ChatTopic({
        senderId: randomHost._id,
        receiverId: user._id,
      });

      chat = new Chat({
        chatTopicId: newChatTopic._id,
        senderId: randomHost._id,
        messageType,
        message: messageType === 2 ? "📸 Image" : messageText,
        image: messageType === 2 ? imageUrl : "",
        date: new Date().toLocaleString(),
      });

      newChatTopic.chatId = chat._id;
      await Promise.all([newChatTopic.save(), chat.save()]);
      console.log(`Chat sent for new topic: ${newChatTopic._id}`);
    }

    if (user.fcmToken) {
      const payload = {
        token: user.fcmToken,
        data: {
          title: `${randomHost.name} sent you a message 📩`,
          body: `🗨️ ${chat.message}`,
          type: "CHAT",
          senderId: String(randomHost._id),
          receiverId: String(user._id),
          userName: String(randomHost.name),
          hostName: String(user.name),
          userImage: String(randomHost.image || ""),
          hostImage: String(user.image || ""),
          isOnline: String(user?.isOnline ?? ""),
          senderRole: "host",
          isFakeSender: String(randomHost?.isFake) || "false",
          isFake: String(randomHost.isFake),
        },
      };

      const adminInstance = await admin;
      adminInstance
        .messaging()
        .send(payload)
        .then((response) => {
          console.log("✅ FCM sent successfully:", response);
        })
        .catch((error) => {
          console.error("❌ Error sending FCM message:", error);
        });
    }
  }
});

chatQueue.on("completed", (job) => {
  console.log(`Job ${job.id} completed!`);
});

chatQueue.on("error", (err) => {
  console.error("Queue Error:", err);
});

chatQueue.on("failed", async (job, err) => {
  console.error(`❌ Job ${job.id} failed: ${err.message}`);

  if (job.opts.repeat && job.opts.repeat.every) {
    try {
      await chatQueue.removeRepeatable(job.name, {
        every: job.opts.repeat.every,
        jobId: job.opts.jobId,
      });
      console.log(`🧹 Removed repeatable job: ${job.id}`);
    } catch (removeErr) {
      console.error(`❌ Failed to remove repeatable job: ${removeErr.message}`);
    }
  }
});

//⏱ Schedule the job every 10 minutes with a fixed jobId
const scheduleChatJob = async () => {
  const intervalInMinutes = settingJSON.messageInitiatedAt;

  if (!intervalInMinutes || intervalInMinutes === 0) {
    console.log("⏹ Admin has disabled chat job scheduling (interval set to 0).");
    return;
  }

  const intervalMs = intervalInMinutes * 60 * 1000;
  const jobName = "repeat";
  const jobId = `repeat:chat-job-every-${intervalInMinutes}-min`;

  try {
    const [hosts] = await Promise.all([
      Host.find({ video: { $ne: [] } })
        .sort({ createdAt: -1 })
        .select("_id"),
    ]);

    if (!hosts || hosts.length === 0) {
      console.log("❌ No active hosts with videos found. Chat job will not be scheduled.");
      return;
    }

    console.log("🧹 Checking and removing outdated or invalid repeatable jobs...");

    const repeatJobs = await chatQueue.getRepeatableJobs();

    for (const job of repeatJobs) {
      const isOldInterval = job.every !== intervalMs;
      const isInvalid = !job.every || job.every === 0;

      if (isOldInterval || isInvalid) {
        console.log(`🗑 Removing job: key=${job.key}, every=${job.every}`);
        await chatQueue.removeRepeatableByKey(job.key);
      }
    }

    await chatQueue.add(
      jobName,
      {},
      {
        repeat: { every: intervalMs },
        jobId,
        removeOnComplete: true,
        removeOnFail: { count: 3 },
      }
    );

    console.log(`✅ Scheduled chat job every ${intervalInMinutes} minute(s)`);

    const updatedJobs = await chatQueue.getRepeatableJobs();
    console.log("📋 Current Repeatable Jobs:");
    for (const job of updatedJobs) {
      console.log(`  - id: ${job.id}, every: ${job.every ?? "null"} ms, next: ${new Date(job.next)}`);
    }
  } catch (err) {
    console.error("❌ Error while scheduling chat job:", err);
  }
};

module.exports = scheduleChatJob;
