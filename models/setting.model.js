const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    privacyPolicyLink: { type: String, default: "PRIVACY POLICY LINK" },
    termsOfUsePolicyLink: { type: String, default: "TERMS OF USE POLICY LINK" },

    googlePlayEnabled: { type: Boolean, default: false },

    stripeEnabled: { type: Boolean, default: false },
    stripePublishableKey: { type: String, default: "STRIPE PUBLISHABLE KEY" },
    stripeSecretKey: { type: String, default: "STRIPE SECRET KEY" },

    razorpayEnabled: { type: Boolean, default: false },
    razorpayId: { type: String, default: "RAZOR PAY ID" },
    razorpaySecretKey: { type: String, default: "RAZOR SECRET KEY" },

    flutterwaveEnabled: { type: Boolean, default: false },
    flutterwaveId: { type: String, default: "FLUTTER WAVE ID" },

    loginBonus: { type: Number, default: 5000 },
    isDemoData: { type: Boolean, default: false },

    currency: {
      name: { type: String, default: "" },
      symbol: { type: String, default: "" },
      countryCode: { type: String, default: "" },
      currencyCode: { type: String, default: "" },
      isDefault: { type: Boolean, default: false },
    }, //default currency

    privateKey: { type: Object, default: {} }, //firebase.json handle notification

    minCoinsToConvert: { type: Number, default: 0 }, //min coin requried for convert coin to default currency i.e., 1000 coin = 1 $
    minCoinsForUserPayout: { type: Number, default: 0 }, //for user
    minCoinsForHostPayout: { type: Number, default: 0 }, //for host
    minCoinsForAgencyPayout: { type: Number, default: 0 }, //for agency

    maxFreeChatMessages: { type: Number, default: 0 }, //maximum free messages allowed
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

settingSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Setting", settingSchema);
