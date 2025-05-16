//express
const express = require("express");
const app = express();

//cors
const cors = require("cors");
app.use(cors());
app.use(express.json());

//logging middleware
const logger = require("morgan");
app.use(logger("dev"));

//path
const path = require("path");

//fs
const fs = require("fs");

//dotenv
require("dotenv").config({ path: ".env" });

//socket io
const http = require("http");
const server = http.createServer(app);
global.io = require("socket.io")(server);

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

  //Step 3: Start Server after all setup is done
  server.listen(process?.env.PORT, () => {
    console.log("Hello World ! listening on " + process?.env?.PORT);
  });
}

//Run server startup
startServer();

// const admin = require("firebase-admin");
// const serviceAccount = {};

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// async function deleteAllUsers(nextPageToken) {
//   try {
//     const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);    
//     const uids = listUsersResult.users.map(user => user.uid);

//     console.log(`Fetched ${uids.length} users`);

//     if (uids.length > 0) {
//       const result = await admin.auth().deleteUsers(uids);
//       console.log(`✅ Deleted ${result.successCount} users`);
//       if (result.failureCount > 0) {
//         console.log(`❌ Failed to delete ${result.failureCount} users`);
//         result.errors.forEach(err => {
//           console.error(`Error for UID ${err.index}: ${err.error}`);
//         });
//       }
//     } else {
//       console.log("⚠️ No users found to delete.");
//     }

//     if (listUsersResult.pageToken) {
//       console.log("⏭ Fetching next page of users...");
//       await deleteAllUsers(listUsersResult.pageToken);
//     } else {
//       console.log("✅ All users processed.");
//     }
//   } catch (error) {
//     console.error("❌ Error while deleting users:", error);
//   }
// }

// deleteAllUsers();
