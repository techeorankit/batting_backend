const Setting = require("../../models/setting.model");

//import model
const Admin = require("../../models/admin.model");
const Host = require("../../models/host.model");

//scheduleChatJob
const scheduleChatJob = require("../../worker/bullRandomChatJob");

const Joi = require("joi");
const axios = require("axios");

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

    // ====== PAYMENT ======
    setting.apiKey = req.body.apiKey?.trim() ?? setting.apiKey;
    setting.sandboxKey = req.body.sandboxKey?.trim() ?? setting.sandboxKey;
    setting.payCurrency = req.body.payCurrency?.trim() ?? setting.payCurrency;

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

    const updatedHostfield = {};

    if (req.body.generalRandomCallRate) {
      if (isNaN(req.body.generalRandomCallRate)) {
        return res.status(200).json({
          status: false,
          message: "generalRandomCallRate must be a number",
        });
      }
      setting.generalRandomCallRate = Number(req.body.generalRandomCallRate);
      updatedHostfield.randomCallRate = Number(req.body.generalRandomCallRate);
    }

    if (req.body.femaleRandomCallRate) {
      if (isNaN(req.body.femaleRandomCallRate)) {
        return res.status(200).json({
          status: false,
          message: "femaleRandomCallRate must be a number",
        });
      }
      setting.femaleRandomCallRate = Number(req.body.femaleRandomCallRate);
      updatedHostfield.randomCallFemaleRate = Number(req.body.femaleRandomCallRate);
    }

    if (req.body.maleRandomCallRate) {
      if (isNaN(req.body.maleRandomCallRate)) {
        return res.status(200).json({
          status: false,
          message: "maleRandomCallRate must be a number",
        });
      }
      setting.maleRandomCallRate = Number(req.body.maleRandomCallRate);
      updatedHostfield.randomCallMaleRate = Number(req.body.maleRandomCallRate);
    }

    if (req.body.videoPrivateCallRate) {
      if (isNaN(req.body.videoPrivateCallRate)) {
        return res.status(200).json({
          status: false,
          message: "videoPrivateCallRate must be a number",
        });
      }
      setting.videoPrivateCallRate = Number(req.body.videoPrivateCallRate);
      updatedHostfield.privateCallRate = Number(req.body.videoPrivateCallRate);
    }

    if (req.body.audioPrivateCallRate) {
      if (isNaN(req.body.audioPrivateCallRate)) {
        return res.status(200).json({
          status: false,
          message: "audioPrivateCallRate must be a number",
        });
      }
      setting.audioPrivateCallRate = Number(req.body.audioPrivateCallRate);
      updatedHostfield.audioCallRate = Number(req.body.audioPrivateCallRate);
    }

    if (req.body.chatInteractionRate) {
      if (isNaN(req.body.chatInteractionRate)) {
        return res.status(200).json({
          status: false,
          message: "chatInteractionRate must be a number",
        });
      }
      setting.chatInteractionRate = Number(req.body.chatInteractionRate);
      updatedHostfield.chatRate = Number(req.body.chatInteractionRate);
    }

    await setting.save();

    res.status(200).json({
      status: true,
      message: "Setting has been updated.",
      data: setting,
    });

    if (Object.keys(updatedHostfield).length > 0) {
      const updatePromises = [];

      if (updatedHostfield.randomCallRate !== undefined) {
        updatePromises.push(Host.updateMany({ randomCallRate: { $lt: updatedHostfield.randomCallRate } }, { $set: { randomCallRate: updatedHostfield.randomCallRate } }));
      }

      if (updatedHostfield.randomCallFemaleRate !== undefined) {
        updatePromises.push(Host.updateMany({ randomCallFemaleRate: { $lt: updatedHostfield.randomCallFemaleRate } }, { $set: { randomCallFemaleRate: updatedHostfield.randomCallFemaleRate } }));
      }

      if (updatedHostfield.randomCallMaleRate !== undefined) {
        updatePromises.push(Host.updateMany({ randomCallMaleRate: { $lt: updatedHostfield.randomCallMaleRate } }, { $set: { randomCallMaleRate: updatedHostfield.randomCallMaleRate } }));
      }

      if (updatedHostfield.privateCallRate !== undefined) {
        updatePromises.push(Host.updateMany({ privateCallRate: { $lt: updatedHostfield.privateCallRate } }, { $set: { privateCallRate: updatedHostfield.privateCallRate } }));
      }

      if (updatedHostfield.audioCallRate !== undefined) {
        updatePromises.push(Host.updateMany({ audioCallRate: { $lt: updatedHostfield.audioCallRate } }, { $set: { audioCallRate: updatedHostfield.audioCallRate } }));
      }

      if (updatedHostfield.chatRate !== undefined) {
        updatePromises.push(Host.updateMany({ chatRate: { $lt: updatedHostfield.chatRate } }, { $set: { chatRate: updatedHostfield.chatRate } }));
      }

      await Promise.all(updatePromises);
    }

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
// exports.updateSettingToggle = async (req, res) => {
//   try {
//     if (!req.query.settingId || !req.query.type) {
//       return res.status(200).json({ status: false, message: "Oops ! Invalid details!" });
//     }

