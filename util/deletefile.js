const fs = require("fs");
const path = require("path");

// exports.deleteFile = (file) => {
//   if (file && fs.existsSync(file?.path)) {
//     fs.unlinkSync(file.path);
//   }
// };

// exports.deleteFiles = (files) => {
//   if (!files || typeof files !== "object") return;

//   Object.keys(files).forEach((field) => {
//     const fieldFiles = files[field];
//     if (Array.isArray(fieldFiles)) {
//       fieldFiles.forEach((file) => exports.deleteFile(file));
//     }
//   });
// };

exports.deleteFile = (file) => {
  try {
    if (!file) {
      console.warn("[deleteFile] No file provided");
      return;
    }

    const filePath = typeof file === "string" ? file : file?.path;

    if (!filePath) {
      console.warn("[deleteFile] File path missing:", file);
      return;
    }

    const absolutePath = path.resolve(filePath);
    console.log("[deleteFile] Trying to delete:", absolutePath);

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
      console.log("[deleteFile] Deleted successfully:", absolutePath);
    } else {
      console.warn("[deleteFile] File not found:", absolutePath);
    }
  } catch (error) {
    console.error("[deleteFile] Error deleting file:", error.message);
  }
};

exports.deleteFiles = (files) => {
  try {
    if (!files || typeof files !== "object") {
      console.warn("[deleteFiles] Invalid files object");
      return;
    }

    Object.keys(files).forEach((field) => {
      const fieldFiles = files[field];

      if (Array.isArray(fieldFiles)) {
        console.log(`[deleteFiles] Deleting files for field: ${field}`);

        fieldFiles.forEach((file) => {
          exports.deleteFile(file);
        });
      } else {
        console.warn(`[deleteFiles] Expected array for field ${field}, got:`, typeof fieldFiles);
      }
    });
  } catch (error) {
    console.error("[deleteFiles] Error processing files:", error.message);
  }
};
