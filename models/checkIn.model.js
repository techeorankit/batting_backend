const mongoose = require("mongoose");

const checkInSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
  lastCheckInDate: { type: Date, default: null },
  consecutiveDays: { type: Number, default: 0 },
  rewardsCollected: [
    {
      day: { type: Number, required: true },
      isCheckIn: { type: Boolean, default: false },
      reward: { type: Number, default: 0 },
      checkInDate: { type: Date, default: null },
    },
  ],
});

module.exports = mongoose.model("CheckIn", checkInSchema);
