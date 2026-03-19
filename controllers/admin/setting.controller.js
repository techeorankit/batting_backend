const Setting = require("../../models/setting.model");

//import model
const Host = require("../../models/host.model");

//scheduleChatJob
const scheduleChatJob = require("../../worker/bullRandomChatJob");

const Joi = require("joi");

const sha256Regex = /^([A-F0-9]{2}:){31}[A-F0-9]{2}$/;
const androidAssetLinksSchema = Joi.array()
  .min(1)
  .max(5)
  .items(
    Joi.object({
      relation: Joi.array().items(Joi.string().valid("delegate_permission/common.handle_all_urls")).min(1).required(),

      target: Joi.object({
        namespace: Joi.string().valid("android_app").required(),

        package_name: Joi.string()
          .pattern(/^[a-zA-Z0-9_.]+$/)
          .required(),

        sha256_cert_fingerprints: Joi.array().min(1).max(10).items(Joi.string().uppercase().pattern(sha256Regex).required()).required(),
      })
        .required()
        .unknown(false),
    })
      .required()
      .unknown(false),
  )
  .required();

const appleAppSiteAssociationSchema = Joi.object({
  applinks: Joi.object({
    apps: Joi.array().items(Joi.string()).required(),
    details: Joi.array()
      .items(
        Joi.object({
          appID: Joi.string().required(),
          paths: Joi.array().items(Joi.string()).required(),
        }),
      )
      .min(1)
      .required(),
  }).required(),
}).unknown(true);

