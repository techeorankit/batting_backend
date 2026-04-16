const Admin = require("../../models/admin.model");

//fs
const fs = require("fs");

//Cryptr
const Cryptr = require("cryptr");
const cryptr = new Cryptr("myTotallySecretKey");

//Subadmin
const SubAdmin = require("../../models/subAdmin.model");

//deletefile
const { deleteFile } = require("../../util/deletefile");

const Login = require("../../models/login.model");
const Setting = require("../../models/setting.model");

const axios = require("axios");
async function Auth(purchaseCode, expectedItemId) {
  try {
    const response = await axios.get(`https://api.envato.com/v3/market/author/sale?code=${purchaseCode}`, {
      headers: {
        Authorization: `Bearer G9o1R8snTfNCpRgMzzKmpQP9kOVbapnP`,
        "User-Agent": "Purchase verification script",
      },
    });

    const data = response.data;

    if (data && data.item && data.item.id.toString() === expectedItemId.toString()) {
      return true;
    }

    return false;
  } catch (error) {
    if (error.response) {
      if (error.response.status === 404 || error.response.status === 403) {
        return false;
      }

      console.error("API error:", error.response.status, error.response.data);
      return false;
    }

    console.error("Unexpected error:", error.message);
    return false;
  }
}

//admin signUp
exports.registerAdmin = async (req, res) => {
  try {
    const uid = req?.body?.uid?.trim();
    const email = req?.body?.email?.trim();
    const password = req?.body?.password?.trim();
    const purchaseCode = req?.body?.code?.trim();
    const privateKey = req?.body?.privateKey;

    if (!uid || !email || !password || !purchaseCode || !privateKey) {
      return res.status(200).json({ status: false, message: "Oops! Invalid or missing details." });
    }

    const [setting, anyAdminExists, duplicateAdmin, isValidPurchase] = await Promise.all([
      Setting.findOne({}),
      Admin.exists({}),
      Admin.findOne({ $or: [{ uid }, { email }] }),
      Auth(purchaseCode, "58577440"),
    ]);

    if (!setting) {
      return res.status(200).json({ status: false, message: "Settings document not found in database." });
    }

    if (!setting.privateKey || typeof setting.privateKey !== "object") {
      return res.status(200).json({ status: false, message: "Settings document is invalid (missing privateKey)." });
    }

    if (anyAdminExists) {
      return res.status(200).json({ status: false, message: "An admin already exists. Please log in." });
    }

    if (duplicateAdmin) {
      return res.status(200).json({ status: false, message: "Admin with this UID or email already exists." });
    }

    if (!isValidPurchase) {
      return res.status(200).json({ status: false, message: "Purchase code is not valid." });
    }

    const admin = new Admin({
      uid,
      email,
      password: cryptr.encrypt(password),
      purchaseCode,
    });

    await Promise.all([admin.save(), Login.updateOne({}, { $set: { login: true } }, { upsert: true })]);

    res.status(200).json({
      status: true,
      message: "Admin created successfully!",
      admin,
    });

    if (req.body.privateKey) {
      try {
        setting.privateKey = typeof req.body.privateKey === "string" ? JSON.parse(req.body.privateKey.trim()) : req.body.privateKey;
        await setting.save();
        updateSettingFile(setting);

        setTimeout(() => {
          console.log("🔐 Private key updated, restarting server...");
          process.exit(0);
        }, 500); // 0.5s delay
        return;
      } catch (err) {
        console.error("Failed to update privateKey:", err);
      }
    }
  } catch (err) {
    console.error("registerAdmin error:", err);
    return res.status(500).json({ status: false, message: err.message || "Internal Server Error" });
  }
};

