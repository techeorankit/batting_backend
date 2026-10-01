//mongoose
const mongoose = require("mongoose");
mongoose.connect(process.env.MongoDb_Connection_String, {
  serverSelectionTimeoutMS: 10000,
});

const db = mongoose.connection;
module.exports = db;
