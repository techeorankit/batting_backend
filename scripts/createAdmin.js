/**
 * Creates (or resets the password of) the panel's admin account without going through the sign-up page.
 *
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret node scripts/createAdmin.js
 *   ADMIN_REPLACE=1 ...   also allow changing the existing admin's email (the old login is removed)
 *
 * Does what /api/admin/admin/registerAdmin does: a Firebase email/password user, an Admin document holding
 * that user's uid, and the "login" flag that makes the panel open on the login page instead of sign-up.
 */
const { validateEnv } = require("../config/env");
validateEnv();

const mongoose = require("mongoose");
const Cryptr = require("cryptr");
const cryptr = new Cryptr("myTotallySecretKey");

const Admin = require("../models/admin.model");
const Login = require("../models/login.model");

(async () => {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = (process.env.ADMIN_PASSWORD || "").trim();
  if (!email || password.length < 8) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters).");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MongoDb_Connection_String, { serverSelectionTimeoutMS: 10000 });

    const existing = await Admin.findOne({}).lean();
    const replacing = existing && existing.email !== email;
    if (replacing && process.env.ADMIN_REPLACE !== "1") {
      console.error(`An admin already exists with a different email (${existing.email}). Set ADMIN_REPLACE=1 to move the admin to ${email}.`);
      process.exitCode = 1;
      return;
    }

    const firebase = await require("../util/privateKey");
    let user;
    try {
      user = await firebase.auth().getUserByEmail(email);
      user = await firebase.auth().updateUser(user.uid, { password, emailVerified: true, disabled: false });
      console.log("Firebase user existed: password updated.");
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
      user = await firebase.auth().createUser({ email, password, emailVerified: true });
      console.log("Firebase user created.");
    }

    await Promise.all([
      Admin.updateOne(
        existing ? { _id: existing._id } : { email },
        { $set: { uid: user.uid, email, password: cryptr.encrypt(password) }, $setOnInsert: { name: "Admin", purchaseCode: "SEEDED" } },
        { upsert: true },
      ),
      Login.updateOne({}, { $set: { login: true } }, { upsert: true }),
    ]);

    //the previous login must stop working once the admin has moved to another email
    if (replacing && existing.uid && existing.uid !== user.uid) {
      await firebase.auth().deleteUser(existing.uid).then(
        () => console.log(`Old Firebase user removed (${existing.email}).`),
        (error) => console.warn(`Could not remove old Firebase user: ${error.message}`),
      );
    }

    console.log(`Admin ready: ${email} (uid ${user.uid})`);
  } catch (error) {
    console.error("createAdmin failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
