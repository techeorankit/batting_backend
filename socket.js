///import model
const User = require("./models/user.model");
const Host = require("./models/host.model");
const ChatTopic = require("./models/chatTopic.model");
const Chat = require("./models/chat.model");
const History = require("./models/history.model");
const Gift = require("./models/gift.model");
const Privatecall = require("./models/privatecall.model");

//generateHistoryUniqueId
const generateHistoryUniqueId = require("./util/generateHistoryUniqueId");

//private key
const admin = require("./util/privateKey");

//mongoose
const mongoose = require("mongoose");

//moment
const moment = require("moment");

//agora-access-token
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");

io.on("connection", async (socket) => {
  console.log("Socket Connection done Client ID: ", socket.id);

  const { globalRoom } = socket.handshake.query;
  const id = globalRoom.split(":")[1];

  if (globalRoom) {
    console.log("Socket connected with:", id);

    //check if the socket is already in the room
    if (!socket.rooms.has(globalRoom)) {
      socket.join(globalRoom);
      console.log(`Socket joined room: ${globalRoom}`);
    } else {
      console.log(`Socket is already in room: ${globalRoom}`);
    }

    const user = await User.findById(id).select("_id isOnline").lean();

    if (user) {
      await User.findByIdAndUpdate(user._id, { $set: { isOnline: true } }, { new: true });
    }
  }

  //chat
  socket.on("chatMessageSent", async (data) => {
    const parseData = JSON.parse(data);
    console.log("🔹 Data in chatMessageSent:", parseData);

    let senderPromise, receiverPromise;

    if (parseData?.senderRole === "user") {
      senderPromise = User.findById(parseData?.senderId).lean().select("_id name coin");
    } else if (parseData?.senderRole === "host") {
      senderPromise = Host.findById(parseData?.senderId).lean().select("_id name coin");
    }

    if (parseData?.receiverRole === "host") {
      receiverPromise = Host.findById(parseData?.receiverId).lean().select("_id fcmToken isBlock coin chatRate");
    } else if (parseData?.receiverRole === "user") {
      receiverPromise = User.findById(parseData?.receiverId).lean().select("_id fcmToken isBlock coin");
    }

    const chatTopicPromise = ChatTopic.findById(parseData?.chatTopicId).lean().select("_id senderId receiverId chatId freeMessageCount");

    const [uniqueId, sender, receiver, chatTopic] = await Promise.all([generateHistoryUniqueId(), senderPromise, receiverPromise, chatTopicPromise]);

    if (!chatTopic) {
      console.log("❌ Chat topic not found");
      return;
    }

    if (parseData?.messageType == 1) {
      if (parseData.senderRole === "user" && parseData.receiverRole === "host") {
        const maxFreeChatMessages = settingJSON.maxFreeChatMessages || 10;
        const isWithinFreeLimit = chatTopic.freeMessageCount < maxFreeChatMessages;
        const chatRate = receiver.chatRate || 10;

        if (!isWithinFreeLimit && sender?.coin < chatRate) {
          console.log("❌ Insufficient coins, message not sent.");
          io.in("globalRoom:" + chatTopic?.senderId?.toString()).emit("insufficientCoins", "Insufficient coins to send message.");
          return;
        }
      }

      const chat = new Chat({
        messageType: parseData?.messageType,
        senderId: parseData?.senderId,
        message: parseData?.message,
        image: parseData?.image || "",
        chatTopicId: chatTopic._id,
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      });

      await Promise.all([
        chat.save(),
        ChatTopic.updateOne(
          { _id: chatTopic._id },
          {
            $set: { chatId: chat._id },
            $inc: { freeMessageCount: 1 },
          }
        ),
      ]);

      const eventData = {
        data,
        messageId: chat._id.toString(),
      };

      io.in("globalRoom:" + chatTopic?.senderId?.toString()).emit("chatMessageSent", eventData);
      io.in("globalRoom:" + chatTopic?.receiverId?.toString()).emit("chatMessageSent", eventData);

      if (parseData.senderRole === "user" && parseData.receiverRole === "host") {
        const maxFreeChatMessages = settingJSON.maxFreeChatMessages || 10;
        const adminCommissionRate = settingJSON.adminCommissionRate || 10;
        const isWithinFreeLimit = chatTopic.freeMessageCount < maxFreeChatMessages;
        const chatRate = receiver.chatRate || 10;

        let deductedCoins = 0;
        let adminShare = 0;
        let hostEarnings = 0;

        if (!isWithinFreeLimit && sender.coin >= chatRate) {
          deductedCoins = chatRate;
          adminShare = (chatRate * adminCommissionRate) / 100;
          hostEarnings = chatRate - adminShare;

          await Promise.all([
            User.updateOne({ _id: sender._id, coin: { $gte: deductedCoins } }, { $inc: { coin: -deductedCoins, spentCoins: deductedCoins } }),
            Host.updateOne({ _id: receiver._id }, { $inc: { coin: hostEarnings } }),
            History.create({
              uniqueId: uniqueId,
              type: 9,
              userId: sender._id,
              hostId: receiver._id,
              userCoin: chatRate,
              hostCoin: hostEarnings,
              adminCoin: adminShare,
              date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
            }),
          ]);

          console.log(`💰 Coins Deducted: ${deductedCoins} | Admin: ${adminShare} | Host Earnings: ${hostEarnings}`);
        }
      }

      if (receiver && !receiver.isBlock && receiver.fcmToken) {
        const payload = {
          token: receiver.fcmToken,
          notification: {
            title: `${sender?.name} sent you a message 💌`,
            body: `🗨️ ${chat?.message}`,
          },
          data: {
            type: "CHAT",
          },
        };

        try {
          const adminInstance = await admin;
          const response = await adminInstance.messaging().send(payload);
          console.log("Successfully sent FCM notification: ", response);
        } catch (error) {
          console.log("Error sending FCM message:", error);
        }
      }
    } else {
      console.log("ℹ️ Other message type received");

      const eventData = {
        data,
        messageId: parseData?.messageId?.toString() || "",
      };

      io.in("globalRoom:" + chatTopic?.senderId?.toString()).emit("chatMessageSent", eventData);
      io.in("globalRoom:" + chatTopic?.receiverId?.toString()).emit("chatMessageSent", eventData);
    }
  });

  socket.on("chatGiftSent", async (data) => {
    const parseData = JSON.parse(data);
    console.log("🎁 Data in chatGiftSent:", parseData);

    let senderPromise, receiverPromise;

    if (parseData?.senderRole === "user") {
      senderPromise = User.findById(parseData?.senderId).lean().select("_id name coin");
    } else if (parseData?.senderRole === "host") {
      senderPromise = Host.findById(parseData?.senderId).lean().select("_id name coin");
    }

    if (parseData?.receiverRole === "host") {
      receiverPromise = Host.findById(parseData?.receiverId).lean().select("_id fcmToken isBlock coin");
    } else if (parseData?.receiverRole === "user") {
      receiverPromise = User.findById(parseData?.receiverId).lean().select("_id fcmToken isBlock coin");
    }

    const chatTopicPromise = ChatTopic.findById(parseData?.chatTopicId).lean().select("_id senderId receiverId chatId");
    const giftPromise = Gift.findById(parseData?.giftId).lean().select("_id coin image");

    const [uniqueId, sender, receiver, chatTopic, gift] = await Promise.all([generateHistoryUniqueId(), senderPromise, receiverPromise, chatTopicPromise, giftPromise]);

    if (!chatTopic) {
      console.log("❌ Chat topic not found");
      return;
    }

    if (!gift) {
      console.log("❌ Gift not found");
      return;
    }

    const giftPrice = gift?.coin || 0;
    const giftCount = parseData?.giftCount || 1;
    const totalGiftCost = giftPrice * giftCount;
    const adminCommissionRate = settingJSON.adminCommissionRate || 10;

    if (sender?.coin < totalGiftCost) {
      console.log("❌ Insufficient coins, gift not sent.");
      io.in("globalRoom:" + chatTopic?.senderId?.toString()).emit("insufficientCoins", "Insufficient coins to send gift.");
      return;
    }

    const chat = new Chat({
      messageType: 4,
      message: `🎁 ${sender.name} sent a gift`,
      image: gift.image || "",
      senderId: sender._id,
      chatTopicId: chatTopic._id,
      giftCount: giftCount,
      date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    });

    await Promise.all([
      chat.save(),
      ChatTopic.updateOne(
        { _id: chatTopic._id },
        {
          $set: { chatId: chat._id },
        }
      ),
    ]);

    const eventData = {
      data,
      messageId: chat._id.toString(),
    };

    io.in("globalRoom:" + chatTopic?.senderId?.toString()).emit("chatGiftSent", eventData);
    io.in("globalRoom:" + chatTopic?.receiverId?.toString()).emit("chatGiftSent", eventData);

    let adminShare = (totalGiftCost * adminCommissionRate) / 100;
    let hostEarnings = totalGiftCost - adminShare;

    await Promise.all([
      User.updateOne({ _id: sender._id, coin: { $gte: totalGiftCost } }, { $inc: { coin: -totalGiftCost, spentCoins: totalGiftCost } }),
      Host.updateOne({ _id: receiver._id }, { $inc: { coin: hostEarnings, totalGifts: 1 } }),
      History.create({
        uniqueId: uniqueId,
        type: 10,
        userId: sender._id,
        hostId: receiver._id,
        giftId: gift._id,
        giftCount: giftCount,
        userCoin: totalGiftCost,
        hostCoin: hostEarnings,
        adminCoin: adminShare,
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      }),
    ]);

    console.log(`💰 Gift Sent | Cost: ${totalGiftCost} | Admin Share: ${adminShare} | Host Earnings: ${hostEarnings}`);

    if (receiver && !receiver.isBlock && receiver.fcmToken) {
      const payload = {
        token: receiver.fcmToken,
        notification: {
          title: `${sender.name} sent you a gift 🎁`,
          body: `💝 You received ${giftCount} gifts worth ${totalGiftCost} coins!`,
        },
        data: {
          type: "GIFT",
          giftCount: giftCount.toString(),
        },
      };

      try {
        const adminInstance = await admin;
        const response = await adminInstance.messaging().send(payload);
        console.log("✅ Successfully sent FCM notification for gift:", response);
      } catch (error) {
        console.log("❌ Error sending FCM message:", error);
      }
    }
  });

  socket.on("chatMessageSeen", async (data) => {
    try {
      const parsedData = JSON.parse(data);
      console.log("🔹 Data in chatMessageSeen event:", parsedData.messageId);

      const updated = await Chat.findByIdAndUpdate(parsedData.messageId, { $set: { isRead: true } }, { new: true, lean: true, select: "_id isRead" });

      if (!updated) {
        console.log(`No message found with ID ${parsedData.messageId}`);
      } else {
        console.log(`Updated isRead to true for message with ID: ${updated._id}`);
      }
    } catch (error) {
      console.error("Error updating chatMessageSeen:", error);
    }
  });

  //private video call
  socket.on("callRinging", async (data) => {
    console.log("callRinging request received:", data);

    const parsedData = JSON.parse(data);
    const { callerId, receiverId, agoraUID, channel, callType } = parsedData;

    const role = RtcRole.PUBLISHER;
    const uid = agoraUID ? agoraUID : 0;
    const expirationTimeInSeconds = 24 * 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const [token, callUniqueId, caller, receiver] = await Promise.all([
      RtcTokenBuilder.buildTokenWithUid("6eb91188adba4d819d61f4af0ffcec8b", "1fe5878a76fe439d94fabe415c64e20c", channel, uid, role, privilegeExpiredTs),
      generateHistoryUniqueId(),
      User.findById(callerId).select("_id name image isBlock isBusy callId isOnline").lean(),
      Host.findById(receiverId).select("_id name image isBlock isBusy callId isOnline").lean(),
    ]);

    if (!caller) {
      io.in("globalRoom:" + caller._id.toString()).emit("callRinging", { message: "Caller does not found." });
      return;
    }

    if (caller.isBlock) {
      io.in("globalRoom:" + caller._id.toString()).emit("callRinging", {
        message: "Caller is blocked.",
        isBlock: true,
      });
      return;
    }

    if (caller.isBusy && caller.callId) {
      io.in("globalRoom:" + caller._id.toString()).emit("callRinging", {
        message: "Caller is busy with someone else.",
        isBusy: true,
      });
      return;
    }

    if (!receiver) {
      io.in("globalRoom:" + caller._id.toString()).emit("callRinging", { message: "Receiver does not found." });
      return;
    }

    if (receiver.isBlock) {
      io.in("globalRoom:" + caller._id.toString()).emit("callRinging", {
        message: "Receiver is blocked.",
        isBlock: true,
      });
      return;
    }

    if (!receiver.isOnline) {
      io.in("globalRoom:" + caller._id.toString()).emit("callRinging", {
        message: "Receiver is not online.",
        isOnline: false,
      });
      return;
    }

    if (receiver.isBusy && receiver.callId) {
      io.in("globalRoom:" + caller._id.toString()).emit("callRinging", {
        message: "Receiver is busy with another call.",
        isBusy: true,
      });
      return;
    }

    if (!receiver.isBusy && receiver.callId === null) {
      console.log("Receiver and Caller are free. Proceeding with call setup.");

      const callHistory = new History();
      callHistory.callId = callUniqueId;

      const [callerVerify, receiverVerify] = await Promise.all([
        User.updateOne(
          {
            _id: caller._id,
            isFake: false,
            isLive: false,
            isOnline: true,
            isBusy: false,
            callId: null,
          },
          {
            $set: {
              isBusy: true,
              callId: callHistory._id.toString(),
            },
          }
        ),
        Host.updateOne(
          {
            _id: receiver._id,
            isFake: false,
            isLive: false,
            isOnline: true,
            isBusy: false,
            callId: null,
          },
          {
            $set: {
              isBusy: true,
              callId: callHistory._id.toString(),
            },
          }
        ),
      ]);

      if (callerVerify.modifiedCount > 0 && receiverVerify.modifiedCount > 0) {
        const dataOfVideoCall = {
          callType: callType,
          callerId: caller._id,
          receiverId: receiver._id,
          callerImage: caller.image,
          callerName: caller.name,
          receiverName: receiver.name,
          receiverImage: receiver.image,
          callId: callHistory._id,
          callType: callType.trim().toLowerCase(),
          callMode: "private",
          token,
          channel,
        };

        io.in("globalRoom:" + receiver._id.toString()).emit("callIncoming", dataOfVideoCall); // Notify receiver
        io.in("globalRoom:" + caller._id.toString()).emit("callConnected", dataOfVideoCall); // Notify caller

        console.log(`Call successfully initiated: ${caller.name} → ${receiver.name}`);

        callHistory.callType = callType?.trim()?.toLowerCase();
        callHistory.isPrivate = true;
        callHistory.userId = caller._id;
        callHistory.hostId = receiver._id;
        callHistory.callStartTime = moment(new Date()).format("HH:mm:ss");
        callHistory.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

        await Promise.all([
          callHistory.save(),
          Privatecall({
            caller: caller._id,
            receiver: receiver._id,
          }).save(),
        ]);
      } else {
        console.log("Failed to verify caller or receiver availability");

        io.in("globalRoom:" + caller._id.toString()).emit("callRinging", {
          message: "Call setup failed. One or both users became unavailable.",
          isBusy: true,
        });

        // Update isBusy only for the user who failed verification
        if (callerVerify.modifiedCount > 0) {
          await User.updateOne({ _id: callerId, isBusy: true }, { $set: { isBusy: false, callId: null } });
          console.log(`🔹 Caller Status Updated: Caller verification failed, isBusy reset`);
        }

        if (receiverVerify.modifiedCount > 0) {
          await User.updateOne({ _id: receiverId, isBusy: true }, { $set: { isBusy: false, callId: null } });
          console.log(`🔹 Receiver Status Updated: Receiver verification failed, isBusy reset`);
        }
        return;
      }
    } else {
      console.log("Condition not met - receiver not available");

      io.in("globalRoom:" + caller._id.toString()).emit("callRinging", {
        message: "Receiver is unavailable for a call at this moment.",
        isBusy: true,
      });
      return;
    }
  });

  socket.on("callResponseHandled", async (data) => {
    console.log("🟢 [callResponseHandled] Event received:", data);

    try {
      const parsedData = JSON.parse(data);
      const { callerId, receiverId, callId, isAccept, callType, callMode } = parsedData;

      const callerRoom = `globalRoom:${callerId}`;
      const receiverRoom = `globalRoom:${receiverId}`;

      console.log(`🔄 Fetching caller, receiver, and call history for callId: ${callId}`);

      const [caller, receiver, callHistory] = await Promise.all([
        User.findById(callerId).select("_id name isBusy callId").lean(),
        Host.findById(receiverId).select("_id name isBusy callId").lean(),
        History.findById(callId).select("_id callConnect callEndTime duration"),
      ]);

      if (!caller || !receiver || !callHistory) {
        console.error("❌ [callResponseHandled] Invalid caller, receiver, or call history.");
        return io.to(callerRoom).emit("callProcessFailed", { message: "Invalid call data." });
      }

      console.log(`✅ Caller: ${caller.name} | Receiver: ${receiver.name} | Call ID: ${callId}`);

      if (callMode.trim().toLowerCase() === "private") {
        if (!isAccept && caller.callId?.toString() === callId.toString()) {
          console.log(`📵 [callResponseHandled] Call rejected by receiver ${receiver.name}`);

          io.to(callerRoom).emit("callRejected", data);

          const [callerUpdate, receiverUpdate, privateCallDeleted] = await Promise.all([
            User.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
            Host.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
            Privatecall.deleteOne({ caller: caller._id, receiver: receiver._id }),
          ]);

          console.log(`🔹 Caller Status Updated:`, callerUpdate);
          console.log(`🔹 Receiver Status Updated:`, receiverUpdate);
          console.log(`🔹 Private Call Deleted:`, privateCallDeleted);

          let chatTopic;
          chatTopic = await ChatTopic.findOne({
            $or: [
              {
                $and: [{ senderId: caller._id }, { receiverId: receiver._id }],
              },
              {
                $and: [{ senderId: receiver._id }, { receiverId: caller._id }],
              },
            ],
          });

          const chat = new Chat();

          if (!chatTopic) {
            chatTopic = new ChatTopic();

            chatTopic.chatId = chat._id;
            chatTopic.senderId = caller._id;
            chatTopic.receiverId = receiver._id;
          }

          chat.chatTopicId = chatTopic._id;
          chat.senderId = callerId;
          chat.messageType = callType.trim().toLowerCase() === "audio" ? 5 : 6;
          chat.message = callType.trim().toLowerCase() === "audio" ? "📞 Audio Call" : "📽 Video Call";
          chat.callType = 2; // 2.declined
          chat.callId = callId;
          chat.isRead = true;
          chat.date = new Date().toLocaleString();

          chatTopic.chatId = chat._id;

          callHistory.callConnect = false;
          callHistory.callEndTime = moment().format("HH:mm:ss");
          callHistory.duration = moment.utc(moment(callHistory.callEndTime, "HH:mm:ss").diff(moment(callHistory.callStartTime, "HH:mm:ss"))).format("HH:mm:ss");

          await Promise.all([chat.save(), chatTopic.save(), callHistory?.save()]);
          console.log("✅ Call rejection chat & history saved.");
          return;
        }

        if (isAccept && caller.callId?.toString() === callId.toString()) {
          console.log(`📞 [callResponseHandled] Call accepted by receiver ${receiver.name}`);

          const privateCallDelete = await Privatecall.deleteOne({
            caller: new mongoose.Types.ObjectId(caller._id),
            receiver: new mongoose.Types.ObjectId(receiver._id),
          });

          console.log("🗑 Private call entry deleted:", privateCallDelete);

          if (privateCallDelete?.deletedCount > 0) {
            console.log("🟢 Call accepted, emitting event...");

            const [callerSockets, receiverSockets] = await Promise.all([io.in(callerRoom).fetchSockets(), io.in(receiverRoom).fetchSockets()]);

            const callerSocket = callerSockets?.[0];
            const receiverSocket = receiverSockets?.[0];

            if (callerSocket && !callerSocket.rooms.has(callId)) {
              callerSocket.join(callId);
            }

            if (receiverSocket && !receiverSocket.rooms.has(callId)) {
              receiverSocket.join(callId);
            }

            io.to(callId.toString()).emit("callAnswerReceived", data);

            console.log(`📡 [callAnswerReceived] Event sent to both parties: Caller(${caller.name}) & Receiver(${receiver.name})`);

            let chatTopic;
            chatTopic = await ChatTopic.findOne({
              $or: [
                {
                  $and: [{ senderId: caller._id }, { receiverId: receiver._id }],
                },
                {
                  $and: [{ senderId: receiver._id }, { receiverId: caller._id }],
                },
              ],
            });

            const chat = new Chat();

            if (!chatTopic) {
              chatTopic = new ChatTopic();

              chatTopic.chatId = chat._id;
              chatTopic.senderId = caller._id;
              chatTopic.receiverId = receiver._id;
            }

            chat.chatTopicId = chatTopic._id;
            chat.senderId = callerId;
            chat.messageType = callType.trim().toLowerCase() === "audio" ? 5 : 6;
            chat.message = callType.trim().toLowerCase() === "audio" ? "📞 Audio Call" : "📽 Video Call";
            chat.callType = 1; //1.received
            chat.callId = callId;
            chat.date = new Date().toLocaleString();

            chatTopic.chatId = chat._id;

            await Promise.all([
              chat?.save(),
              chatTopic?.save(),
              User.updateOne({ _id: caller._id }, { $set: { isBusy: true, callId: callId } }),
              Host.updateOne({ _id: receiver._id }, { $set: { isBusy: true, callId: callId } }),
              History.updateOne({ _id: callHistory._id }, { $set: { callConnect: true, callStartTime: moment().format("HH:mm:ss") } }),
            ]);

            console.log("✅ Caller and Receiver status updated & call history saved.");
          } else {
            console.log(`🚨 Call disconnected`);

            io.to(receiverRoom).emit("callAutoEnded", data);

            await Promise.all([
              User.updateOne({ _id: caller._id, isBusy: true }, { $set: { isBusy: false, callId: null } }),
              Host.updateOne({ _id: receiver._id, isBusy: true }, { $set: { isBusy: false, callId: null } }),
            ]);

            console.log("🔹 Caller & Receiver status reset.");
          }
        }
      }
    } catch (error) {
      console.error("❌ [callResponseHandled] Error:", error);
      io.to(`globalRoom:${socket.id}`).emit("callProcessFailed", { message: "Server error. Please try again." });
    }
  });

  socket.on("callCancelled", async (data) => {
    console.log("🟢 [callCancelled] Event received:", data);

    const parseData = JSON.parse(data);
    const { callerId, receiverId, callId, callType, callMode } = parseData;

    console.log(`🔄 Fetching call details for callId: ${callId}`);

    const [caller, receiver, callHistory] = await Promise.all([
      User.findById(callerId).select("_id name fcmToken isBlock").lean(),
      Host.findById(receiverId).select("_id name fcmToken isBlock").lean(),
      History.findById(callId).select("_id userId callConnect duration callEndTime"),
    ]);

    if (!caller || !receiver || !callHistory) {
      console.error("❌ [callCancelled] Invalid caller, receiver, or call history.");
      return io.to(`globalRoom:${callerId}`).emit("callCancelFailed", { message: "Invalid call data." });
    }

    io.to("globalRoom:" + callerId).emit("callFinished", data);
    io.to("globalRoom:" + receiverId).emit("callFinished", data);

    console.log(`✅ Caller: ${caller.name} | Receiver: ${receiver.name} | Call ID: ${callId}`);

    if (callMode.trim().toLowerCase() === "private") {
      const [callerUpdate, receiverUpdate, privateCallDeleted] = await Promise.all([
        User.updateOne({ _id: caller._id }, { $set: { isBusy: false, callId: null } }),
        Host.updateOne({ _id: receiver._id }, { $set: { isBusy: false, callId: null } }),
        Privatecall.deleteOne({ caller: caller._id, receiver: receiver._id }),
      ]);

      console.log(`🔹 Caller Status Updated:`, callerUpdate);
      console.log(`🔹 Receiver Status Updated:`, receiverUpdate);
      console.log(`🔹 Private Call Deleted:`, privateCallDeleted);
    }

    callHistory.callEndTime = moment().format("HH:mm:ss");
    const duration = moment.utc(moment(callHistory.callEndTime, "HH:mm:ss").diff(moment(callHistory.callStartTime, "HH:mm:ss"))).format("HH:mm:ss");

    callHistory.callConnect = false;
    callHistory.duration = duration;

    let chatTopic;
    chatTopic = await ChatTopic.findOne({
      $or: [
        {
          $and: [{ senderId: caller._id }, { receiverId: receiver._id }],
        },
        {
          $and: [{ senderId: receiver._id }, { receiverId: caller._id }],
        },
      ],
    });

    const chat = new Chat();

    if (!chatTopic) {
      chatTopic = new ChatTopic();

      chatTopic.chatId = chat._id;
      chatTopic.senderId = caller._id;
      chatTopic.receiverId = receiver._id;
      await chatTopic.save();
    }

    chat.chatTopicId = chatTopic._id;
    chat.callId = callHistory?._id;
    chat.senderId = callHistory?.userId;
    chat.messageType = callType.trim().toLowerCase() === "audio" ? 5 : 6;
    chat.message = callType.trim().toLowerCase() === "audio" ? "📞 Audio Call" : "📽 Video Call";
    chat.callType = 3; //3.missedCall
    chat.date = new Date().toLocaleString();
    chat.isRead = true;

    chatTopic.chatId = chat._id;

    await Promise.all([chat?.save(), chatTopic?.save(), callHistory?.save()]);

    if (!receiver.isBlock && receiver.fcmToken !== null) {
      const payload = {
        token: receiver.fcmToken,
        notification: {
          title: "Missed Call 📞",
          body: "You missed a call. Tap to call back!",
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
          console.log("Error sending message:      ", error);
        });
    }
  });

  socket.on("callDisconnected", async (data) => {
    console.log("[endCallSession]", "data in callDisconnected:", data);

    const parseData = JSON.parse(data);
    const { callerId, receiverId, callId, callType, callMode } = parseData;

    const [caller, receiver, callHistory] = await Promise.all([
      User.findById(callerId).select("_id name").lean(),
      Host.findById(receiverId).select("_id name").lean(),
      History.findById(callId).select("_id callStartTime callEndTime callConnect duration"),
    ]);

    if (!caller || !receiver || !callHistory) {
      console.error("❌ [endCallSession] Invalid caller, receiver, or call history.");
      return io.to(`globalRoom:${callerId}`).emit("callTerminationFailed", { message: "Invalid call data." });
    }

    io.to(callId.toString()).emit("callDisconnected", data);
    io.socketsLeave(callId.toString());

    console.log(`✅ Caller: ${caller.name} | Receiver: ${receiver.name} | Call ID: ${callId}`);

    if (callMode.trim().toLowerCase() === "private") {
      const [callerUpdate, receiverUpdate, privateCallDeleted] = await Promise.all([
        User.updateOne({ _id: callerId }, { $set: { isBusy: false, callId: null } }),
        Host.updateOne({ _id: receiverId }, { $set: { isBusy: false, callId: null } }),
        Privatecall.deleteOne({ caller: callerId, receiver: receiverId }),
      ]);

      console.log(`🔹 Caller Status Updated:`, callerUpdate);
      console.log(`🔹 Receiver Status Updated:`, receiverUpdate);
      console.log(`🔹 Private Call Deleted:`, privateCallDeleted);
    }

    callHistory.callEndTime = moment().format("HH:mm:ss");
    const duration = moment.utc(moment(callHistory.callEndTime, "HH:mm:ss").diff(moment(callHistory.callStartTime, "HH:mm:ss"))).format("HH:mm:ss");

    callHistory.callConnect = false;
    callHistory.duration = duration;

    await Promise.all([
      Chat.findOneAndUpdate(
        { callId: callHistory._id },
        {
          $set: {
            callDuration: duration,
            messageType: callType.trim().toLowerCase() === "audio" ? 5 : 6,
            message: callType.trim().toLowerCase() === "audio" ? "📞 Audio Call" : "📽 Video Call",
            callType: 1, // 1 = Received Call
            isRead: true,
          },
        },
        { new: true }
      ),
      callHistory.save(),
    ]);
  });

  socket.on("callCoinCharged", async (data) => {
    console.log("[callCoinCharged] Event Received:", data);

    try {
      const parsedData = JSON.parse(data);
      console.log("[callCoinCharged] Parsed Data:", parsedData);

      const { callerId, receiverId, callId, callType, callMode } = parsedData;

      const [uniqueId, caller, receiver, callHistory] = await Promise.all([
        generateHistoryUniqueId(),
        User.findById(callerId).select("_id coin").lean(),
        Host.findById(receiverId).select("_id coin privateCallRate audioCallRate").lean(),
        History.findById(callId).select("_id callType isPrivate").lean(),
      ]);

      if (!caller || !receiver || !callHistory) {
        console.log("[callCoinCharged] Caller, Receiver, or CallHistory not found!");
        return;
      }

      if (callMode === "private" && callHistory.callType === "video" && callHistory.isPrivate) {
        const privateCallCharge = Math.abs(receiver.privateCallRate) || 100;
        const adminCommissionRate = settingJSON?.adminCommissionRate || 10;

        const adminShare = Math.floor((privateCallCharge * adminCommissionRate) / 100);
        const hostEarnings = privateCallCharge - adminShare;

        if (caller.coin >= privateCallCharge) {
          console.log(`[callCoinCharged] Deducting ${privateCallCharge} coins from Caller: ${caller._id}, Admin Share: ${adminShare}, Host Earnings: ${hostEarnings}`);

          await Promise.all([
            User.updateOne({ _id: caller._id, coin: { $gte: privateCallCharge } }, { $inc: { coin: -privateCallCharge } }),
            Host.updateOne({ _id: receiver._id }, { $inc: { coin: hostEarnings } }),
            CallHistory.updateOne({ _id: callHistory._id }, { $inc: { coin: privateCallCharge } }),
            History.updateOne(
              { callId: callHistory._id },
              {
                $setOnInsert: {
                  userId: caller._id,
                  hostId: receiver._id,
                  callId: callHistory._id,
                  uniqueId: uniqueId,
                  type: 13,
                  date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
                },
                $set: {
                  userCoin: privateCallCharge,
                  hostCoin: hostEarnings,
                  adminCoin: adminShare,
                },
              },
              { upsert: true }
            ),
          ]);

          console.log("[callCoinCharged] Coin deduction and history update successful.");
        } else {
          console.log(`[callCoinCharged] Insufficient Coins for Caller: ${caller._id}`);
          io.in("globalRoom:" + caller._id.toString()).emit("insufficientCoins", "You don't have sufficient coins.");
        }
      }

      if (callMode === "private" && callHistory.callType === "audio") {
        const audioCallCharge = Math.abs(receiver.audioCallRate) || 100;
        const adminCommissionRate = settingJSON?.adminCommissionRate || 10;

        const adminShare = Math.floor((audioCallCharge * adminCommissionRate) / 100);
        const hostEarnings = audioCallCharge - adminShare;

        if (caller.coin >= audioCallCharge) {
          console.log(`[callCoinCharged] Deducting ${audioCallCharge} coins from Caller: ${caller._id}, Admin Share: ${adminShare}, Host Earnings: ${hostEarnings}`);

          await Promise.all([
            User.updateOne({ _id: caller._id, coin: { $gte: audioCallCharge } }, { $inc: { coin: -audioCallCharge } }),
            Host.updateOne({ _id: receiver._id }, { $inc: { coin: hostEarnings } }),
            CallHistory.updateOne({ _id: callHistory._id }, { $inc: { coin: audioCallCharge } }),
            History.updateOne(
              { callId: callHistory._id },
              {
                $setOnInsert: {
                  userId: caller._id,
                  hostId: receiver._id,
                  callId: callHistory._id,
                  uniqueId: uniqueId,
                  type: 12,
                  date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
                },
                $set: {
                  userCoin: audioCallCharge,
                  hostCoin: hostEarnings,
                  adminCoin: adminShare,
                },
              },
              { upsert: true }
            ),
          ]);

          console.log("[callCoinCharged] Coin deduction and history update successful.");
        } else {
          console.log(`[callCoinCharged] Insufficient Coins for Caller: ${caller._id}`);
          io.in("globalRoom:" + caller._id.toString()).emit("insufficientCoins", "You don't have sufficient coins.");
        }
      }
    } catch (error) {
      console.error("[callCoinCharged] Error:", error);
    }
  });

  //random video call

  //live-streaming
  socket.on("joinLiveRoom", async (data) => {
    const parsedData = JSON.parse(data);
    console.log("joinLiveRoom connected : ", parsedData);

    const sockets = await io.in(globalRoom).fetchSockets();

    if (sockets?.length) {
      sockets.forEach((socket) => {
        // Leave all previous liveHistoryId rooms dynamically
        socket.rooms.forEach((room) => {
          if (room !== globalRoom) {
            console.log(`Leaving old room: ${room}`);
            socket.leave(room);
          }
        });

        // Join the new live room
        socket.join(parsedData.liveHistoryId);
        socket.liveHistoryId = parsedData.liveHistoryId; // Store current room in socket
        console.log(`Joined new room: ${parsedData.liveHistoryId}`);
      });

      io.in(parsedData.liveHistoryId).emit("joinLiveRoom", data);
    } else {
      console.log("Sockets not able to emit");
    }
  });

  socket.on("countLiveJoin", async (data) => {
    const dataOfaddView = JSON.parse(data);
    console.log("[countLiveJoin] Received data:", dataOfaddView);

    const { userId, liveHistoryId } = dataOfaddView;

    const [sockets, user, liveUser, pkLiveUser, existLiveView] = await Promise.all([
      io.in(globalRoom).fetchSockets(),
      User.findById(userId).select("name userName image gender countryFlagImage country uniqueId isVerified channel token").lean(),
      LiveStreamer.findOne({ liveHistoryId }).select("view").lean(),
      LiveStreamer.findOne({ isPkMode: true, liveHistoryId }).select("pkEndTime").lean(),
      LiveStreamerView.findOne({ userId, liveHistoryId }).lean(),
    ]);

    if (sockets?.length) {
      sockets[0].join(liveHistoryId);
    } else {
      console.log("[countLiveJoin] No sockets available to emit");
    }

    if (pkLiveUser) {
      const duration = pkLiveUser.pkEndTime ? Math.round((new Date(pkLiveUser?.pkEndTime).getTime() - new Date().getTime()) / 1000) : 0;

      const rankedLiveUser = await LiveStreamer.aggregate([{ $match: { _id: pkLiveUser._id } }, { $addFields: { duration } }]);

      if (rankedLiveUser.length > 0) {
        io.in(liveHistoryId).emit("pkRankUpdate", rankedLiveUser[0]);
      }
    }

    if (user && liveUser && !existLiveView) {
      console.log("[countLiveJoin] Creating new LiveView entry");

      await LiveStreamerView.create({
        userId,
        liveHistoryId,
        ...user,
      });
    }

    const totalViews = await LiveStreamerView.countDocuments({ liveHistoryId });
    console.log(`[countLiveJoin] Total viewers for ${liveHistoryId}:`, totalViews);

    io.in(liveHistoryId).emit("countLiveJoin", totalViews);

    if (liveUser) {
      await LiveStreamer.updateOne({ _id: liveUser._id }, { $set: { view: totalViews } });
    }
  });

  socket.on("reduceLiveJoiners", async (data) => {
    try {
      const dataOflessView = JSON.parse(data);
      console.log("[reduceLiveJoiners] Received data:", dataOflessView);

      const { userId, liveHistoryId } = dataOflessView;

      const [sockets, liveUser, existLiveView] = await Promise.all([
        io.in(globalRoom).fetchSockets(),
        LiveStreamer.findOne({ liveHistoryId }).select("_id view").lean(),
        LiveStreamerView.findOne({ userId, liveHistoryId }).lean(),
      ]);

      if (sockets?.length) {
        sockets[0].leave(liveHistoryId);
      } else {
        console.log("[reduceLiveJoiners] No sockets available to leave");
      }

      if (existLiveView) {
        console.log("[reduceLiveJoiners] Removing user from LiveView");
        await LiveStreamerView.deleteOne({ _id: existLiveView._id });
      }

      const totalViews = await LiveStreamerView.countDocuments({ liveHistoryId });
      console.log(`[reduceLiveJoiners] Updated total viewers for ${liveHistoryId}:`, totalViews);

      io.in(liveHistoryId).emit("reduceLiveJoiners", totalViews);

      if (liveUser) {
        await LiveStreamer.updateOne({ _id: liveUser._id }, { $set: { view: totalViews } });
      }
    } catch (error) {
      console.error("[reduceLiveJoiners] Error:", error);
    }
  });

  socket.on("broadcastLiveComment", async (data) => {
    try {
      const dataOfComment = JSON.parse(data);
      console.log("[broadcastLiveComment] Parsed data:", dataOfComment);

      const { liveHistoryId } = dataOfComment;

      const [sockets, liveHistory] = await Promise.all([io.in(globalRoom).fetchSockets(), LiveHistory.findById(liveHistoryId).select("_id").lean()]);

      if (sockets?.length) {
        sockets[0].join(liveHistoryId);
      } else {
        console.log("[broadcastLiveComment] No sockets available to join room");
      }

      io.in(liveHistoryId).emit("broadcastLiveComment", data);

      const socketCount = (await io.in(liveHistoryId).fetchSockets())?.length || 0;
      console.log(`[broadcastLiveComment] Active sockets in room ${liveHistoryId}:`, socketCount);

      if (liveHistory) {
        await LiveStreamerHistory.updateOne({ _id: liveHistory._id }, { $inc: { totalLiveChat: 1 } });
        console.log(`[broadcastLiveComment] Updated totalLiveChat for ${liveHistoryId}`);
      }
    } catch (error) {
      console.error("[broadcastLiveComment] Error:", error);
    }
  });

  socket.on("sendGift", async (data) => {
    const giftData = JSON.parse(data);
    socket.join(giftData.liveHistoryId);

    console.log("Gift Data Received:", giftData);

    try {
      const [uniqueId, senderUser, receiverUser, gift] = await Promise.all([
        generateHistoryUniqueId(),
        User.findById(giftData.senderUserId).lean().select("_id coin"),
        User.findById(giftData.receiverUserId).lean().select("_id coin receivedCoins receivedGifts"),
        Gift.findById(giftData.giftId).lean().select("_id coin"),
      ]);

      if (!senderUser) {
        console.log("Sender user not found");
        io.in(`globalRoom:${giftData.senderUserId}`).emit("gift", { error: "Sender user not found" });
        return;
      }

      if (!receiverUser) {
        console.log("Receiver user not found");
        io.in(`globalRoom:${giftData.receiverUserId}`).emit("gift", { error: "Receiver user not found" });
        return;
      }

      if (!gift) {
        console.log("Gift not found");
        io.in(`globalRoom:${giftData.senderUserId}`).emit("gift", { error: "Gift not found" });
        return;
      }

      const giftCount = giftData.giftCount;
      const coinPerGift = Math.abs(gift.coin);
      const totalCoin = coinPerGift * giftCount;

      if (senderUser.coin < totalCoin) {
        console.log("Insufficient coins");
        io.in(`globalRoom:${giftData.senderUserId}`).emit("gift", { error: "You don't have enough coins" });
        return;
      }

      const [updatedSenderUser, updatedReceiverUser] = await Promise.all([
        User.findByIdAndUpdate(senderUser._id, { $inc: { coin: -totalCoin, spentCoins: totalCoin } }, { new: true, select: "_id coin spentCoins" }),
        User.findByIdAndUpdate(receiverUser._id, { $inc: { coin: totalCoin, receivedCoins: totalCoin, receivedGifts: 1 } }, { new: true, select: "_id coin receivedCoins receivedGifts" }),
      ]);

      io.in(giftData.liveHistoryId).emit("gift", {
        giftData,
        senderUser: updatedSenderUser,
        receiverUser: updatedReceiverUser,
      });

      await Promise.all([
        History.create({
          uniqueId: uniqueId,
          type: 2,
          userId: senderUser._id,
          otherUserId: receiverUser._id,
          giftId: giftData.giftId,
          giftReceivedCount: giftCount,
          userCoin: totalCoin,
          date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
        }),
        LiveStreamerHistory.findByIdAndUpdate(giftData.liveHistoryId, { $inc: { totalGift: 1 } }, { new: true }),
      ]);
    } catch (error) {
      console.error("Error in sendGift:", error);
      io.in(giftData.liveHistoryId).emit("gift", { error: "An error occurred while processing the gift." });
    }
  });

  socket.on("endLiveStream", async (data) => {
    try {
      const parsedData = JSON.parse(data);
      console.log("Received endLiveStream event with data:", parsedData);

      const { userId, liveHistoryId } = parsedData;

      io.in(liveHistoryId).emit("endLiveStream", parsedData);

      const [user, liveUser, liveHistory] = await Promise.all([
        User.findOne({ liveHistoryId }).select("_id isLive isBusy liveHistoryId name").lean(),
        LiveStreamer.findOne({ userId, liveHistoryId }).select("_id userId liveHistoryId isAudio").lean(),
        LiveStreamerHistory.findById(liveHistoryId).select("_id startTime endTime duration").lean(),
      ]);

      if (!user) {
        console.log("⚠️ User not found.");
        return;
      }

      if (!liveUser) {
        console.log(`⚠️ No LiveUser found with userId: ${userId} and liveHistoryId: ${liveHistoryId}`);
        return;
      }

      if (!liveHistory) {
        console.log("⚠️ LiveHistory not found.");
        return;
      }

      if (user.isLive) {
        const endTime = moment().format("HH:mm:ss");
        const startTime = moment(liveHistory.startTime, "HH:mm:ss");
        const duration = moment.utc(moment(endTime, "HH:mm:ss").diff(startTime)).format("HH:mm:ss");

        await Promise.all([
          LiveStreamerHistory.updateOne({ _id: liveHistory._id }, { $set: { endTime, duration } }),
          User.updateOne({ _id: user._id }, { $set: { isLive: false, isBusy: false, liveHistoryId: null } }),
          LiveStreamerView.deleteMany({ liveHistoryId }),
        ]);

        console.log(`✅ User ${user.name} is no longer live.`);
        console.log("✅ Related liveViews deleted.");

        if (!liveUser.isAudio) {
          await LiveStreamer.deleteOne({ userId, liveHistoryId });
          console.log(`✅ LiveStreamer entry deleted for userId: ${userId}`);
        } else {
          console.log("🔊 liveUser.isAudio is true, skipping LiveStreamer deletion.");
        }
      }

      const sockets = await io.in(liveHistoryId).fetchSockets();
      console.log(`🔄 Active sockets in room (${liveHistoryId}): ${sockets.length}`);

      if (sockets.length) {
        io.socketsLeave(liveHistoryId);
        console.log(`✅ All sockets removed from room: ${liveHistoryId}`);
      } else {
        console.log("⚠️ No active sockets found to remove.");
      }
    } catch (error) {
      console.error("❌ Error in endLiveStream:", error);
    }
  });

  socket.on("disconnect", async (reason) => {
    console.log(`Socket disconnected: ${id} - ${socket.id} - Reason: ${reason}`);

    if (globalRoom) {
      const sockets = await io.in(globalRoom).fetchSockets();
      console.log("🔄 Checking active sockets in room:", sockets.length);

      if (sockets?.length == 0) {
        const userId = new mongoose.Types.ObjectId(id);
        console.log(`🔍 Fetching user data for userId: ${userId}`);

        const user = await User.findById(userId).select("_id callId").lean();
        if (user) {
          if (user.callId && user.callId !== null) {
            const callId = new mongoose.Types.ObjectId(user.callId);
            console.log(`📞 User was in an active call. Ending Call ID: ${callId}`);

            io.socketsLeave(user.callId.toString());

            const [privateCallDelete, userUpdate, callHistory] = await Promise.all([
              Privatecall.deleteOne({ $or: [{ caller: id }, { receiver: id }] }),
              User.findOneAndUpdate({ _id: userId }, { $set: { isOnline: false, isBusy: false, isLive: false, callId: null, liveHistoryId: null } }, { new: true }),
              // History.findById(callId).select("_id callStartTime"),
            ]);

            // if (callHistory) {
            //   callHistory.callEndTime = moment().format("HH:mm:ss");

            //   const duration = moment.utc(moment(callHistory.callEndTime, "HH:mm:ss").diff(moment(callHistory.callStartTime, "HH:mm:ss"))).format("HH:mm:ss");

            //   callHistory.callConnect = false;
            //   callHistory.duration = duration;

            //   await Promise.all([
            //     callHistory?.save(),
            //     Chat.findOneAndUpdate(
            //       { callId: callHistory._id },
            //       {
            //         $set: {
            //           callDuration: duration,
            //           messageType: 3,
            //           callType: 1, // 1 = Received Call
            //           isRead: true,
            //         },
            //       },
            //       { new: true }
            //     ),
            //   ]);
            // }
          }
        }
      }
    }
  });
});
