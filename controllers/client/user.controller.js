const User = require("../../models/user.model");

//fs
const fs = require("fs");

//mongoose
const mongoose = require("mongoose");

//import model
const History = require("../../models/history.model");
const Host = require("../../models/host.model");
const ChatTopic = require("../../models/chatTopic.model");
const Chat = require("../../models/chat.model");
const Message = require("../../models/message.model");
const LiveBroadcastHistory = require("../../models/liveBroadcastHistory.model");
const Block = require("../../models/block.model");
const CheckIn = require("../../models/checkIn.model");
const HostMatchHistory = require("../../models/hostMatchHistory.model");
const LiveBroadcastView = require("../../models/liveBroadcastView.model");
const LiveBroadcaster = require("../../models/liveBroadcaster.model");
const FollowerFollowing = require("../../models/followerFollowing.model");
const WithdrawalRequest = require("../../models/withdrawalRequest.model");
const Report = require("../../models/report.model");

//deletefile
const { deleteFile } = require("../../util/deletefile");

//userFunction
const userFunction = require("../../util/userFunction");

const path = require("path");

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

//generateHistoryUniqueId
const generateHistoryUniqueId = require("../../util/generateHistoryUniqueId");

//validatePlanExpiration
const validatePlanExpiration = require("../../util/validatePlanExpiration");

//private key
const admin = require("../../util/privateKey");

