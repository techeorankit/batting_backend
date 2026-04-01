const mongoose = require("mongoose");

const BlockSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: "Host", required: true },
    isUserBlocked: { type: Boolean, default: false },
    isHostBlocked: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

BlockSchema.index({ userId: 1, hostId: 1 }, { unique: true });
BlockSchema.index({ userId: 1, hostId: 1, isUserBlocked: 1, isHostBlocked: 1 });

module.exports = mongoose.model("Block", BlockSchema);
