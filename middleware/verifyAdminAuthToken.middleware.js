const admin = require("firebase-admin");

const privateKey = settingJSON?.privateKey;

if (!privateKey) {
  console.error("❌ Firebase private key not found in global setting.");
  process.exit(1); // Exit process to prevent running without credentials
}

//import model
// const Admin = require("../models/admin.model");

const validateAdminFirebaseToken = async (req, res, next) => {
  console.log("🔹 [AUTH] Validating Admin Firebase token...");

  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn("⚠️ [AUTH] Missing or invalid authorization header.");
    return res.status(401).json({ status: false, message: "Authorization token required" });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    console.log("✅ Decoded Token:", decodedToken);

    if (!decodedToken || !decodedToken.email) {
      console.warn("⚠️ [AUTH] Invalid token. Email not found.");
      return res.status(401).json({ status: false, message: "Invalid token. Authorization failed." });
    }

    const [mainAdmin] = await Promise.all([Admin.findOne({ email: decodedToken.email }).select("_id email password")]);

    if (!mainAdmin) {
      console.warn("⚠️ [AUTH] Admin user not found.");
      return res.status(401).json({ status: false, message: "Admin not found. Authorization failed." });
    }

    req.admin = mainAdmin;
    console.log(`✅ [AUTH] Admin authentication successful. Admin ID: ${mainAdmin._id}`);
    next();
  } catch (error) {
    console.error("❌ [AUTH ERROR] Token verification failed:", error.message);
    return res.status(401).json({ status: false, message: "Invalid or expired token. Authorization failed." });
  }
};

module.exports = validateAdminFirebaseToken;
