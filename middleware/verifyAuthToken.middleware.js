const admin = require("firebase-admin");

const privateKey = settingJSON?.privateKey;

if (!privateKey) {
  process.exit(1); // Exit process to prevent running without credentials
}

const validateAuthToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ status: false, message: "Authorization token required" });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);

    if (!decodedToken) {
      return res.status(401).json({ status: false, message: "Invalid token. Authorization failed." });
    }

    req.user = {
      uid: decodedToken.uid,
      provider: decodedToken.firebase?.sign_in_provider || "unknown",
    };

    next();
  } catch (error) {
    return res.status(401).json({
      status: false,
      message: error.code === "auth/id-token-expired" ? "Token expired. Please reauthenticate." : "Invalid token. Authorization failed.",
    });
  }
};

module.exports = validateAuthToken;
