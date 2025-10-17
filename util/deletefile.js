const fs = require("fs");

exports.deleteFile = (file) => {
  if (file && fs.existsSync(file?.path)) {
    fs.unlinkSync(file.path);
  }
};

exports.deleteFiles = (files) => {
  if (!files || typeof files !== "object") return;

  Object.keys(files).forEach((field) => {
    const fieldFiles = files[field];
    if (Array.isArray(fieldFiles)) {
      fieldFiles.forEach((file) => exports.deleteFile(file));
    }
  });
};