//     const setting = await Setting.findById(req.query.settingId);
//     if (!setting) {
//       return res.status(200).json({ status: false, message: "Setting does not found." });
//     }

//     const type = req.query.type.trim();
//     const PAYMENT_TYPES = [
//       "googlePlayEnabled",
//       "stripeEnabled",
//       "razorpayEnabled",
//       "flutterwaveEnabled",
//       "paystackAndroidEnabled",
//       "paystackIosEnabled",
//       "paypalAndroidEnabled",
//       "paypalIosEnabled",
//       "cashfreeAndroidEnabled",
//       "cashfreeIosEnabled",
//       "googlePayIosEnabled",
//       "stripeIosEnabled",
//       "razorpayIosEnabled",
//       "flutterwaveIosEnabled",
//     ];

//     if (PAYMENT_TYPES.includes(type)) {
//       const admin = await Admin.findById(req.admin._id).select("purchaseCode").lean();

//       if (!admin || !admin.purchaseCode) {
//         return res.status(200).json({
//           status: false,
//           message: "Purchase code not found. Verify license first.",
//         });
//       }

//       try {
//         const response = await axios.get(`https://api.envato.com/v3/market/author/sale?code=${admin.purchaseCode}`, {
//           headers: {
//             Authorization: `Bearer G9o1R8snTfNCpRgMzzKmpQP9kOVbapnP`,
//           },
//         });

//         const data = response?.data;

//         if (!data || !data.item) {
//           return res.status(200).json({
//             status: false,
//             message: "Invalid purchase code. Payment settings locked.",
//           });
//         }

//         const license = data?.license?.toLowerCase();

//         if (license?.includes("regular")) {
//           return res.status(200).json({
//             status: false,
//             message: "Regular license is not allowed for payment settings",
//             allowPaymentSettings: false,
//           });
//         }
//       } catch (err) {
//         console.log("Envato Error:", err?.response?.data || err.message);

//         return res.status(200).json({
//           status: false,
//           message: "Purchase verification failed",
//         });
//       }
//     }

