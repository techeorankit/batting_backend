const Block = require("../../models/block.model");

//import model
const User = require("../../models/user.model");
const Host = require("../../models/host.model");
const FollowerFollowing = require("../../models/followerFollowing.model");

//mongoose
const mongoose = require("mongoose");

//handle user blocking a host
exports.blockHost = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid request. hostId is required." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

    const [user, host, existingBlock] = await Promise.all([User.findById(userId).select("_id").lean(), Host.findById(hostId).select("_id").lean(), Block.findOne({ userId, hostId })]);

    if (!user) {
      return res.status(200).json({ status: false, message: "User not found." });
    }

    if (!host) {
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    if (existingBlock) {
      console.log("Updating existing block entry for user blocking host");

      const newStatus = !existingBlock.isUserBlocked;
      existingBlock.isUserBlocked = newStatus;
      await existingBlock.save();

      if (newStatus) {
        await FollowerFollowing.deleteOne({ followerId: userId, followingId: hostId });
      }

      return res.status(200).json({
        status: true,
        message: newStatus ? "Host blocked successfully." : "Host unblocked successfully.",
        isBlocked: newStatus,
      });
    } else {
      console.log("Creating new block entry for user blocking host");

      await Promise.all([
        new Block({
          userId,
          hostId,
          isUserBlocked: true,
          isHostBlocked: false,
        }).save(),
        FollowerFollowing.deleteOne({ followerId: userId, followingId: hostId }),
      ]);

      return res.status(200).json({
        status: true,
        message: "Host blocked successfully.",
        isBlocked: true,
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

//handle host blocking a user
exports.blockUser = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid request. hostId is required." });
    }

    if (!req.query.userId) {
      return res.status(200).json({ status: false, message: "Invalid request. userId is required." });
    }

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);
    const userId = new mongoose.Types.ObjectId(req.query.userId);

    const [host, user, existingBlock] = await Promise.all([Host.findById(hostId).select("_id").lean(), User.findById(userId).select("_id").lean(), Block.findOne({ userId, hostId })]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    if (!user) {
      return res.status(200).json({ status: false, message: "User not found." });
    }

    if (existingBlock) {
      console.log("Updating existing block entry for host blocking user");

      const newStatus = !existingBlock.isHostBlocked;
      existingBlock.isHostBlocked = newStatus;
      await existingBlock.save();

      if (newStatus) {
        await FollowerFollowing.deleteMany({ followerId: userId, followingId: hostId });
      }

      return res.status(200).json({
        status: true,
        message: newStatus ? "User blocked successfully." : "User unblocked successfully.",
        isBlocked: newStatus,
      });
    } else {
      console.log("Creating new block entry for host blocking user");

      await Promise.all([
        new Block({
          userId: userId,
          hostId: hostId,
          isUserBlocked: false,
          isHostBlocked: true,
        }).save(),
        FollowerFollowing.deleteMany({ followerId: userId, followingId: hostId }),
      ]);

      return res.status(200).json({
        status: true,
        message: "User blocked successfully.",
        isBlocked: true,
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

//get blocked hosts for a user
exports.getBlockedHostsForUser = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const blockedHosts = await Block.find({ userId, isUserBlocked: true })
      .select("hostId")
      .populate("hostId", "name image countryFlagImage country")
      .skip((start - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({
      status: true,
      message: blockedHosts.length > 0 ? "Blocked hosts retrieved successfully." : "No blocked hosts found.",
      blockedHosts,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

//get blocked users for a host
exports.getBlockedUsersForHost = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "Invalid request. hostId is required." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);

    const blockedUsers = await Block.find({ hostId, isHostBlocked: true })
      .select("userId")
      .populate("userId", "name image countryFlagImage country")
      .skip((start - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({
      status: true,
      message: blockedUsers.length > 0 ? "Blocked users retrieved successfully." : "No blocked users found.",
      blockedUsers,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};