//check the user is exists or not with loginType 3 quick (identity)
exports.quickUserVerification = async (req, res) => {
  try {
    const { identity } = req.query;

    if (!identity) {
      return res.status(200).json({ status: false, message: "identity is required." });
    }

    const user = await User.findOne({ identity, loginType: 3 }).select("_id").lean();

    return res.status(200).json({
      status: true,
      message: user ? "User login successfully." : "User must sign up.",
      isLogin: !!user,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

//user login and sign up
exports.signInOrSignUpUser = async (req, res) => {
  try {
    const { identity, loginType, fcmToken, email, name, image, dob, countryCode, mobileNumber } = req.body || {};

    if (!identity || loginType === undefined || !fcmToken) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "Oops! Invalid details!!" });
    }

    const { uid, provider } = req.user;

    let userQuery;

    switch (loginType) {
      case 1:
        if (!email) {
          if (req.file) deleteFile(req.file);
          return res.status(200).json({ status: false, message: "email is required." });
        }
        userQuery = { firebaseUid: uid, email, loginType: 1 };
        break;
      case 2:
        if (!email) {
          if (req.file) deleteFile(req.file);
          return res.status(200).json({ status: false, message: "email is required." });
        }
        userQuery = { firebaseUid: uid, email, loginType: 2 };
        break;
      case 3:
        if (!identity && !email) {
          if (req.file) deleteFile(req.file);
          return res.status(200).json({ status: false, message: "Either identity or email is required." });
        }
        userQuery = { firebaseUid: uid, loginType: 3 };
        break;
      case 4:
        if (!mobileNumber) {
          return res.status(200).json({ status: false, message: "mobileNumber is required." });
        }

        userQuery = { firebaseUid: uid, mobileNumber: mobileNumber.trim(), loginType: 4 };
        break;
      case 5:
        if (!email) {
          return res.status(200).json({ status: false, message: "email must be required." });
        }

        userQuery = { firebaseUid: uid, email: email.trim(), loginType: 5 };
        break;
      default:
        if (req.file) deleteFile(req.file);
        return res.status(200).json({ status: false, message: "Invalid loginType." });
    }

    let user = null;
    if (Object.keys(userQuery).length > 0) {
      user = await User.findOne(userQuery).select("_id loginType name image email countryCode mobileNumber identity fcmToken lastlogin isBlock isHost hostId firebaseUid");
    }

    if (user) {
      console.log("✅ User already exists, logging in...");

      if (user.firebaseUid && user.firebaseUid !== uid) {
        console.log("If a user exists but firebaseUid mismatch");
        console.warn(`⚠️ UID mismatch — token UID (${uid}) vs user.firebaseUid (${user.firebaseUid})`);
        if (req.file) deleteFile(req.file);
        return res.status(200).json({
          status: false,
          message: "Identity already taken or unauthorized login attempt.",
        });
      }

      if (user.isBlock) {
        if (req.file) deleteFile(req.file);
        return res.status(200).json({ status: false, message: "🚷 User is blocked by the admin." });
      }

      if (user.isHost && user.hostId) {
        const host = await Host.findById(user.hostId).select("isBlock fcmToken");

        if (!host) {
          console.warn(`⚠️ No Host found with ID: ${user.hostId}`);
        } else {
          if (host.isBlock) {
            if (req.file) deleteFile(req.file);
            return res.status(200).json({ status: false, message: "🚷 Host account is blocked by the admin." });
          }

          host.fcmToken = fcmToken || host.fcmToken;
          await host.save();
        }
      }

      user.email = email ? email?.trim() : user?.email;
      user.identity = identity ? identity?.trim() : user?.identity;
      user.countryCode = countryCode ? countryCode?.trim() : user?.countryCode;
      user.mobileNumber = mobileNumber ? mobileNumber?.trim() : user?.mobileNumber;
      user.name = name ? name?.trim() : user?.name;
      user.dob = dob ? dob?.trim() : user?.dob;
      user.image = req.file ? req.file.path : image ? image : user?.image;
      user.fcmToken = fcmToken ? fcmToken : user?.fcmToken;
      user.lastlogin = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
      await user.save();

      return res.status(200).json({ status: true, message: "User logged in.", user: user, signUp: false });
    } else {
      console.log("🆕 Registering new user...");

      const bonusCoins = settingJSON?.loginBonus ? settingJSON?.loginBonus : 5000;

      const newUser = new User();
      newUser.firebaseUid = uid;
      newUser.provider = provider;
      newUser.coin = bonusCoins;
      newUser.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

      const user = await userFunction(newUser, req);

      res.status(200).json({
        status: true,
        message: "A new user has registered an account.",
        signUp: true,
        user: {
          _id: user._id,
          loginType: user.loginType,
          name: user.name,
          image: user.image,
          fcmToken: user.fcmToken,
          lastlogin: user.lastlogin,
        },
      });

      const uniqueId = await generateHistoryUniqueId();

      await Promise.all([
        History.create({
          uniqueId: uniqueId,
          userId: newUser._id,
          userCoin: bonusCoins,
          type: 1,
          date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
        }),
      ]);

      if (user && user.fcmToken && user.fcmToken !== null) {
        const payload = {
          token: user.fcmToken,
          data: {
            title: "🚀 Instant Bonus Activated! 🎁",
            body: "🎊 Hooray! You've unlocked a special welcome reward just for joining us. Enjoy your bonus! 💰",
            type: "LOGINBONUS",
          },
        };

        const adminPromise = await admin;
        adminPromise
          .messaging()
          .send(payload)
          .then((response) => {
            console.log("Successfully sent with response: ", response);
          })
          .catch((error) => {
            console.log("Error sending message: ", error);
          });
      }

      //✅ Send random messages from 4 hosts
      const [hosts, latestMessageDoc] = await Promise.all([
        Host.find({ video: { $ne: [] } })
          .sort({ createdAt: -1 })
          .limit(5),
        Message.findOne().sort({ createdAt: -1 }).lean(),
      ]);

      const fallbackMessages = [
        "Hey there! 👋",
        "How's your day going? 😊",
        "Wanna chat? 💬",
        "You look amazing today! ✨",
        "Let's talk! 💖",
        "Hope you're having a great time! 🌟",
        "What's your favorite movie? 🎬",
        "I’d love to get to know you better! 😄",
      ];

      for (const host of hosts) {
        const chatTopic = await ChatTopic.findOne({
          $or: [
            { senderId: host._id, receiverId: user._id },
            { senderId: user._id, receiverId: host._id },
          ],
        });

        const messages = latestMessageDoc?.message?.length > 0 ? latestMessageDoc.message : fallbackMessages;
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        const messageType = Math.random() < 0.5 ? 1 : 2;

        let imageUrl = "";
        if (messageType === 2) {
          const images = Array.isArray(host.image) ? host.image : [host.image];
          if (images.length > 0) {
            const index = Math.floor(Math.random() * images.length);
            imageUrl = images[index];
          }
        }

        let chat;
        if (chatTopic) {
          chat = new Chat({
            chatTopicId: chatTopic._id,
            senderId: host._id,
            messageType,
            message: messageType === 2 ? "📸 Image" : randomMessage,
            image: messageType === 2 ? imageUrl : "",
            date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
          });
          chatTopic.chatId = chat._id;
          await Promise.all([chat.save(), chatTopic.save()]);
        } else {
          const newChatTopic = new ChatTopic({
            senderId: host._id,
            receiverId: user._id,
          });

          chat = new Chat({
            chatTopicId: newChatTopic._id,
            senderId: host._id,
            messageType,
            message: messageType === 2 ? "📸 Image" : randomMessage,
            image: messageType === 2 ? imageUrl : "",
            date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
          });

          newChatTopic.chatId = chat._id;
          await Promise.all([newChatTopic.save(), chat.save()]);
        }

        if (user && user.fcmToken && user.fcmToken !== null) {
          const payload = {
            token: user.fcmToken,
            data: {
              title: `${host.name} sent you a message 📩`,
              body: `🗨️ ${chat.message}`,
              type: "CHAT",
              senderId: String(host._id),
              receiverId: String(user._id),
              userName: String(host.name),
              hostName: String(user.name),
              userImage: String(host.image || ""),
              hostImage: String(user.image || ""),
              isOnline: String(user?.isOnline ?? ""),
              senderRole: "host",
              isFakeSender: String(host.isFake || "false"),
              isFake: String(host.isFake),
            },
          };

          const adminInstance = await admin;
          adminInstance.messaging().send(payload).catch(console.error);
        }
      }
    }
  } catch (error) {
    if (error.code === 11000 && error?.keyPattern?.firebaseUid) {
      return res.status(200).json({
        status: false,
        message: "User already exists.",
      });
    }

    if (req.file) deleteFile(req.file);
    console.error("Error:", error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

//update profile of the user
exports.modifyUserProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    res.status(200).json({
      status: true,
      message: "The user's profile has been modified.",
    });

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const [user] = await Promise.all([User.findOne({ _id: userId })]);

    if (req?.file) {
      const image = user?.image?.split("storage");
      if (image) {
        const imagePath = "storage" + image[1];
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

      user.image = req?.file?.path;
    }

    user.name = req.body.name ? req.body.name : user?.name;
    user.email = req.body.email ? req.body.email : user?.email;
    user.mobileNumber = req.body.mobileNumber ? req.body.mobileNumber : user?.mobileNumber;
    user.countryCode = req.body.countryCode ? req.body.countryCode : user?.countryCode;
    user.selfIntro = req.body.selfIntro ? req.body.selfIntro : user?.selfIntro;
    user.gender = req.body.gender ? req.body.gender?.toLowerCase()?.trim() : user?.gender;
    user.bio = req.body.bio ? req.body.bio : user?.bio;
    user.dob = req.body.dob ? req.body.dob.trim() : user?.dob;
    user.age = req.body.age ? req.body.age : user?.age;
    user.countryFlagImage = req.body.countryFlagImage ? req.body.countryFlagImage : user?.countryFlagImage;
    user.country = req.body.country ? req.body.country.toLowerCase()?.trim() : user?.country;
    await user.save();
  } catch (error) {
    if (req.file) deleteFile(req.file);
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get user profile
exports.retrieveUserProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const [user, hostRequest] = await Promise.all([User.findOne({ _id: userId }).lean(), Host.findOne({ userId }).select("status").lean()]);

    const hasHostRequest = !!hostRequest;

    res.status(200).json({
      status: true,
      message: "The user has retrieved their profile.",
      user,
      hasHostRequest,
    });

    if (user.isVip && user.vipPlanId !== null && user.vipPlanStartDate !== null && user.vipPlanEndDate !== null) {
      const validity = user.vipPlan.validity;
      const validityType = user.vipPlan.validityType;
      validatePlanExpiration(user, validity, validityType);
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//delete user
exports.deactivateMyAccount = async (req, res) => {
  try {
    const userUid = req.headers["x-user-uid"];
    if (!userUid) {
      console.warn("⚠️ [AUTH] User UID.");
      return res.status(401).json({ status: false, message: "User UID required for authentication." });
    }

    const user = await User.findOne({ firebaseUid: userUid }).lean();
    if (!user) {
      return res.status(200).json({ status: false, message: "User not found." });
    }

    res.status(200).json({
      status: true,
      message: "User and related data successfully deleted.",
    });

    const host = await Host.findOne({ userId: user?._id }).select("_id image photoGallery video liveVideo profileVideo identityProof").lean();

    if (host) {
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
        WithdrawalRequest.deleteMany({ hostId: host._id }),
        Report.deleteMany({
          $or: [
            { targetId: host?._id, targetRole: "host" },
            { reporterId: host?._id, reporterRole: "host" },
          ],
        }),
        LiveBroadcastHistory.deleteMany({ hostId: host?._id }),
        Block.deleteMany({ hostId: host?._id }),
        FollowerFollowing.deleteMany({ followingId: host?._id }),
        History.deleteMany({ hostId: host?._id }),
        HostMatchHistory.deleteMany({ $or: [{ lastHostId: host?._id }, { hostId: host?._id }] }),
        LiveBroadcaster.deleteMany({ hostId: host?._id }),
      ]);

      await Host.deleteOne({ _id: host?._id });
    }

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

    const [chats] = await Promise.all([Chat.find({ senderId: user?._id })]);

    for (const chat of chats) {
      deleteFileIfExists(chat?.image);
      deleteFileIfExists(chat?.audio);
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
      FollowerFollowing.deleteMany({ followerId: user?._id }),
      Report.deleteMany({
        $or: [
          { targetId: user?._id, targetRole: "user" },
          { reporterId: user?._id, reporterRole: "user" },
        ],
      }),
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

    await User.deleteOne({ _id: user._id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get firebase UID using Device UUID
exports.fetchFirebaseUidByDevice = async (req, res) => {
  try {
    const { deviceUuid, loginType } = req.query;

    if (!deviceUuid) {
      return res.status(200).json({
        status: false,
        message: "Device UUID is required.",
      });
    }

    if (!loginType) {
      return res.status(200).json({
        status: false,
        message: "Login type is required.",
      });
    }

    const user = await User.findOne({ identity: deviceUuid.trim(), loginType: Number(loginType) }, { firebaseUid: 1 }).lean();

    if (!user || !user.firebaseUid) {
      return res.status(404).json({
        status: false,
        message: "Firebase UID not found for this device.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Firebase UID fetched successfully.",
      firebaseUid: user.firebaseUid,
    });
  } catch (error) {
    console.error("Fetch Firebase UID Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Internal Server Error",
    });
  }
};

//create firebase Custom Token using Firebase UID
exports.createFirebaseCustomAuthToken = async (req, res) => {
  try {
    const { firebaseUid } = req.query;

    if (!firebaseUid) {
      return res.status(200).json({
        status: false,
        message: "Firebase UID is required.",
      });
    }

    const firebaseAdmin = await admin;
    const customToken = await firebaseAdmin.auth().createCustomToken(firebaseUid);

    return res.status(200).json({
      status: true,
      message: "Firebase custom auth token created successfully.",
      customToken,
    });
  } catch (error) {
    console.error("Create Custom Token Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Failed to create Firebase custom auth token.",
    });
  }
};

//sync user loginType using firebaseUid
exports.syncUserAuthTypeByUid = async (req, res) => {
  try {
    const { firebaseUid, loginType } = req.query;

    if (!firebaseUid || loginType === undefined) {
      return res.status(200).json({ status: false, message: "firebaseUid and loginType are required." });
    }

    const parsedLoginType = Number(loginType);

    if (isNaN(parsedLoginType)) {
      return res.status(200).json({ status: false, message: "Invalid loginType." });
    }

    const user = await User.findOneAndUpdate({ firebaseUid: firebaseUid.trim() }, { $addToSet: { loginType: parsedLoginType } }, { new: true });

    if (!user) {
      return res.status(200).json({ status: true, message: "User not found. Please sign up.", isLogin: false });
    }

    if (!Array.isArray(user.loginType)) {
      user.loginType = user.loginType !== undefined ? [user.loginType] : [];
    }

    return res.status(200).json({
      status: true,
      message: "User exists.",
      isLogin: true,
      data: {
        userId: user._id,
        firebaseUid: user.firebaseUid,
        loginType: user.loginType,
      },
    });
  } catch (error) {
    console.error("syncUserLoginTypeByFirebaseUid error:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//check if mobile or email exists or not
exports.verifyMobileOrEmail = async (req, res) => {
  try {
    const { mobile, email } = req.body || {};

    if (!mobile && !email) {
      return res.status(200).json({ status: false, message: "Mobile or email is required" });
    }

    const user = await User.findOne({ $or: [mobile ? { mobileNumber: mobile } : null, email ? { email } : null].filter(Boolean) }).select("email mobileNumber loginType");

    if (!user) {
      return res.status(200).json({
        status: true,
        message: "Mobile or email does not exist",
        isExists: false,
      });
    }

    const loginType = user.loginType || null;

    if (email && user.email === email) {
      return res.status(200).json({
        status: true,
        message: "Email already exists",
        isExists: true,
        loginType,
      });
    }

    if (mobile && user.mobileNumber === mobile) {
      return res.status(200).json({
        status: true,
        message: "Mobile number already exists",
        isExists: true,
        loginType,
      });
    }

    return res.status(200).json({
      status: true,
      message: "Mobile or email does not exist",
      isExists: false,
    });
  } catch (error) {
    console.error("Check Mobile Or Email Exists Error:", error);
    return res.status(500).json({ status: false, message: "Failed to check mobile or email", error: error.message });
  }
};
