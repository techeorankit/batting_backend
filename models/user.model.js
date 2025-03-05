const { LOGIN_TYPE } = require("../types/constant");

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    selfIntro: { type: String, default: "" },
    gender: { type: String, default: "Female" },
    bio: { type: String, default: "" },
    age: { type: Number, default: 18 },
    image: { type: String, default: "storage/male.png" },
    email: { type: String, default: "" },
    countryFlagImage: { type: String, default: "" },
    country: { type: String, trim: true, lowercase: true, default: "" },
    ipAddress: { type: String, default: "" },
    loginType: { type: Number, enum: LOGIN_TYPE }, //1.apple 2.google 3.quick(identity)
    identity: { type: String, default: "" },
    fcmToken: { type: String, default: null },
    uniqueId: { type: String, unique: true, default: "" },

    firebaseUid: { type: String, unique: true, default: "" }, //firebase uid
    provider: { type: String, default: "" },

    coin: { type: Number, default: 0 },
    consumedCoins: { type: Number, default: 0 },
    purchasedCoin: { type: Number, default: 0 }, //totalTopUp (Total coins the user has topped up)
    receivedCoin: { type: Number, default: 0 }, //receied coin when gift received through live
    receivedGift: { type: Number, default: 0 },

    totalWithdrawalCoin: { type: Number, default: 0 },
    totalWithdrawalAmount: { type: Number, default: 0 },

    isBlock: { type: Boolean, default: false },
    isFake: { type: Boolean, default: false },

    isOnline: { type: Boolean, default: false },
    isBusy: { type: Boolean, default: false },

    callId: { type: String, default: "" },

    isHost: { type: Boolean, default: false },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: "Host", default: null },

    lastlogin: { type: String, default: "" },
    date: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userSchema.index({ identity: 1, loginType: 1 });
userSchema.index({ isBlock: 1 });
userSchema.index({ isFake: 1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model("User", userSchema);
