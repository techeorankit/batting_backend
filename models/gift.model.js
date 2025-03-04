const mongoose = require("mongoose");

const { GIFTTYPE_TYPE } = require("../types/constant");

const giftSchema = new mongoose.Schema(
  {
    type: { type: Number, enum: GIFTTYPE_TYPE, default: 1 }, //1.image, 2.gif, 3.svga
    image: { type: String, default: "" },
    svgaImage: { type: String, default: "" },
    coin: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

giftSchema.index({ createdAt: -1 });
giftSchema.index({ coin: 1 });

module.exports = mongoose.model("Gift", giftSchema);
