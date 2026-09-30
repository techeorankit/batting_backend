const admin = require("firebase-admin");

const privateKey = settingJSON?.privateKey;

if (!privateKey) {
  process.exit(1); // Exit process to prevent running without credentials
}

//import model
const Agency = require("../models/agency.model");

const validateAgencyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const agencyUid = req.headers["x-agency-uid"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ status: false, message: "Authorization token required" });
  }

  if (!agencyUid) {
    return res.status(401).json({ status: false, message: "Agency UID required for authentication." });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const [decodedToken, agency] = await Promise.all([admin.auth().verifyIdToken(token), Agency.findOne({ uid: agencyUid }).select("_id email password")]);

    if (!decodedToken || !decodedToken.email) {
      return res.status(401).json({ status: false, message: "Invalid token. Authorization failed." });
    }

    if (!agency) {
      return res.status(401).json({ status: false, message: "Agency not found. Authorization failed." });
    }

    req.agency = agency;
    next();
  } catch (error) {
    return res.status(401).json({ status: false, message: "Invalid or expired token. Authorization failed." });
  }
};

module.exports = validateAgencyFirebaseToken;