//update setting
exports.updateSetting = async (req, res) => {
  try {
    if (!req.query.settingId) {
      return res.status(200).json({ status: false, message: "SettingId must be required." });
    }

    const setting = await Setting.findById(req.query.settingId);
    if (!setting) {
      return res.status(200).json({ status: false, message: "Setting not found." });
    }

    let shouldRescheduleChatJob = false;

    // ====== PAYSTACK ======
    setting.paystackPublicKey = req.body.paystackPublicKey?.trim() ?? setting.paystackPublicKey;
    setting.paystackSecretKey = req.body.paystackSecretKey?.trim() ?? setting.paystackSecretKey;

    // ====== PAYPAL ======
    setting.paypalClientId = req.body.paypalClientId?.trim() ?? setting.paypalClientId;
    setting.paypalSecretKey = req.body.paypalSecretKey?.trim() ?? setting.paypalSecretKey;

    // ====== CASHFREE ======
    setting.cashfreeClientId = req.body.cashfreeClientId?.trim() ?? setting.cashfreeClientId;
    setting.cashfreeClientSecret = req.body.cashfreeClientSecret?.trim() ?? setting.cashfreeClientSecret;

    setting.agoraAppId = req.body.agoraAppId?.trim() ?? setting.agoraAppId;
    setting.agoraAppCertificate = req.body.agoraAppCertificate?.trim() ?? setting.agoraAppCertificate;
    setting.privacyPolicyLink = req.body.privacyPolicyLink?.trim() ?? setting.privacyPolicyLink;
    setting.termsOfUsePolicyLink = req.body.termsOfUsePolicyLink?.trim() ?? setting.termsOfUsePolicyLink;
    setting.stripePublishableKey = req.body.stripePublishableKey?.trim() ?? setting.stripePublishableKey;
    setting.stripeSecretKey = req.body.stripeSecretKey?.trim() ?? setting.stripeSecretKey;
    setting.resendApiKey = req.body.resendApiKey?.trim() ?? setting.resendApiKey;
    setting.razorpayId = req.body.razorpayId?.trim() ?? setting.razorpayId;
    setting.razorpaySecretKey = req.body.razorpaySecretKey?.trim() ?? setting.razorpaySecretKey;
    setting.flutterwaveId = req.body.flutterwaveId?.trim() ?? setting.flutterwaveId;
    setting.loginBonus = req.body.loginBonus ? Number(req.body.loginBonus) : setting.loginBonus;
    setting.adminCommissionRate = req.body.adminCommissionRate ? Number(req.body.adminCommissionRate) : setting.adminCommissionRate;
    setting.minCoinsToConvert = req.body.minCoinsToConvert ? Number(req.body.minCoinsToConvert) : setting.minCoinsToConvert;
    setting.minCoinsForHostPayout = req.body.minCoinsForHostPayout ? Number(req.body.minCoinsForHostPayout) : setting.minCoinsForHostPayout;
    setting.minCoinsForAgencyPayout = req.body.minCoinsForAgencyPayout ? Number(req.body.minCoinsForAgencyPayout) : setting.minCoinsForAgencyPayout;
    setting.maxFreeChatMessages = req.body.maxFreeChatMessages ? Number(req.body.maxFreeChatMessages) : setting.maxFreeChatMessages;

    if ("androidAppVersion" in req.body) {
      setting.androidAppVersion = req.body.androidAppVersion.trim();
    }
    if ("iosAppVersion" in req.body) {
      setting.iosAppVersion = req.body.iosAppVersion.trim();
    }
    if ("androidAppLink" in req.body) {
      setting.androidAppLink = req.body.androidAppLink.trim();
    }
    if ("iosAppLink" in req.body) {
      setting.iosAppLink = req.body.iosAppLink.trim();
    }

    if (req.body.androidAssetLinks !== undefined) {
      let parsedAndroidAssetLinks = req.body.androidAssetLinks;

      if (typeof parsedAndroidAssetLinks === "string") {
        try {
          parsedAndroidAssetLinks = JSON.parse(parsedAndroidAssetLinks.trim());
        } catch (err) {
          return res.status(200).json({
            status: false,
            message: "androidAssetLinks must be valid JSON",
          });
        }
      }

      const { error, value } = androidAssetLinksSchema.validate(parsedAndroidAssetLinks, {
        abortEarly: true,
      });

      if (error) {
        return res.status(200).json({
          status: false,
          message: error.details[0].message,
        });
      }

      setting.androidAssetLinks = Object.freeze(value);
    }

    if (req.body.appleAppSiteAssociation !== undefined) {
      let parsedAppleAASA = req.body.appleAppSiteAssociation;

      if (typeof parsedAppleAASA === "string") {
        try {
          parsedAppleAASA = JSON.parse(parsedAppleAASA.trim());
        } catch (err) {
          return res.status(200).json({
            status: false,
            message: "appleAppSiteAssociation must be valid JSON",
          });
        }
      }

      const { error, value } = appleAppSiteAssociationSchema.validate(parsedAppleAASA, {
        abortEarly: true,
      });

      if (error) {
        return res.status(200).json({
          status: false,
          message: error.details[0].message,
        });
      }

      setting.appleAppSiteAssociation = Object.freeze(value);
    }

    if (req.body.messageInitiatedAt !== undefined) {
      const newVal = Number(req.body.messageInitiatedAt);
      if (newVal !== setting.messageInitiatedAt) {
        shouldRescheduleChatJob = true;
        setting.messageInitiatedAt = newVal;
      }
    }

    if (req.body.callInitiatedAt !== undefined) {
      setting.callInitiatedAt = Number(req.body.callInitiatedAt);
    }

    if (req.body.supportPhoneNumber !== undefined) {
      setting.supportPhoneNumber = req.body.supportPhoneNumber;
    }

    if (req.body.privateKey) {
      setting.privateKey = typeof req.body.privateKey === "string" ? JSON.parse(req.body.privateKey.trim()) : req.body.privateKey;
    }

    setting.generalRandomCallRate = req.body.generalRandomCallRate !== undefined ? Number(req.body.generalRandomCallRate) : setting.generalRandomCallRate;
    setting.femaleRandomCallRate = req.body.femaleRandomCallRate !== undefined ? Number(req.body.femaleRandomCallRate) : setting.femaleRandomCallRate;
    setting.maleRandomCallRate = req.body.maleRandomCallRate !== undefined ? Number(req.body.maleRandomCallRate) : setting.maleRandomCallRate;
    setting.videoPrivateCallRate = req.body.videoPrivateCallRate !== undefined ? Number(req.body.videoPrivateCallRate) : setting.videoPrivateCallRate;
    setting.audioPrivateCallRate = req.body.audioPrivateCallRate !== undefined ? Number(req.body.audioPrivateCallRate) : setting.audioPrivateCallRate;
    setting.chatInteractionRate = req.body.chatInteractionRate !== undefined ? Number(req.body.chatInteractionRate) : setting.chatInteractionRate;

    await setting.save();

    res.status(200).json({
      status: true,
      message: "Setting has been updated.",
      data: setting,
    });

    // await Host.updateMany(
    //   {},
    //   {
    //     $set: {
    //       randomCallRate: setting.generalRandomCallRate,
    //       randomCallFemaleRate: setting.femaleRandomCallRate,
    //       randomCallMaleRate: setting.maleRandomCallRate,
    //       privateCallRate: setting.videoPrivateCallRate,
    //       audioCallRate: setting.audioPrivateCallRate,
    //       chatRate: setting.chatInteractionRate,
    //     },
    //   }
    // );

    global.settingJSON = setting;
    if (shouldRescheduleChatJob) {
      console.log("🔁 Rescheduling chat job...", global?.settingJSON?.messageInitiatedAt);
      await scheduleChatJob();
    }
    updateSettingFile(setting);

    if (req.body.privateKey) {
      try {
        setTimeout(() => {
          console.log("🔐 Private key updated, restarting server...");
          process.exit(0);
        }, 500); // 0.5s delay
        return;
      } catch (err) {
        console.error("Failed to update privateKey:", err);
      }
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//update setting switch
exports.updateSettingToggle = async (req, res) => {
  try {
    if (!req.query.settingId || !req.query.type) {
      return res.status(200).json({ status: false, message: "Oops ! Invalid details!" });
    }

    const setting = await Setting.findById(req.query.settingId);
    if (!setting) {
      return res.status(200).json({ status: false, message: "Setting does not found." });
    }

    const type = req.query.type.trim();

    if (type === "googlePlayEnabled") {
      setting.googlePlayEnabled = !setting.googlePlayEnabled;
    } else if (type === "stripeEnabled") {
      setting.stripeEnabled = !setting.stripeEnabled;
    } else if (type === "razorpayEnabled") {
      setting.razorpayEnabled = !setting.razorpayEnabled;
    } else if (type === "flutterwaveEnabled") {
      setting.flutterwaveEnabled = !setting.flutterwaveEnabled;
    } else if (type === "isDemoData") {
      setting.isDemoData = !setting.isDemoData;
    } else if (type === "isAppEnabled") {
      setting.isAppEnabled = !setting.isAppEnabled;
    } else if (type === "isAutoRefreshEnabled") {
      setting.isAutoRefreshEnabled = !setting.isAutoRefreshEnabled;
    } else if (type === "paystackAndroidEnabled") {
      setting.paystackAndroidEnabled = !setting.paystackAndroidEnabled;
    } else if (type === "paystackIosEnabled") {
      setting.paystackIosEnabled = !setting.paystackIosEnabled;
    } else if (type === "paypalAndroidEnabled") {
      setting.paypalAndroidEnabled = !setting.paypalAndroidEnabled;
    } else if (type === "paypalIosEnabled") {
      setting.paypalIosEnabled = !setting.paypalIosEnabled;
    } else if (type === "cashfreeAndroidEnabled") {
      setting.cashfreeAndroidEnabled = !setting.cashfreeAndroidEnabled;
    } else if (type === "cashfreeIosEnabled") {
      setting.cashfreeIosEnabled = !setting.cashfreeIosEnabled;
    } else if (type === "googlePayIosEnabled") {
      setting.googlePayIosEnabled = !setting.googlePayIosEnabled;
    } else if (type === "stripeIosEnabled") {
      setting.stripeIosEnabled = !setting.stripeIosEnabled;
    } else if (type === "razorpayIosEnabled") {
      setting.razorpayIosEnabled = !setting.razorpayIosEnabled;
    } else if (type === "flutterwaveIosEnabled") {
      setting.flutterwaveIosEnabled = !setting.flutterwaveIosEnabled;
    } else if (type === "isAutoMessageEnabled") {
      setting.isAutoMessageEnabled = !setting.isAutoMessageEnabled;
    } else if (type === "isAutoCallEnabled") {
      setting.isAutoCallEnabled = !setting.isAutoCallEnabled;
    } else {
      return res.status(200).json({ status: false, message: "type passed must be valid." });
    }

    await setting.save();

    res.status(200).json({ status: true, message: "Success", data: setting });

    updateSettingFile(setting);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get setting
exports.fetchSettings = async (req, res) => {
  try {
    const setting = settingJSON ? settingJSON : null;
    if (!setting) {
      return res.status(200).json({ status: false, message: "Setting does not found." });
    }

    return res.status(200).json({ status: true, message: "Success", data: setting });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
