const admin = require("firebase-admin");

const privateKey = settingJSON?.privateKey;

if (!privateKey) {
  console.error("❌ Firebase private key not found in global setting.");
  process.exit(1); // Exit process to prevent running without credentials
}

//import model
const Admin = require("../models/admin.model");
const Subadmin = require("../models/subAdmin.model");

const validateAdminFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const adminUid = req.headers["x-admin-uid"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ status: false, message: "Authorization token required" });
  }

  if (!adminUid) {
    return res.status(401).json({ status: false, message: "Admin UID required for authentication." });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const [decodedToken, adminUser, subadminUser] = await Promise.all([
      admin.auth().verifyIdToken(token),
      Admin.findOne({ uid: adminUid }).select("_id email"),
      Subadmin.findOne({ authId: adminUid }).select("_id email").populate("role", "name permissions"),
    ]);

    if (!decodedToken || !decodedToken.email) {
      return res.status(401).json({ status: false, message: "Invalid token. Authorization failed." });
    }

    if (adminUser) {
      req.admin = adminUser;
    } else if (subadminUser) {
      req.subadmin = subadminUser;
    } else {
      return res.status(401).json({ status: false, message: "Admin or Subadmin not found. Authorization failed." });
    }
    next();
  } catch (error) {
    console.error("❌ [AUTH ERROR] Token verification failed:", error.message);
    return res.status(401).json({ status: false, message: "Invalid or expired token. Authorization failed." });
  }
};

module.exports = validateAdminFirebaseToken;
