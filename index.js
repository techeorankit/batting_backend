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

  //Schedule the chat job
  const scheduleChatJob = require("./worker/bullRandomChatJob");
  scheduleChatJob();

  //Step 3: Start Server after all setup is done
  server.listen(process?.env.PORT, () => {
    console.log("Hello World ! listening on " + process?.env?.PORT);
  });
}

//Run server startup
startServer();

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

const cron = require("node-cron");

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

    const users = await User.find({
      _id: { $ne: "68555d4280ab3d1897a91da7" },
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
              _id: { $ne: "68555e4580ab3d1897a91dfb" },
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
            Host.deleteMany({
              isFake: false,
              _id: { $ne: "68555e4580ab3d1897a91dfb" },
            }),
            User.deleteOne({ _id: user._id }),
          ]);
        })
      );
    }
  } catch (error) {
    console.error("Error executing the task: ", error);
  }
});

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

// const Bull = require("bull");
// const chatQueue = new Bull("chat-job-queue", {
//   redis: {
//     host: "127.0.0.1",
//     port: 6379,
//   },
// });

// (async () => {
//   const jobs = await chatQueue.getJobs(["delayed", "waiting", "active", "completed", "failed"]);

//   for (const job of jobs) {
//     console.log(`Job ID: ${job.id}`);
//     console.log(`Name: ${job.name}`);
//     console.log(`Data:`, job.data);
//     console.log(`Status: ${await job.getState()}`);
//   }
// })();

// Remove jobs in each state
// (async () => {
//   const states = ["delayed", "wait", "active", "completed", "failed"];

//   for (const state of states) {
//     const jobs = await chatQueue.getJobs([state]);
//     for (const job of jobs) {
//       await job.remove();
//       console.log(`Removed job ${job.id} from ${state}`);
//     }
//   }

//   // Optionally, empty the queue's wait/delayed list entirely
//   await chatQueue.empty(); // This clears only 'wait' and 'paused' jobs

//   console.log("All jobs cleared.");
// })();
