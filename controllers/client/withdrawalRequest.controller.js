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

    const [uniqueId, host, withdrawalAgg] = await Promise.all([
      generateHistoryUniqueId(),
      Host.findOne({ _id: hostId }).select("_id coin fcmToken agencyId").lean(),
      WithdrawalRequest.aggregate([
        {
          $match: {
            hostId: hostId,
            status: { $in: [1, 3] },
          },
        },
        {
          $facet: {
            pendingRequest: [{ $match: { status: 1 } }, { $project: { _id: 1 } }],
            declinedRequest: [{ $match: { status: 3 } }, { $project: { _id: 1 } }],
          },
        },
      ]),
    ]);

    const pendingRequest = withdrawalAgg[0]?.pendingRequest[0] || null;
    const declinedRequest = withdrawalAgg[0]?.declinedRequest[0] || null;

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
      agencyOwnerId: host.agencyId || null,
      hostId: host._id,
      coin: requestedCoins,
      amount: requestAmount,
      paymentGateway: formattedGateway,
      paymentDetails: paymentDetails,
      requestDate: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    };

    console.log("paymentDetails type:", typeof paymentDetails);
    console.log("paymentDetails value:", paymentDetails);

    const historyData = {
      uniqueId,
      hostId: host._id,
      hostCoin: requestedCoins,
      payoutStatus: 1,
      type: 5,
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
        data: {
          title: "🔔 Withdrawal Request Submitted",
          body: "We have received your withdrawal request. It will be processed shortly.",
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

//get withdrawal requests ( host )
exports.listPayoutRequests = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "hostId missing or invalid." });
    }

    const { status } = req.query;

    if (!status) {
      return res.status(200).json({ status: false, message: "Invalid query parameters." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const formattedStartDate = new Date(startDate);
      const formattedEndDate = new Date(endDate);
      formattedEndDate.setHours(23, 59, 59, 999);

      dateFilterQuery = {
        createdAt: {
          $gte: formattedStartDate,
          $lte: formattedEndDate,
        },
      };
    }

    let statusQuery = {};
    if (status !== "All") {
      statusQuery.status = parseInt(status);
    }

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

    const [host, withdrawalData] = await Promise.all([
      Host.findOne({ _id: hostId }).select("_id").lean(),
      WithdrawalRequest.aggregate([
        {
          $match: {
            person: 2,
            hostId: hostId,
            ...statusQuery,
            ...dateFilterQuery,
          },
        },
        {
          $facet: {
            totalRecords: [{ $count: "count" }],
            records: [
              { $sort: { createdAt: -1 } },
              { $skip: (start - 1) * limit },
              { $limit: limit },
              {
                $lookup: {
                  from: "hosts",
                  localField: "hostId",
                  foreignField: "_id",
                  pipeline: [
                    {
                      $project: {
                        _id: 1,
                        name: 1,
                        uniqueId: 1,
                        image: 1,
                      },
                    },
                  ],
                  as: "hostId",
                },
              },
              { $unwind: { path: "$hostId", preserveNullAndEmptyArrays: false } },
              {
                $project: {
                  _id: 1,
                  hostId: 1,
                  person: 1,
                  agencyId: 1,
                  paymentGateway: 1,
                  paymentDetails: 1,
                  reason: 1,
                  uniqueId: 1,
                  coin: 1,
                  amount: 1,
                  status: 1,
                  requestDate: 1,
                  acceptOrDeclineDate: 1,
                  createdAt: 1,
                  updatedAt: 1,
                },
              },
            ],
          },
        },
      ]),
    ]);

    const totalRecords = withdrawalData[0]?.totalRecords[0]?.count || 0;
    const records = withdrawalData[0]?.records || [];

    if (!host) {
      return res.status(200).json({ status: false, message: "Host account not found." });
    }

    return res.status(200).json({
      status: true,
      message: "Withdrawal requests retrieved successfully.",
      total: totalRecords,
      data: records.length > 0 ? records : [],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
