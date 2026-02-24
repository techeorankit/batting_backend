const Notification = require("../../models/notification.model");
const Host = require("../../models/host.model");

//private key
const admin = require("../../util/privateKey");

//deletefile
const { deleteFile } = require("../../util/deletefile");

//sending a notification from agency to a specific host
exports.notifyHost = async (req, res) => {
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

      const adminInstance = await admin;
      const response = adminInstance.messaging().send(notificationPayload);
      console.log("Notification sent successfully:", response);

      await new Notification({
        host: host._id,
        notificationPersonType: 2, // 2 = Host
        title: title.trim(),
        message: message.trim(),
        image: req.file ? req.file.path : "",
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      }).save();
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

//sending a notification from admin to hosts
exports.sendBulkHostNotifications = async (req, res) => {
  try {
    const { title, message } = req.body;
    const image = req.file ? req.file.path : "";
    const date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    let targets = [];
    targets = await Host.find({ isBlock: false }, "_id fcmToken");

    const notifications = [];
    const tokens = [];

    targets.forEach((item) => {
      notifications.push({
        host: item._id,
        notificationPersonType: 2,
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

    res.status(200).json({ status: true, message: "Notifications sent successfully." });

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

      console.log("BULK HOST FCM SUMMARY:", {
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
    console.error("sendBulkHostNotifications error:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
