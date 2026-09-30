//express
const express = require("express");
const app = express();

//cors
const cors = require("cors");
app.use(cors());
app.use(express.json());

app.set("trust proxy", true);

//logging middleware
const logger = require("morgan");
app.use(logger("dev"));

//path
const path = require("path");

//fs
const fs = require("fs");

//dotenv
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

//socket io
const http = require("http");
const server = http.createServer(app);
global.io = require("socket.io")(server);
const isRedisAvailable = require("./util/isRedisAvailable");

//connection.js
const db = require("./util/connection");

//Declare global variable
global.settingJSON = {};

//Declare the function as a global variable to update the setting.js file
global.updateSettingFile = (settingData) => {
  const settingJSON = JSON.stringify(settingData, null, 2);
  fs.writeFileSync("setting.js", `module.exports = ${settingJSON};`, "utf8");

  global.settingJSON = settingData; // Update global variable
  console.log("Settings file updated.");
};

//Step 1: Import initializeSettings
const initializeSettings = require("./util/initializeSettings");

async function startServer() {
  console.log("🔄 Initializing settings...");
  await initializeSettings();
  console.log("✅ Settings Loaded");

  app.get("/.well-known/assetlinks.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(global?.settingJSON?.androidAssetLinks || []);
  });

  app.get("/.well-known/apple-app-site-association", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(global?.settingJSON?.appleAppSiteAssociation || {});
  });

  //Step 2: Require all other modules after settings are initialized
  const routes = require("./routes/route");
  app.use("/api", routes);

  require("./socket");

  app.use("/storage", express.static(path.join(__dirname, "storage")));

  db.on("error", () => {
    console.log("Connection Error: ");
  });

  db.once("open", async () => {
    console.log("Mongo: successfully connected to db");
  });

  //Schedule background chat jobs only when Redis is reachable.
  const redisHost = process.env.REDIS_HOST || "127.0.0.1";
  const redisPort = Number(process.env.REDIS_PORT || 6379);
  if (await isRedisAvailable()) {
    const scheduleChatJob = require("./worker/bullRandomChatJob");
    scheduleChatJob();
  } else {
    console.warn(`Redis unavailable at ${redisHost}:${redisPort}; background chat queue is disabled.`);
  }

  //Step 3: Start Server after all setup is done
  server.listen(process?.env?.PORT, () => {
    console.log("Hello World ! listening on " + process?.env?.PORT);
  });
}

//Run server startup
startServer();