//     if (type === "googlePlayEnabled") {
//       setting.googlePlayEnabled = !setting.googlePlayEnabled;
//     } else if (type === "stripeEnabled") {
//       setting.stripeEnabled = !setting.stripeEnabled;
//     } else if (type === "razorpayEnabled") {
//       setting.razorpayEnabled = !setting.razorpayEnabled;
//     } else if (type === "flutterwaveEnabled") {
//       setting.flutterwaveEnabled = !setting.flutterwaveEnabled;
//     } else if (type === "isDemoData") {
//       setting.isDemoData = !setting.isDemoData;
//     } else if (type === "isAppEnabled") {
//       setting.isAppEnabled = !setting.isAppEnabled;
//     } else if (type === "isAutoRefreshEnabled") {
//       setting.isAutoRefreshEnabled = !setting.isAutoRefreshEnabled;
//     } else if (type === "paystackAndroidEnabled") {
//       setting.paystackAndroidEnabled = !setting.paystackAndroidEnabled;
//     } else if (type === "paystackIosEnabled") {
//       setting.paystackIosEnabled = !setting.paystackIosEnabled;
//     } else if (type === "paypalAndroidEnabled") {
//       setting.paypalAndroidEnabled = !setting.paypalAndroidEnabled;
//     } else if (type === "paypalIosEnabled") {
//       setting.paypalIosEnabled = !setting.paypalIosEnabled;
//     } else if (type === "cashfreeAndroidEnabled") {
//       setting.cashfreeAndroidEnabled = !setting.cashfreeAndroidEnabled;
//     } else if (type === "cashfreeIosEnabled") {
//       setting.cashfreeIosEnabled = !setting.cashfreeIosEnabled;
//     } else if (type === "googlePayIosEnabled") {
//       setting.googlePayIosEnabled = !setting.googlePayIosEnabled;
//     } else if (type === "stripeIosEnabled") {
//       setting.stripeIosEnabled = !setting.stripeIosEnabled;
//     } else if (type === "razorpayIosEnabled") {
//       setting.razorpayIosEnabled = !setting.razorpayIosEnabled;
//     } else if (type === "flutterwaveIosEnabled") {
//       setting.flutterwaveIosEnabled = !setting.flutterwaveIosEnabled;
//     } else if (type === "isAutoMessageEnabled") {
//       setting.isAutoMessageEnabled = !setting.isAutoMessageEnabled;
//     } else if (type === "isAutoCallEnabled") {
//       setting.isAutoCallEnabled = !setting.isAutoCallEnabled;
//     } else {
//       return res.status(200).json({ status: false, message: "type passed must be valid." });
//     }

//     await setting.save();

//     res.status(200).json({ status: true, message: "Success", data: setting });

//     updateSettingFile(setting);
//   } catch (error) {
//     console.log(error);
//     return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
//   }
// };

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
    } else if (type === "nowPaymentAndroidEnabled") {
      setting.nowPaymentAndroidEnabled = !setting.nowPaymentAndroidEnabled;
    } else if (type === "nowPaymentIosEnabled") {
      setting.nowPaymentIosEnabled = !setting.nowPaymentIosEnabled;
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
    } else if (type === "isTest") {
      setting.isTest = !setting.isTest;
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

//authorize purchase code
exports.authorizePurchaseCode = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select("purchaseCode").lean();
    if (!admin || !admin.purchaseCode) {
      return res.status(200).json({ status: false, message: "Purchase code not found" });
    }

    const purchaseCode = admin.purchaseCode;

    const response = await axios.get(`https://api.envato.com/v3/market/author/sale?code=${purchaseCode}`, {
      headers: {
        Authorization: `Bearer G9o1R8snTfNCpRgMzzKmpQP9kOVbapnP`,
      },
    });

    const data = response?.data;
    console.log("Envato Response:", data.license);

    if (!data || !data.item) {
      return res.status(200).json({ status: false, message: "Invalid purchase code" });
    }

    const license = data?.license;

    if (!license) {
      return res.status(200).json({ status: false, message: "License info not found" });
    }

    if (license.toLowerCase().includes("regular")) {
      return res.status(200).json({
        status: false,
        message: "Regular license is not allowed for payment settings",
        allowPaymentSettings: false,
      });
    }

    if (license.toLowerCase().includes("extended")) {
      return res.status(200).json({
        status: true,
        message: "Extended license verified successfully",
        allowPaymentSettings: true,
      });
    }

    return res.status(200).json({
      status: false,
      message: "Unsupported license type",
      allowPaymentSettings: false,
    });
  } catch (error) {
    console.log("Envato Error:", error?.response?.data || error.message);

    return res.status(200).json({
      status: false,
      message: "Invalid or expired purchase code",
      allowPaymentSettings: false,
    });
  }
};
