const Admin = require("../../models/admin.model");

//fs
const fs = require("fs");

//jwt token
const jwt = require("jsonwebtoken");

//nodemailer
const nodemailer = require("nodemailer");

//Cryptr
const Cryptr = require("cryptr");
const cryptr = new Cryptr("myTotallySecretKey");

//deletefile
const { deleteFile } = require("../../util/deletefile");

//admin login
exports.validateAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(200).json({ status: false, message: "Oops! Invalid details!" });
    }

    const admin = await Admin.findOne({ email: email.trim() }).select("_id").lean();

    if (!admin) {
      return res.status(200).json({ status: false, message: "Oops! Admin not found with that email." });
    }

    if (cryptr.decrypt(admin.password) !== password) {
      return res.status(200).json({ status: false, message: "Oops! Password doesn't match!" });
    }

    return res.status(200).json({
      status: true,
      message: "Admin has successfully logged in.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
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
    const adminId = req.admin._id;

    const [admin] = await Promise.all([Admin.findById(adminId).select("_id name email password role").lean()]);

    if (!admin) {
      return res.status(200).json({ status: false, message: "Admin not found." });
    }

    admin.password = CryptrInstance.decrypt(admin.password);

    return res.status(200).json({
      status: true,
      message: "Admin profile retrieved successfully!",
      data: admin,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//send email ( forgot password )
exports.sendPasswordResetRequest = async (req, res) => {
  try {
    if (!req.query.email) {
      return res.status(200).json({ status: false, message: "email must be requried." });
    }

    const email = req.query.email.trim();

    const admin = await Admin.findOne({ email: email });
    if (!admin) {
      return res.status(200).json({ status: false, message: "admin does not found with that email." });
    }

    var transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process?.env?.EMAIL,
        pass: process?.env?.APP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    var tab = "";
    tab += "<!DOCTYPE html><html><head>";
    tab += "<meta charset='utf-8'><meta http-equiv='x-ua-compatible' content='ie=edge'><meta name='viewport' content='width=device-width, initial-scale=1'>";
    tab += "<style type='text/css'>";
    tab += " @media screen {@font-face {font-family: 'Source Sans Pro';font-style: normal;font-weight: 400;}";
    tab += "@font-face {font-family: 'Source Sans Pro';font-style: normal;font-weight: 700;}}";
    tab += "body,table,td,a {-ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }";
    tab += "table,td {mso-table-rspace: 0pt;mso-table-lspace: 0pt;}";
    tab += "img {-ms-interpolation-mode: bicubic;}";
    tab +=
      "a[x-apple-data-detectors] {font-family: inherit !important;font-size: inherit !important;font-weight: inherit !important;line-height:inherit !important;color: inherit !important;text-decoration: none !important;}";
    tab += "div[style*='margin: 16px 0;'] {margin: 0 !important;}";
    tab += "body {width: 100% !important;height: 100% !important;padding: 0 !important;margin: 0 !important;}";
    tab += "table {border-collapse: collapse !important;}";
    tab += "a {color: #1a82e2;}";
    tab += "img {height: auto;line-height: 100%;text-decoration: none;border: 0;outline: none;}";
    tab += "</style></head><body>";
    tab += "<table border='0' cellpadding='0' cellspacing='0' width='100%'>";
    tab += "<tr><td align='center' bgcolor='#e9ecef'><table border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width: 600px;'>";
    tab += "<tr><td align='center' valign='top' bgcolor='#ffffff' style='padding:36px 24px 0;border-top: 3px solid #d4dadf;'><a href='#' target='_blank' style='display: inline-block;'>";
    tab +=
      "<img src='https://www.stampready.net/dashboard/editor/user_uploads/zip_uploads/2018/11/23/5aXQYeDOR6ydb2JtSG0p3uvz/zip-for-upload/images/template1-icon.png' alt='Logo' border='0' width='48' style='display: block; width: 500px; max-width: 500px; min-width: 500px;'></a>";
    tab +=
      "</td></tr></table></td></tr><tr><td align='center' bgcolor='#e9ecef'><table border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width: 600px;'><tr><td align='center' bgcolor='#ffffff'>";
    tab += "<h1 style='margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -1px; line-height: 48px;'>SET YOUR PASSWORD</h1></td></tr></table></td></tr>";
    tab +=
      "<tr><td align='center' bgcolor='#e9ecef'><table border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width: 600px;'><tr><td align='center' bgcolor='#ffffff' style='padding: 24px; font-size: 16px; line-height: 24px;font-weight: 600'>";
    tab += "<p style='margin: 0;'>Not to worry, We got you! Let's get you a new password.</p></td></tr><tr><td align='left' bgcolor='#ffffff'>";
    tab += "<table border='0' cellpadding='0' cellspacing='0' width='100%'><tr><td align='center' bgcolor='#ffffff' style='padding: 12px;'>";
    tab += "<table border='0' cellpadding='0' cellspacing='0'><tr><td align='center' style='border-radius: 4px;padding-bottom: 50px;'>";
    tab +=
      "<a href='" +
      process?.env?.baseURL +
      "changePassword?id=" +
      `${admin._id}` +
      "' target='_blank' style='display: inline-block; padding: 16px 36px; font-size: 16px; color: #ffffff; text-decoration: none; border-radius: 4px;background: #FE9A16; box-shadow: -2px 10px 20px -1px #33cccc66;'>SUBMIT PASSWORD</a>";
    tab += "</td></tr></table></td></tr></table></td></tr></table></td></tr></table></body></html>";

    var mailOptions = {
      from: process?.env?.EMAIL,
      to: email,
      subject: `Sending email from ${process?.env?.projectName} for Password Security`,
      html: tab,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
        return res.status(200).json({
          status: false,
          message: "Email send error.",
        });
      } else {
        return res.status(200).json({
          status: true,
          message: "Email send for forget the password.",
        });
      }
    });
  } catch (error) {
    console.log(error);
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
