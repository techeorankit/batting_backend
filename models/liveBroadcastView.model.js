const mongoose = require("mongoose");

const liveBroadcastViewSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    gender: { type: String, default: "" },
    image: { type: String, default: "" },
    countryFlagImage: { type: String, default: "" },
    country: { type: String, trim: true, lowercase: true, default: "" },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: "Host", default: null },
    liveHistoryId: { type: mongoose.Schema.Types.ObjectId, ref: "LiveBroadcastHistory", default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

liveBroadcastViewSchema.index({ hostId: 1 });
liveBroadcastViewSchema.index({ liveHistoryId: 1 });

module.exports = mongoose.model("LiveBroadcastView", liveBroadcastViewSchema);
