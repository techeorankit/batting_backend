const mongoose = require("mongoose");

const callHistorySchema = new mongoose.Schema(
  {
    callId: { type: String, unique: true, default: "" },
    callerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "Host", default: null },
    callType: { type: String, enum: ["audio", "video"], default: "" },
    isRandom: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    callConnect: { type: Boolean, default: false },
    coin: { type: Number, default: 0 },
    callStartTime: { type: String, default: "" },
    callEndTime: { type: String, default: "" },
    duration: { type: String, default: "00:00:00" },
    date: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

callHistorySchema.index({ createdAt: -1 });
callHistorySchema.index({ callerId: 1 });
callHistorySchema.index({ receiverId: 1 });

module.exports = mongoose.model("CallHistory", callHistorySchema);
