const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    genderType: { type: Number, enum: [1, 2] }, //1.male 2.female
    message: { type: Array, default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Message", messageSchema);
