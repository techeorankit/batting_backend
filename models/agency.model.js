const mongoose = require("mongoose");

const agencySchema = new mongoose.Schema(
  {
    uniqueId: { type: String, unique: true, default: "" },
    agencyCode: { type: String, default: "", unique: true },
    name: { type: String, default: "" },
    commissionType: { type: String, default: "" },
    commission: { type: String, default: "" },
    email: { type: String, default: "" },
    password: { type: String, default: "" },
    mobileNumber: { type: String, default: "" },
    image: { type: String, default: "" },
    description: { type: String, default: "" },
    countryFlagImage: { type: String, default: "" },
    country: { type: String, default: "" },
    hostCoins: { type: Number, default: 0, min: 0 },
    totalEarnings: { type: Number, default: 0, min: 0 },
    totalWithdrawn: { type: Number, default: 0, min: 0 },
    isBlock: { type: Boolean, default: false },
    date: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

agencySchema.index({ isBlock: 1 });
agencySchema.index({ createdAt: -1 });

module.exports = mongoose.model("Agency", agencySchema);
