// models/language.model.js
const mongoose = require("mongoose");

const languageSchema = new mongoose.Schema(
  {
    languageTitle: { type: String, unique: true, trim: true },
    languageCode: { type: String, unique: true, trim: true, lowercase: true },
    localLanguageTitle: { type: String, unique: true, trim: true },
    languageIcon: { type: String, required: true },
    errorCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model("Language", languageSchema);
