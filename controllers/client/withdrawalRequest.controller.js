const WithdrawalRequest = require("../../models/withdrawalRequest.model");
const User = require("../../models/user.model");
const History = require("../../models/history.model");

const mongoose = require("mongoose");

//withdrawal request ( user )
exports.submitWithdrawalRequest = async (req, res) => {
  try {
    if (!settingJSON) {
      return res.status(200).json({ status: false, message: "Withdrawal settings not found." });
    }

    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Token missing or invalid." });
    }

    const { paymentGateway, paymentDetails, coin } = req.body;

    if (!paymentGateway || !paymentDetails || !coin) {
      return res.status(200).json({ status: false, message: "Invalid request. Please provide all required fields." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const formattedGateway = paymentGateway.trim();
    const requestedCoins = Number(coin);
    const requestAmount = parseFloat(requestedCoins / settingJSON.minCoinsToConvert).toFixed(2);

    const [uniqueId, user, pendingRequest, declinedRequest] = await Promise.all([
      generateHistoryUniqueId(),
      User.findOne({ _id: userId }).select("_id coin fcmToken").lean(),
      WithdrawalRequest.findOne({ userId, status: 1 }).select("_id").lean(), // status 1: pending
      WithdrawalRequest.findOne({ userId, status: 3 }).select("_id").lean(), // status 3: declined
    ]);

    if (!user) {
      return res.status(200).json({ status: false, message: "User account not found." });
    }

    if (requestedCoins > user.coin) {
      return res.status(200).json({ status: false, message: "Insufficient balance to request withdrawal." });
    }

    if (requestedCoins < settingJSON.minCoinsForUserPayout) {
      return res.status(200).json({ status: false, message: `Minimum withdrawal amount is ${settingJSON.minCoinsForUserPayout} coins.` });
    }

    if (pendingRequest) {
      return res.status(200).json({
        status: false,
        message: "You already have a pending withdrawal request under review.",
      });
    }

    const withdrawalData = {
      uniqueId,
      person: 3,
      userId: user._id,
      coin: requestedCoins,
      amount: requestAmount,
      paymentGateway: formattedGateway,
      paymentDetails: paymentDetails.map((detail) => detail.replace("[", "").replace("]", "")),
      requestDate: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    };

    const historyData = {
      uniqueId,
      userId: user._id,
      coin: requestedCoins,
      payoutStatus: 1,
      type: 4,
      date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    };

    if (declinedRequest) {
      res.status(200).json({
        status: true,
        message: "Previous declined request removed. New withdrawal request submitted successfully.",
      });

      await WithdrawalRequest.deleteOne({ _id: declinedRequest._id });
      await Promise.all([WithdrawalRequest.create(withdrawalData), History.create(historyData)]);
    } else {
      res.status(200).json({
        status: true,
        message: "Your withdrawal request has been submitted successfully and is under review.",
      });

      await Promise.all([WithdrawalRequest.create(withdrawalData), History.create(historyData)]);
    }

    if (user.fcmToken) {
      const adminApp = await admin;
      const notificationPayload = {
        token: user.fcmToken,
        notification: {
          title: "🔔 Withdrawal Request Submitted",
          body: "We have received your withdrawal request. It will be processed shortly.",
        },
        data: {
          type: "WITHDRAWREQUEST",
        },
      };

      adminApp
        .messaging()
        .send(notificationPayload)
        .then((response) => {
          console.log("Notification sent successfully:", response);
        })
        .catch((err) => {
          console.error("Notification sending failed:", err);
        });
    }
  } catch (err) {
    console.error("Withdrawal request error:", err);
    return res.status(500).json({ status: false, message: "Internal server error. Please try again later." });
  }
};
