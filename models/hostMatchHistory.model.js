const mongoose = require("mongoose");

const HostMatchHistorySchema = new mongoose.Schema(
  {
    //user to host
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastHostId: { type: mongoose.Schema.Types.ObjectId, ref: "Host", default: null },

    //host to user
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: "Host", default: null },
    lastUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("HostMatchHistory", HostMatchHistorySchema);
