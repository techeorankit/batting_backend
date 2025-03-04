const { HISTORY_TYPE, WITHDRAWAL_STATUS } = require("../types/constant");

const mongoose = require("mongoose");

const historySchema = new mongoose.Schema(
  {
    uniqueId: { type: String, unique: true, trim: true, default: "" },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // Sender
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: "Host", default: null }, // Receiver

    giftId: { type: mongoose.Schema.Types.ObjectId, ref: "Gift", default: null },
    giftCount: { type: Number, default: 0 },

    planId: { type: mongoose.Schema.Types.ObjectId, ref: "CoinPlan", default: null }, // Plan's ID purchased by the user

    paymentGateway: { type: String, default: "" },
    payoutStatus: { type: Number, default: 0, enum: WITHDRAWAL_STATUS },
    reason: { type: String, default: "" },

    type: { type: Number, enum: HISTORY_TYPE },
    coin: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    date: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

historySchema.index({ type: 1 });
historySchema.index({ userId: 1 });
historySchema.index({ hostId: 1 });
historySchema.index({ giftId: 1 });
historySchema.index({ createdAt: -1 });

module.exports = mongoose.model("History", historySchema);
