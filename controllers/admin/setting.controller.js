const Setting = require("../../models/setting.model");

//update setting
exports.updateSetting = async (req, res) => {
  try {
    // if (!req.query.settingId) {
    //   return res.status(200).json({ status: false, message: "SettingId mumst be requried." });
    // }

    // const setting = await Setting.findById(req.query.settingId);
    // if (!setting) {
    //   return res.status(200).json({ status: false, message: "Setting does not found." });
    // }

    const setting = new Setting();

    setting.minCoinsToConvert = req.body.minCoinsToConvert ? req.body.minCoinsToConvert : setting.minCoinsToConvert;
    setting.privateKey = req.body.privateKey ? req.body.privateKey: setting.privateKey;

    await setting.save();

    updateSettingFile(setting);

    return res.status(200).json({
      status: true,
      message: "Setting has been Updated.",
      data: setting,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
