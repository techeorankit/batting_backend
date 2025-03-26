const mongoose = require("mongoose");

const agencySchema = new mongoose.Schema(
  {
    agencyCode: { type: String, unique: true, default: "" },
    name: { type: String, default: "" },
    commissionType: { type: Number, enum: [1, 2] },
    commission: { type: Number, default: 10 },
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
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

agencySchema.index({ isBlock: 1 });
agencySchema.index({ createdAt: -1 });

module.exports = mongoose.model("Agency", agencySchema);
