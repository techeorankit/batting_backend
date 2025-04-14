const WithdrawalRequest = require("../../models/withdrawalRequest.model");
const Host = require("../../models/host.model");
const History = require("../../models/history.model");

const mongoose = require("mongoose");

const generateHistoryUniqueId = require("../../util/generateHistoryUniqueId");

const admin = require("../../util/privateKey");

//withdrawal request ( host )
exports.submitWithdrawalRequest = async (req, res) => {
  try {
    if (!settingJSON) {
      return res.status(200).json({ status: false, message: "Withdrawal settings not found." });
    }

    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "hostId missing or invalid." });
    }

    const { paymentGateway, paymentDetails, coin } = req.body;

    if (!paymentGateway || !paymentDetails || !coin) {
      return res.status(200).json({ status: false, message: "Invalid request. Please provide all required fields." });
    }

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);
    const formattedGateway = paymentGateway.trim();
    const requestedCoins = Number(coin);
    const requestAmount = parseFloat(requestedCoins / settingJSON.minCoinsToConvert).toFixed(2);

    const [uniqueId, host, pendingRequest, declinedRequest] = await Promise.all([
      generateHistoryUniqueId(),
      Host.findOne({ _id: hostId }).select("_id coin fcmToken").lean(),
      WithdrawalRequest.findOne({ hostId, status: 1 }).select("_id").lean(), // status 1: pending
      WithdrawalRequest.findOne({ hostId, status: 3 }).select("_id").lean(), // status 3: declined
    ]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host account not found." });
    }

    if (requestedCoins > host.coin) {
      return res.status(200).json({ status: false, message: "Insufficient balance to request withdrawal." });
    }

    if (requestedCoins < settingJSON.minCoinsForHostPayout) {
      return res.status(200).json({ status: false, message: `Minimum withdrawal amount is ${settingJSON.minCoinsForHostPayout} coins.` });
    }

    if (pendingRequest) {
      return res.status(200).json({
        status: false,
        message: "You already have a pending withdrawal request under review.",
      });
    }

    const withdrawalData = {
      uniqueId,
      person: 2,
      hostId: host._id,
      coin: requestedCoins,
      amount: requestAmount,
      paymentGateway: formattedGateway,
      paymentDetails: Array.isArray(paymentDetails) ? paymentDetails.map((detail) => detail.replace("[", "").replace("]", "")) : [String(paymentDetails).replace("[", "").replace("]", "")],
      requestDate: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    };

    console.log("paymentDetails type:", typeof paymentDetails);
    console.log("paymentDetails value:", paymentDetails);

    const historyData = {
      uniqueId,
      hostId: host._id,
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

    if (host.fcmToken) {
      const adminApp = await admin;
      const notificationPayload = {
        token: host.fcmToken,
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
