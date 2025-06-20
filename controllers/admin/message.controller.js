const Message = require("../../models/message.model");

//create message
exports.insertMessage = async (req, res) => {
  try {
    const { message, genderType } = req.query;

    if (!message || !genderType || ![1, 2].includes(Number(genderType))) {
      return res.status(200).json({
        status: false,
        message: "Invalid details provided. 'message' and valid 'genderType' (1 or 2) are required.",
      });
    }

    const newMessage = new Message({
      genderType,
      message: message.split(",").map((str) => str.trim()),
    });

    await newMessage.save();

    return res.status(200).json({
      status: true,
      message: "Message has been successfully created by the admin.",
      data: newMessage,
    });
  } catch (error) {
    console.error("Error creating message:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while creating the message. Please try again later.",
    });
  }
};

//update message
exports.updateMessage = async (req, res) => {
  try {
    const genderType = Number(req.query.genderType);

    if (!genderType || ![1, 2].includes(genderType)) {
      return res.status(200).json({
        status: false,
        message: "Invalid 'genderType' provided. It must be either 1 (male) or 2 (female).",
      });
    }

    const message = await Message.findOne({ genderType });

    if (!message) {
      return res.status(200).json({
        status: false,
        message: "Message not found for the specified genderType.",
      });
    }

    if (req.body.message) {
      message.message = req.body.message
        .split(",")
        .map((msg) => msg.trim())
        .filter(Boolean);
    }

    await message.save();

    return res.status(200).json({
      status: true,
      message: "Message has been successfully updated by the admin.",
      data: message,
    });
  } catch (error) {
    console.error("Error updating message:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "An internal server error occurred.",
    });
  }
};

//get message
exports.fetchMessage = async (req, res) => {
  try {
    const genderType = Number(req.query.genderType);

    if (!genderType || ![1, 2].includes(genderType)) {
      return res.status(200).json({
        status: false,
        message: "Invalid 'genderType' provided. It must be either 1 (male) or 2 (female).",
      });
    }

    const message = await Message.findOne({ genderType });

    return res.status(200).json({ status: true, message: "Messages has been get by the admin.", data: message });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
