const path = require("path");
const dotenv = require("dotenv");

const envPath = path.join(__dirname, "..", ".env");
const legacyEnvPath = path.join(__dirname, "..", "env");

const result = dotenv.config({ path: envPath });
if (result.error) {
  dotenv.config({ path: legacyEnvPath });
}

const requiredEnv = ["MongoDb_Connection_String", "secretKey"];

function validateEnv() {
  const missing = requiredEnv.filter((key) => !process.env[key] || String(process.env[key]).trim() === "");

  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
}

function getPort() {
  return Number(process.env.PORT || 5000);
}

module.exports = {
  validateEnv,
  getPort,
};
