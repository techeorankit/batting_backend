const WithdrawalRequest = require("../../models/withdrawalRequest.model");

//import model
const Agency = require("../../models/agency.model");
const History = require("../../models/history.model");
const Host = require("../../models/host.model");

//private key
const admin = require("../../util/privateKey");

//mongoose
const mongoose = require("mongoose");

//generateHistoryUniqueId
const generateHistoryUniqueId = require("../../util/generateHistoryUniqueId");

//get withdrawal requests ( hosts / agency )
exports.fetchPayoutRequests = async (req, res) => {
  try {
    if (!req.agency || !req.agency._id) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const { status, person, search } = req.query;

    if (!status || !person) {
      return res.status(200).json({ status: false, message: "Invalid query parameters." });
    }

    const agencyId = new mongoose.Types.ObjectId(req.agency._id);

    const start = parseInt(req.query.start) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    let matchQuery = {};

    if (status !== "All") {
      matchQuery.status = parseInt(status);
    }

    if (person !== "All") {
      const personValue = parseInt(person);

      if (personValue === 1) {
        matchQuery.person = 1;
        matchQuery.agencyId = agencyId;
      } else if (personValue === 2) {
        matchQuery.person = 2;
        matchQuery.hostId = { $ne: null };
        matchQuery.agencyOwnerId = agencyId;
      }
    }

    if (startDate !== "All" && endDate !== "All") {
      const sDate = new Date(startDate);
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);

      matchQuery.createdAt = {
        $gte: sDate,
        $lte: eDate,
      };
    }

    const searchRegex = search ? new RegExp(search, "i") : null;

    const [agency, withdrawalData] = await Promise.all([
      Agency.findById(agencyId).select("_id isBlock").lean(),
      WithdrawalRequest.aggregate([
        { $match: matchQuery },

        {
          $lookup: {
            from: "agencies",
            localField: "agencyId",
            foreignField: "_id",
            pipeline: [{ $project: { agencyCode: 1, name: 1, image: 1 } }],
            as: "agencyId",
          },
        },
        { $unwind: { path: "$agencyId", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "hosts",
            localField: "hostId",
            foreignField: "_id",
            pipeline: [{ $project: { uniqueId: 1, name: 1, image: 1 } }],
            as: "hostId",
          },
        },
        { $unwind: { path: "$hostId", preserveNullAndEmptyArrays: true } },
        ...(searchRegex
          ? [
              {
                $match: {
                  $or: [
                    { uniqueId: searchRegex },
                    { paymentGateway: searchRegex },
                    { "agencyId.name": searchRegex },
                    { "agencyId.agencyCode": searchRegex },
                    { "hostId.name": searchRegex },
                    { "hostId.uniqueId": searchRegex },
                  ],
                },
              },
            ]
          : []),
        {
          $facet: {
            totalRecords: [{ $count: "count" }],
            records: [{ $sort: { createdAt: -1 } }, { $skip: (start - 1) * limit }, { $limit: limit }],
          },
        },
      ]),
    ]);

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found!" });
    }

    if (agency.isBlock) {
      return res.status(200).json({ status: false, message: "You are blocked by the admin!" });
    }

    const total = withdrawalData[0]?.totalRecords[0]?.count || 0;
    const data = withdrawalData[0]?.records || [];

    return res.status(200).json({
      status: true,
      message: "Withdrawal requests retrieved successfully.",
      total,
      data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//accept or decline withdrawal requests ( host )
exports.updateWithdrawalStatus = async (req, res) => {
  try {
    const { requestId, hostId, type, reason } = req.query;

    if (!requestId || !hostId || !type) {
      return res.status(200).json({ status: false, message: "Missing required parameters." });
    }

    const actionType = type.trim().toLowerCase();
    const dateNow = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    const [request, host] = await Promise.all([
      WithdrawalRequest.findById(requestId).lean().select("_id hostId coin amount status uniqueId"),
      Host.findById(hostId).lean().select("_id isBlock fcmToken coin"),
    ]);

    if (!request) return res.status(200).json({ status: false, message: "Withdrawal request not found." });
    if (!host) return res.status(200).json({ status: false, message: "Host not found." });
    if (host.isBlock) return res.status(403).json({ status: false, message: "Host is blocked by admin." });

    if (request.status === 2) return res.status(200).json({ status: false, message: "Request already approved." });
    if (request.status === 3) return res.status(200).json({ status: false, message: "Request already declined." });

    if (actionType === "approve") {
      const hostBalance = host.coin;

      // Check sufficient balance
      if (!hostBalance || hostBalance.coin < request.coin) {
        return res.status(200).json({
          status: false,
          message: "Insufficient coin balance. Withdrawal cannot be processed.",
        });
      }

      const [updateRequest, updateHost, updateHistory] = await Promise.all([
        WithdrawalRequest.updateOne(
          { _id: request._id, person: 2, hostId: hostId },
          {
            $set: {
              status: 2,
              acceptOrDeclineDate: dateNow,
            },
          },
        ),
        Host.updateOne(
          { _id: request.hostId, coin: { $gte: request.coin } },
          {
            $inc: {
              coin: -request.coin,
              redeemedCoins: request.coin,
              redeemedAmount: request.amount,
            },
          },
        ),
        History.updateOne(
          { uniqueId: request.uniqueId, type: 5, hostId: hostId },
          {
            $set: {
              payoutStatus: 2,
              date: dateNow,
            },
          },
        ),
      ]);

      res.status(200).json({
        status: true,
        message: "Withdrawal request approved successfully.",
        data: updateRequest,
      });

      if (host.fcmToken) {
        const payload = {
          token: host.fcmToken,
          data: {
            title: "🔔 Withdrawal Request Accepted!",
            body: "Your withdrawal request has been approved and processed. 🎉",
            type: "WITHDRAWREQUEST",
          },
        };

        const adminInstance = await admin;
        adminInstance
          .messaging()
          .send(payload)
          .catch((err) => {
            console.error("FCM error:", err.message);
          });
      }
    } else if (actionType === "reject") {
      if (!reason) {
        return res.status(200).json({ status: false, message: "Rejection reason is required." });
      }

      const [updateRequest, updateHistory] = await Promise.all([
        WithdrawalRequest.updateOne(
          { _id: request._id, person: 2, hostId: hostId },
          {
            $set: {
              status: 3,
              reason: reason.trim(),
              acceptOrDeclineDate: dateNow,
            },
          },
        ),
        History.updateOne(
          { uniqueId: request.uniqueId, type: 5, hostId: hostId },
          {
            $set: {
              payoutStatus: 3,
              reason,
              date: dateNow,
            },
          },
        ),
      ]);

      res.status(200).json({
        status: true,
        message: "Withdrawal request declined.",
        data: updateRequest,
      });

      if (host.fcmToken) {
        const payload = {
          token: host.fcmToken,
          data: {
            title: "🔔 Withdrawal Request Declined!",
            body: "Your withdrawal request has been declined. Please contact support.",
            type: "WITHDRAWREQUEST",
          },
        };

        const adminInstance = await admin;
        adminInstance
          .messaging()
          .send(payload)
          .catch((err) => {
            console.error("FCM error:", err.message);
          });
      }
    } else {
      return res.status(200).json({ status: false, message: "Invalid type. Must be 'approve' or 'reject'." });
    }
  } catch (error) {
    console.error("Error in withdrawal request handler:", error);
    res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//submit withdrawal request ( agency )
exports.initiateWithdrawal = async (req, res) => {
  try {
    if (!req.agency || !req.agency._id) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!settingJSON) {
      return res.status(200).json({ status: false, message: "Withdrawal settings not found." });
    }

    const { paymentGateway, paymentDetails, coin } = req.body;

    if (!paymentGateway || !paymentDetails || !coin) {
      return res.status(200).json({ status: false, message: "Invalid request. Please provide all required fields." });
    }

    const agencyId = new mongoose.Types.ObjectId(req.agency._id);
    const formattedGateway = paymentGateway.trim();
    const requestedCoins = Number(coin);
    const requestAmount = parseFloat(requestedCoins / settingJSON.minCoinsToConvert).toFixed(2);

    const [uniqueId, agency, withdrawalAgg] = await Promise.all([
      generateHistoryUniqueId(),
      Agency.findById(agencyId).select("_id netAvailableEarnings isBlock").lean(),
      WithdrawalRequest.aggregate([
        {
          $match: { agencyId: agencyId, status: { $in: [1, 3] } },
        },
        {
          $group: {
            _id: null,
            pendingRequest: {
              $first: { $cond: [{ $eq: ["$status", 1] }, "$_id", "$$REMOVE"] },
            },
            declinedRequest: {
              $first: { $cond: [{ $eq: ["$status", 3] }, "$_id", "$$REMOVE"] },
            },
          },
        },
      ]),
    ]);

    const pendingRequest = withdrawalAgg[0]?.pendingRequest || null;
    const declinedRequest = withdrawalAgg[0]?.declinedRequest || null;

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found!" });
    }

    if (agency.isBlock) {
      return res.status(200).json({ status: false, message: "You are blocked by the admin!" });
    }

    if (requestedCoins > agency.netAvailableEarnings) {
      return res.status(200).json({ status: false, message: "Insufficient balance to request withdrawal." });
    }

    if (requestedCoins < settingJSON.minCoinsForAgencyPayout) {
      return res.status(200).json({ status: false, message: `Minimum withdrawal amount is ${settingJSON.minCoinsForAgencyPayout} coins.` });
    }

    if (pendingRequest) {
      return res.status(200).json({
        status: false,
        message: "You already have a pending withdrawal request under review.",
      });
    }

    const withdrawalData = {
      uniqueId,
      person: 1,
      agencyId: agency._id,
      coin: requestedCoins,
      amount: requestAmount,
      paymentGateway: formattedGateway,
      paymentDetails: paymentDetails,
      requestDate: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    };

    console.log("paymentDetails type:", typeof paymentDetails);
    console.log("paymentDetails value:", paymentDetails);

    if (declinedRequest) {
      res.status(200).json({
        status: true,
        message: "Previous declined request removed. New withdrawal request submitted successfully.",
        withdrawalRequest: withdrawalData,
      });

      await WithdrawalRequest.deleteOne({ _id: declinedRequest._id });
      await Promise.all([WithdrawalRequest.create(withdrawalData)]);
    } else {
      res.status(200).json({
        status: true,
        message: "Your withdrawal request has been submitted successfully and is under review.",
        withdrawalRequest: withdrawalData,
      });

      await Promise.all([WithdrawalRequest.create(withdrawalData)]);
    }
  } catch (err) {
    console.error("Withdrawal request error:", err);
    return res.status(500).json({ status: false, message: "Internal server error. Please try again later." });
  }
};
