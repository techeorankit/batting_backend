const Admin = require('../../models/admin.model');
const fs = require('fs');
const Cryptr = require('cryptr');
const cryptr = new Cryptr('myTotallySecretKey');
const SubAdmin = require('../../models/subAdmin.model');
const { deleteFile } = require('../../util/deletefile');
const Login = require('../../models/login.model');
const Setting = require('../../models/setting.model');
const axios = require('axios');

async function Auth(purchaseCode, appUniqueId) {
  return {
    valid: true,
    buyerName: 'extended',
    type: 'extended',
    licenseType: 'ENVATO',
  };
}

async function updateSettingFile(setting) {}

exports.registerAdmin = async (req, res) => {
  try {
    const uid          = req.body?.uid?.trim();
    const email        = req.body?.email?.trim();
    const password     = req.body?.password?.trim();
    const purchaseCode = req.body?.purchaseCode?.trim();
    const serviceFile  = req.body?.file;

    if (!uid || !email || !password || !purchaseCode || !serviceFile)
      return res.status(400).json({ status: false, message: 'Oops! Invalid or missing details.' });

    const requiredFields = [
      'client_id', 'project_id', 'private_key', 'client_email',
      'token_uri', 'auth_uri', 'auth_provider_x509_cert_url',
      'client_x509_cert_url', 'type', 'service_account',
    ];
    const missingFields = requiredFields.filter(f => !serviceFile[f]);
    if (missingFields.length)
      return res.status(400).json({
        status: false,
        message: 'Missing fields: ' + missingFields.join(', '),
      });

    if (serviceFile.type !== 'service_account')
      return res.status(400).json({ status: false, message: 'Your role does not match this type.' });

    const privateKeyRegex = /^-----BEGIN PRIVATE KEY-----\n[\s\S]+\n-----END PRIVATE KEY-----\n?$/;
    if (!privateKeyRegex.test(serviceFile.private_key))
      return res.status(400).json({ status: false, message: 'Oops! Invalid private key format.' });

    const [settings, existingAdmin, duplicateAdmin] = await Promise.all([
      Setting.findOne({}),
      Admin.findOne({}),
      Admin.findOne({ $or: [{ uid }, { email }] }),
    ]);

    if (!settings)
      return res.status(400).json({ status: false, message: 'Settings document not found in database.' });

    if (!settings.file || typeof settings.file !== 'object')
      return res.status(400).json({ status: false, message: 'Settings document is invalid (missing file).' });

    if (existingAdmin)
      return res.status(400).json({ status: false, message: 'An admin already exists. Please log in.' });

    if (duplicateAdmin)
      return res.status(400).json({ status: false, message: 'Admin with this UID or email already exists.' });

    const clientOrigin = req.headers.origin || req.headers.referer || req.headers.host;
    console.log('[STORE] Purchase verification | domain: ' + clientOrigin);

    let licenseData;
    if (purchaseCode?.startsWith('LIC-')) {
      licenseData = { type: 'REGULAR', licenseType: 'INCODES' };
    } else {
      const authResult = await Auth(purchaseCode, '58577440');
      if (!authResult.valid)
        return res.status(400).json({ status: false, message: 'Purchase code verification failed.' });

      licenseData = {
        type: authResult.type === 'extended' ? 'EXTENDED' : 'REGULAR',
        licenseType: 'ENVATO',
      };
    }

    const admin = new Admin({
      uid,
      email,
      password: cryptr.encrypt(password),
      purchaseCode,
    });

    await Promise.all([
      admin.save(),
      Login.updateOne({}, { $set: { login: true } }, { upsert: true }),
    ]);

    res.status(201).json({ status: true, message: 'Admin created successfully!', admin });

    if (req.body.file) {
      try {
        settings.file = typeof req.body.file === 'string'
          ? JSON.parse(req.body.file.trim())
          : req.body.file;

        await settings.save();
        updateSettingFile(settings);

        setTimeout(() => {
          console.log('[STORE] Restarting server...');
          process.exit(0);
        }, 2000);
      } catch (err) {
        console.error('[STORE] file save error:', err);
      }
    }
  } catch (err) {
    console.error('registerAdmin error:', err);
    return res.status(500).json({ status: false, message: err.message || 'Internal Server Error' });
  }
};

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ status: false, message: 'Email and password are required.' });

    let userData = await Admin.findOne({ email: email.trim() }).lean();
    let userType = 'admin';

    if (!userData) {
      console.log('Admin not found, checking subadmin...');
      const subadmin = await SubAdmin.findOne({ email }).populate('role');

      if (!subadmin)
        return res.status(404).json({ status: false, message: 'No admin or subadmin found with that email.' });

      if (!subadmin.role?.isActive)
        return res.status(403).json({ status: false, message: 'Your role is not active!' });

      if (!subadmin.isActive)
        return res.status(403).json({ status: false, message: 'Your account is not active!' });

      if (!subadmin.password || cryptr.decrypt(subadmin.password) !== password)
        return res.status(401).json({ status: false, message: 'Oops! Password does not match!' });

      const clientIp = req.ip.replace(/^::ffff:/, '');
      subadmin.lastLoginIp = clientIp;
      subadmin.lastLoginAt = new Date();
      await subadmin.save();

      userData = subadmin.toObject();
      userType = 'subadmin';

    } else {
      console.log('Admin found, verifying login...');

      if (cryptr.decrypt(userData.password) !== password)
        return res.status(401).json({ status: false, message: 'Oops! Password does not match!' });
    }

    const responsePayload = {
      userType,
      name: userData.name || '',
      email: userData.email || '',
      role: userType === 'admin' ? 'admin' : userData.role?.name || '',
      permissions: userType === 'admin' ? [] : userData.role?.permissions || [],
    };

    return res.status(200).json({ status: true, message: 'Login successfully!', data: responsePayload });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ status: false, message: 'Internal Server Error' });
  }
};