//admin login
exports.validateAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(200).json({ status: false, message: "Oops! Invalid details!" });
    }

    let user = await Admin.findOne({ email: email.trim() }).lean();
    let userType = "admin";

    if (!user) {
      console.log("If not found in Admin, check SubAdmin");

      const subAdmin = await SubAdmin.findOne({ email }).populate("role");
      if (!subAdmin) {
        return res.status(200).json({ status: false, message: "No admin or sub-admin found with this email." });
      }

      if (!subAdmin.role.isActive) {
        return res.status(200).json({ status: false, message: "Your role is not active!" });
      }

      if (!subAdmin.isActive) {
        return res.status(200).json({ status: false, message: "Your account is not active!" });
      }

      if (!subAdmin.password || cryptr.decrypt(subAdmin.password) !== password) {
        return res.status(200).json({ status: false, message: "Oops! Password doesn't match!" });
      }

      const ip = req.ip.replace(/^::ffff:/, "");
      subAdmin.lastLoginIp = ip;
      subAdmin.lastLoginAt = new Date();
      await subAdmin.save();

      user = subAdmin.toObject();
      userType = "subadmin";
    } else {
      console.log("Admin password check");

      // const isValidCode = await Auth(user?.purchaseCode, "58577440");
      // if (!isValidCode) {
      //   return res.status(200).json({ status: false, message: "Purchase code is not valid." });
      // }

      if (cryptr.decrypt(user.password) !== password) {
        return res.status(200).json({ status: false, message: "Oops! Password doesn't match!" });
      }
    }

    const responseData = {
      userType,
      name: user.name || "",
      email: user.email || "",
      role: userType === "admin" ? "admin" : user.role?.name || "",
      permissions: userType === "admin" ? [] : user.role?.permissions || [],
    };

    return res.status(200).json({
      status: true,
      message: "Login successful",
      data: responseData,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

//update admin profile
exports.modifyAdminProfile = async (req, res) => {
  try {
    const adminId = req.admin._id;

    const admin = await Admin.findById(adminId).select("name email image password").lean();
    if (!admin) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "Admin not found!" });
    }

    const updateFields = {
      name: req.body?.name || admin.name,
      email: req.body?.email ? req.body.email.trim() : admin.email,
    };

    if (req.file) {
      if (admin.image) {
        const imagePath = admin.image.includes("storage") ? "storage" + admin.image.split("storage")[1] : "";
        if (imagePath && fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      updateFields.image = req.file.path;
    }

    const [updatedAdmin] = await Promise.all([Admin.findByIdAndUpdate(req.admin._id, updateFields, { new: true, select: "name email image password" }).lean()]);

    updatedAdmin.password = cryptr.decrypt(updatedAdmin.password);

    return res.status(200).json({
      status: true,
      message: "Admin profile has been updated.",
      data: updatedAdmin,
    });
  } catch (error) {
    if (req.file) deleteFile(req.file);
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get admin profile
exports.retrieveAdminProfile = async (req, res) => {
  try {
    if (req.admin) {
      const adminId = req.admin._id;

      const admin = await Admin.findById(adminId).select("_id name email password image flag").lean();

      if (!admin) {
        return res.status(200).json({ status: false, message: "Admin not found." });
      }

      admin.password = cryptr.decrypt(admin.password);

      return res.status(200).json({
        status: true,
        message: "Admin profile retrieved successfully!",
        data: admin,
      });
    } else if (req.subadmin) {
      const subadminId = req.subadmin._id;

      const subadmin = await SubAdmin.findById(subadminId).select("_id name email password image flag").lean();

      if (!subadmin) {
        return res.status(200).json({ status: false, message: "Subadmin not found." });
      }

      const flag = !Object.prototype.hasOwnProperty.call(subadmin, "flag");
      subadmin.flag = flag;
      subadmin.password = cryptr.decrypt(subadmin.password);

      return res.status(200).json({
        status: true,
        message: "Subadmin profile retrieved successfully!",
        data: subadmin,
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//update password
exports.modifyPassword = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return res.status(200).json({ status: false, message: "admin does not found." });
    }

    if (!req.body.oldPass || !req.body.newPass || !req.body.confirmPass) {
      return res.status(200).json({ status: false, message: "Oops! Invalid details!" });
    }

    if (cryptr.decrypt(admin.password) !== req.body.oldPass) {
      return res.status(200).json({
        status: false,
        message: "Oops! Password doesn't match!",
      });
    }

    if (req.body.newPass !== req.body.confirmPass) {
      return res.status(200).json({
        status: false,
        message: "Oops ! New Password and Confirm Password don't match!",
      });
    }

    const hash = cryptr.encrypt(req.body.newPass);
    admin.password = hash;

    const [savedAdmin, data] = await Promise.all([admin.save(), Admin.findById(admin._id)]);

    data.password = cryptr.decrypt(savedAdmin.password);

    return res.status(200).json({
      status: true,
      message: "Password has been changed by the admin.",
      data: data,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//set Password
exports.performPasswordReset = async (req, res) => {
  try {
    const admin = await Admin.findById(req?.admin._id);
    if (!admin) {
      return res.status(200).json({ status: false, message: "Admin does not found." });
    }

    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.status(200).json({ status: false, message: "Oops ! Invalid details!" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(200).json({
        status: false,
        message: "Oops! New Password and Confirm Password don't match!",
      });
    }

    admin.password = cryptr.encrypt(newPassword);
    await admin.save();

    admin.password = cryptr.decrypt(admin?.password);

    return res.status(200).json({
      status: true,
      message: "Password has been updated Successfully.",
      data: admin,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//verify email
exports.validateAdminEmail = async (req, res) => {
  try {
    if (!req.query.email) {
      return res.status(200).json({ status: false, message: "Email is required." });
    }

    const admin = await Admin.findOne({ email: req.query.email.trim() });
    if (!admin) {
      return res.status(200).json({ status: false, message: "Admin not found with the provided email." });
    }

    return res.status(200).json({
      status: true,
      message: "Admin email verified successfully.",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
