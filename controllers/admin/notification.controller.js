const Notification = require("../../models/notification.model");

//import model
const User = require("../../models/user.model");
const Host = require("../../models/host.model");

//mongoose
const mongoose = require("mongoose");

//private key
const admin = require("../../util/privateKey");

//deletefile
const { deleteFile } = require("../../util/deletefile");

//sending a notification from admin to a specific user
exports.sendNotificationToSingleUserByAdmin = async (req, res) => {
  try {
    const { userId, title, message } = req.body;

    if (!userId) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "User ID is required." });
    }

    if (!title || !message) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "Both title and message are required." });
    }

    const user = await User.findById(userId).select("_id isBlock fcmToken").lean();
    if (!user) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "User not found." });
    }

    if (user.isBlock) {
      if (req.file) deleteFile(req.file);
      return res.status(403).json({ status: false, message: "This user has been blocked by the admin." });
    }

    if (!user.fcmToken) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "User does not have a valid FCM token." });
    }

    try {
      res.status(200).json({ status: true, message: "Notification sent successfully." });

      const notificationPayload = {
        token: user.fcmToken,
        data: {
          title: title.trim(),
          body: message.trim(),
          image: req.file ? req.file.path : "",
        },
      };

      const adminPromise = await admin;
      adminPromise
        .messaging()
        .send(notificationPayload)
        .then(async (response) => {
          console.log("Successfully sent with response: ", response);

          await new Notification({
            user: user._id,
            notificationPersonType: 1, // 1 = User
            title: title.trim(),
            message: message.trim(),
            image: req.file ? req.file.path : "",
            date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
          }).save();
        })
        .catch((error) => {
          if (req.file) deleteFile(req.file);
          console.log("Error sending message:      ", error);
        });
    } catch (error) {
      if (req.file) deleteFile(req.file);
      console.error("Error sending notification:", error);
      return res.status(200).json({ status: false, message: "Failed to send notification." });
    }
  } catch (error) {
    if (req.file) deleteFile(req.file);
    console.error("Error in sendNotificationToSingleUserByAdmin:", error);
    return res.status(500).json({ status: false, message: "Internal server error." });
  }
};

//sending a notification from admin to a specific host
exports.sendNotificationToSingleHostByAdmin = async (req, res) => {
  try {
    const { hostId, title, message } = req.body;

    if (!hostId) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "Host ID is required." });
    }

    if (!title || !message) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "Both title and message are required." });
    }

    const host = await Host.findById(hostId).select("_id isBlock fcmToken").lean();
    if (!host) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    if (host.isBlock) {
      if (req.file) deleteFile(req.file);
      return res.status(403).json({ status: false, message: "This host has been blocked by the admin." });
    }

    if (!host.fcmToken) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "Host does not have a valid FCM token." });
    }

    try {
      res.status(200).json({ status: true, message: "Notification sent successfully." });

      const notificationPayload = {
        token: host.fcmToken,
        data: {
          title: title.trim(),
          body: message.trim(),
          image: req.file ? req.file.path : "",
        },
      };

      const adminPromise = await admin;
      adminPromise
        .messaging()
        .send(notificationPayload)
        .then(async (response) => {
          console.log("Successfully sent with response: ", response);

          await new Notification({
            host: host._id,
            notificationPersonType: 2, // 2 = Host
            title: title.trim(),
            message: message.trim(),
            image: req.file ? req.file.path : "",
            date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
          }).save();
        })
        .catch((error) => {
          if (req.file) deleteFile(req.file);
          console.log("Error sending message:      ", error);
        });
    } catch (error) {
      if (req.file) deleteFile(req.file);
      console.error("Error sending notification:", error);
      return res.status(200).json({ status: false, message: "Failed to send notification." });
    }
  } catch (error) {
    if (req.file) deleteFile(req.file);
    console.error("Error in sendNotificationToSingleHostByAdmin:", error);
    return res.status(500).json({ status: false, message: "Internal server error." });
  }
};

//sending a notification from admin to user/host/both
exports.sendNotifications = async (req, res) => {
  try {
    const { notificationType, title, message } = req.body;
    const image = req.file ? req.file.path : "";
    const date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    let targets = [];

    if (notificationType?.trim().toLowerCase() === "user") {
      targets = await User.find({ isBlock: false }, "_id fcmToken");
    } else if (notificationType?.trim().toLowerCase() === "host") {
      targets = await Host.find({ isBlock: false }, "_id fcmToken");
    } else if (notificationType?.trim().toLowerCase() === "both") {
      const [users, hosts] = await Promise.all([User.find({ isBlock: false }, "_id fcmToken"), Host.find({ isBlock: false }, "_id fcmToken")]);
      targets = [...users.map((u) => ({ ...u.toObject(), isUser: true })), ...hosts.map((h) => ({ ...h.toObject(), isHost: true }))];
    } else {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "Please pass a valid notificationType!" });
    }

    const notifications = [];
    const tokens = [];

    targets.forEach((item) => {
      const isUser = item.isUser || (!item.isHost && notificationType?.trim().toLowerCase() === "user");
      const isHost = item.isHost || (!item.isUser && notificationType?.trim().toLowerCase() === "host");

      notifications.push({
        ...(isUser ? { user: item._id, notificationPersonType: 1 } : {}),
        ...(isHost ? { host: item._id, notificationPersonType: 2 } : {}),
        title,
        message,
        image,
        date,
      });

      if (item.fcmToken?.trim()) tokens.push(item.fcmToken);
    });

    if (notifications.length) {
      await Notification.insertMany(notifications);
    }

    res.status(200).json({ status: true, message: "Notification sent successfully." });

    if (tokens.length > 0) {
      const adminInstance = await admin;
      const chunkSize = 500;
      const batches = [];

      for (let i = 0; i < tokens.length; i += chunkSize) {
        batches.push(
          adminInstance.messaging().sendEachForMulticast({
            tokens: tokens.slice(i, i + chunkSize),
            data: {
              title: title || "Default Title",
              body: message || "Default Message",
              image,
            },
          }),
        );
      }

      const results = await Promise.all(batches);

      let totalSuccess = 0;
      let totalFailure = 0;

      results.forEach((batchResult, batchIndex) => {
        totalSuccess += batchResult.successCount;
        totalFailure += batchResult.failureCount;

        batchResult.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`FCM TOKEN FAILED (batch ${batchIndex}):`, resp.error?.message);
          }
        });
      });

      console.log("BULK FCM SUMMARY:", {
        totalTokens: tokens.length,
        totalSuccess,
        totalFailure,
      });
    } else {
      if (req.file) deleteFile(req.file);
      console.warn("No valid FCM tokens to send.");
    }
  } catch (error) {
    if (req.file) deleteFile(req.file);
    console.error("sendNotifications error:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