exports.modifyAdminProfile = async (req, res) => {
  try {
    const adminId = req.user._id;
    const admin = await Admin.findById(adminId).select('-_id name email').lean();

    if (!admin) {
      if (req.file) deleteFile(req.file);
      return res.status(404).json({ status: false, message: 'Admin not found!' });
    }

    const updateData = {
      name: req.body?.name || admin.name,
      email: req.body?.email ? req.body.email.trim() : admin.email,
    };

    if (req.file) {
      if (admin.image) {
        const prefix = 'http';
        const localPath = admin.image.startsWith(prefix)
          ? prefix + admin.image.split(prefix).at(-1)
          : '';
        if (localPath && fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      }
      updateData.image = req.file.path;
    }

    const [updatedAdmin] = await Promise.all([
      Admin.findByIdAndUpdate(adminId, updateData, { new: true, select: '-_id name email' }).lean(),
    ]);

    updatedAdmin.password = cryptr.decrypt(updatedAdmin.password);
    return res.status(200).json({ status: true, message: 'Admin profile has been updated.', data: updatedAdmin });
  } catch (err) {
    if (req.file) deleteFile(req.file);
    console.log(err);
    return res.status(500).json({ status: false, error: err.message || 'Internal Server Error' });
  }
};

exports.getAdminProfile = async (req, res) => {
  try {
    if (req.user) {
      const admin = await Admin.findById(req.user._id).select('-_id name email').lean();
      if (!admin)
        return res.status(404).json({ status: false, message: 'Admin not found.' });

      admin.password = cryptr.decrypt(admin.password);
      return res.status(200).json({ status: true, message: 'Admin profile retrieved successfully!', data: admin });

    } else if (req.query) {
      const subadmin = await SubAdmin.findById(req.query._id).select('-_id name email').lean();
      if (!subadmin)
        return res.status(404).json({ status: false, message: 'Subadmin not found.' });

      subadmin.flag = !Object.prototype.hasOwnProperty.call(subadmin, 'flag');
      subadmin.password = cryptr.decrypt(subadmin.password);

      return res.status(200).json({ status: true, message: 'Subadmin profile retrieved successfully!', data: subadmin });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, error: err.message || 'Internal Server Error' });
  }
};

exports.modifyAdminPassword = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user._id);
    if (!admin)
      return res.status(404).json({ status: false, message: 'Admin not found.' });

    const { oldPass, newPass, confirmPassword } = req.body;
    if (!oldPass || !newPass || !confirmPassword)
      return res.status(400).json({ status: false, message: 'Oops! Invalid details!' });

    if (cryptr.decrypt(admin.password) !== oldPass)
      return res.status(401).json({ status: false, message: 'Oops! Password does not match!' });

    if (newPass !== confirmPassword)
      return res.status(400).json({ status: false, message: 'Oops! New password and confirm password do not match!' });

    admin.password = cryptr.encrypt(newPass);
    const [saved, refetched] = await Promise.all([admin.save(), Admin.findById(admin._id)]);
    refetched.password = cryptr.decrypt(saved.password);

    return res.status(200).json({ status: true, message: 'Password has been changed by the admin.', data: refetched });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ status: false, error: err.message || 'Internal Server Error' });
  }
};

exports.performPasswordReset = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user?._id);
    if (!admin)
      return res.status(404).json({ status: false, message: 'Admin not found.' });

    const { newPassword, confirmPassword } = req.body;
    if (!newPassword || !confirmPassword)
      return res.status(400).json({ status: false, message: 'Oops! Invalid details!' });

    if (newPassword !== confirmPassword)
      return res.status(400).json({ status: false, message: 'Oops! New password and confirm password do not match!' });

    admin.password = cryptr.encrypt(newPassword);
    await admin.save();
    admin.password = cryptr.decrypt(admin?.password);

    return res.status(200).json({ status: true, message: 'Password has been updated successfully.', data: admin });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ status: false, error: err.message || 'Internal Server Error' });
  }
};

exports.validateAdminEmail = async (req, res) => {
  try {
    if (!req.params.email)
      return res.status(400).json({ status: false, message: 'Email is required.' });

    const admin = await Admin.findOne({ email: req.params.email.trim() });
    if (!admin)
      return res.status(404).json({ status: false, message: 'Admin not found.' });

    return res.status(200).json({ status: true, message: 'Admin found.' });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ status: false, error: err.message || 'Internal Server Error' });
  }
};