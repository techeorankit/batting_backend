const mongoose = require("mongoose");

const { WITHDRAWAL_STATUS } = require("../types/constant");

const withdrawalRequestSchema = new mongoose.Schema(
  {
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Agency", default: null },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: "Host", default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    uniqueId: { type: String, default: "" },
    status: { type: Number, default: 1, enum: WITHDRAWAL_STATUS },
    coin: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    paymentGateway: { type: String, default: "" },
    paymentDetails: { type: Array, default: [] },
    reason: { type: String, default: "" },
    requestDate: { type: String, default: "" },
    acceptOrDeclineDate: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

withdrawalRequestSchema.index({ agencyId: 1, status: 1 });
withdrawalRequestSchema.index({ hostId: 1, status: 1 });
withdrawalRequestSchema.index({ userId: 1, status: 1 });
withdrawalRequestSchema.index({ status: 1 });
withdrawalRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model("WithdrawalRequest", withdrawalRequestSchema);
