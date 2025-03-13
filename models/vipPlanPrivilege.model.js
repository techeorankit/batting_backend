const mongoose = require("mongoose");

const VipPlanPrivilegeSchema = new mongoose.Schema({
  planName: { type: String, default: "" },
  audioCallDiscount: { type: Number, min: 0, max: 100 },
  videoCallDiscount: { type: Number, min: 0, max: 100 },
  randomMatchVideoCallDiscount: { type: Number, min: 0, max: 100 },
  vipFrameBadge: { type: String, default: "" },
  topUpCoinBonus: { type: Number, min: 0 },
  freeMessages: { type: Number, min: 0 },
});

const VipPlanPrivilege = mongoose.model("VipPlanPrivilege", VipPlanPrivilegeSchema);

module.exports = VipPlanPrivilege;
