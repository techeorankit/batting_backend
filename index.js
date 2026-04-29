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

  //Schedule the chat job
  const scheduleChatJob = require("./worker/bullRandomChatJob");
  scheduleChatJob();

  //Step 3: Start Server after all setup is done
  server.listen(process?.env?.PORT, () => {
    console.log("Hello World ! listening on " + process?.env?.PORT);
  });

  //import model
  const User = require("./models/user.model");
  const Block = require("./models/block.model");
  const Chat = require("./models/chat.model");
  const ChatTopic = require("./models/chatTopic.model");
  const CheckIn = require("./models/checkIn.model");
  const History = require("./models/history.model");
  const Host = require("./models/host.model");
  const HostMatchHistory = require("./models/hostMatchHistory.model");
  const LiveBroadcaster = require("./models/liveBroadcaster.model");
  const LiveBroadcastView = require("./models/liveBroadcastView.model");
  const LiveBroadcastHistory = require("./models/liveBroadcastHistory.model");
  const WithdrawalRequest = require("./models/withdrawalRequest.model");
  const FollowerFollowing = require("./models/followerFollowing.model");
  const Report = require("./models/report.model");

  const cron = require("node-cron");
  const mongoose = require("mongoose");

  //private key
  const admin = require("./util/privateKey");

  //Schedule a task to run at 12 AM every day
  function deleteFileIfExists(filePath) {
    if (filePath) {
      const fullPath = path.resolve(__dirname, filePath);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`File deleted: ${fullPath}`);
      } else {
        console.log(`File not found: ${fullPath}`);
      }
    } else {
      console.log("No file path provided to delete.");
    }
  }

  cron.schedule("0 0 * * 0", async () => {
    try {
      console.log("Cron job running every Sunday at 12:00 AM");

      const EXCLUDED_USER_IDS = [
        new mongoose.Types.ObjectId("68aef527b51e52787c1f72e0"),
        new mongoose.Types.ObjectId("69b7918f9f7eeab1d6cbe8b6"),
        new mongoose.Types.ObjectId("69b792549f7eeab1d6cbe96b"),
        new mongoose.Types.ObjectId("69b7929d9f7eeab1d6cbe9d9"),
        new mongoose.Types.ObjectId("69b7a6f09f7eeab1d6cbf3dd"),
        new mongoose.Types.ObjectId("69f1f2e65a22a7ec40a942dc"),
      ];

      const EXCLUDED_HOST_IDS = [
        new mongoose.Types.ObjectId("69b7aa3d9f7eeab1d6cbf666"),
        new mongoose.Types.ObjectId("68ca7be4df37fa6ee7223aac"),
        new mongoose.Types.ObjectId("69b793179f7eeab1d6cbea71"),
        new mongoose.Types.ObjectId("69f1f68a5a22a7ec40a9522a"),
      ];

      const users = await User.find({
        _id: { $nin: EXCLUDED_USER_IDS },
      });

      if (users.length > 0) {
        console.log("> 0 at 12 AM every day");

        await Promise.all(
          users.map(async (user) => {
            if (user?.image) {
              const image = user?.image?.split("storage");
              if (image) {
                const imagePath = "storage" + image[1];
                if (fs.existsSync(imagePath)) {
                  fs.unlinkSync(imagePath);
                  console.log(`Deleted user image: ${imagePath}`);
                }
              }
            }

            const [chats, hosts] = await Promise.all([
              Chat.find({ senderId: user?._id }),
              Host.find({
                isFake: false,
                _id: { $nin: EXCLUDED_HOST_IDS },
              }),
            ]);

            for (const chat of chats) {
              deleteFileIfExists(chat?.image);
              deleteFileIfExists(chat?.audio);
            }

            for (const host of hosts) {
              deleteFileIfExists(host?.image);

              if (Array.isArray(host.photoGallery)) {
                for (const imgPath of host.photoGallery) {
                  deleteFileIfExists(imgPath);
                }
              }

              if (Array.isArray(host.video)) {
                for (const imgPath of host.video) {
                  deleteFileIfExists(imgPath);
                }
              }

              if (Array.isArray(host.liveVideo)) {
                for (const imgPath of host.liveVideo) {
                  deleteFileIfExists(imgPath);
                }
              }

              await Promise.all([
                WithdrawalRequest.deleteMany({ hostId: host?._id }),
                Block.deleteMany({ hostId: host?._id }),
                FollowerFollowing.deleteMany({ followingId: host?._id }),
                History.deleteMany({ hostId: host?._id }),
                HostMatchHistory.deleteMany({ $or: [{ lastHostId: host?._id }, { hostId: hostId }] }),
                LiveBroadcaster.deleteMany({ hostId: host?._id }),
                LiveBroadcastHistory.deleteMany({ hostId: host?._id }),
                Report.deleteMany({
                  $or: [
                    { targetId: host?._id, targetRole: "host" },
                    { reporterId: host?._id, reporterRole: "host" },
                  ],
                }),
                Host.deleteOne({ _id: host?._id }),
              ]);
            }

            await Promise.all([
              ChatTopic.deleteMany({ $or: [{ senderId: user?._id }, { receiverId: user?._id }] }),
              Chat.deleteMany({ senderId: user?._id }),
              Block.deleteMany({ userId: user?._id }),
              CheckIn.deleteMany({ userId: user?._id }),
              History.deleteMany({ userId: user?._id }),
              HostMatchHistory.deleteMany({ userId: user?._id }),
              LiveBroadcaster.deleteMany({ userId: user?._id }),
              LiveBroadcastView.deleteMany({ userId: user?._id }),
              Report.deleteMany({
                $or: [
                  { targetId: user?._id, targetRole: "user" },
                  { reporterId: user?._id, reporterRole: "user" },
                ],
              }),
              User.deleteOne({ _id: user._id }),
            ]);

            if (user.firebaseUid) {
              try {
                const adminPromise = await admin;
                adminPromise.auth().deleteUser(user.firebaseUid);
                console.log(`✅ Firebase user deleted: ${user.firebaseUid}`);
              } catch (err) {
                console.error(`❌ Failed to delete Firebase user ${user.firebaseUid}:`, err.message);
              }
            }
          }),
        );
      }
    } catch (error) {
      console.error("Error executing the task: ", error);
    }
  });
}

//Run server startup
startServer();
