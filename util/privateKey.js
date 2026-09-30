const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

function loadServiceAccount() {
  let serviceAccount;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountPath) {
    const resolvedPath = path.resolve(__dirname, "..", serviceAccountPath);
    try {
      serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
    } catch (error) {
      throw new Error(`Unable to read Firebase service account at ${resolvedPath}: ${error.message}`);
    }
  } else if (serviceAccountJson) {
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (error) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ${error.message}`);
    }
  } else {
    serviceAccount = global.settingJSON?.privateKey;
  }

  if (typeof serviceAccount?.private_key === "string") {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  if (!serviceAccount?.project_id || !serviceAccount?.client_email || !serviceAccount?.private_key) {
    throw new Error(
      "Firebase Admin credentials are missing or incomplete. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON, or configure a valid privateKey in database settings."
    );
  }

  if (process.env.FIREBASE_PROJECT_ID && serviceAccount.project_id !== process.env.FIREBASE_PROJECT_ID) {
    throw new Error("Firebase Admin service account project_id does not match FIREBASE_PROJECT_ID.");
  }

  return serviceAccount;
}

const initFirebase = async () => {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(loadServiceAccount()),
      });
      console.log("✅ Firebase Admin SDK initialized successfully");
    }
    return admin;
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
    throw error;
  }
};

module.exports = initFirebase();
