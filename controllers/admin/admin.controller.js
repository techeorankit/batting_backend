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

//admin login
// exports.validateAdminLogin = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res.status(200).json({ status: false, message: "Oops! Invalid details!" });
//     }

//     const admin = await Admin.findOne({ email: email.trim() }).select("_id password flag").lean();

//     if (!admin) {
//       return res.status(200).json({ status: false, message: "Oops! Admin not found with that email." });
//     }

//     if (cryptr.decrypt(admin.password) !== password) {
//       return res.status(200).json({ status: false, message: "Oops! Password doesn't match!" });
//     }

//     return res.status(200).json({
//       status: true,
//       message: "Admin has successfully logged in.",
//       data: admin.flag || false,
//     });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
//   }
// };

exports.validateAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(200).json({ status: false, message: "Oops! Invalid details!" });
    }

    let user = await Admin.findOne({ email: email.trim() }).select("_id password flag email").lean();
    let userType = "admin";

    if (!user) {
      console.log("If not found in Admin, check SubAdmin");

      const subAdmin = await SubAdmin.findOne({ email }).populate("role");
      if (!subAdmin) {
        return res.status(200).json({ status: false, message: "No admin or sub-admin found with this email." });
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
      flag: user.flag || false,
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
          const imageName = imagePath.split("/").pop();
          if (!["male.png", "female.png"].includes(imageName)) {
            fs.unlinkSync(imagePath);
          }
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
