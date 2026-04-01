const Agency = require("../../models/agency.model");
const Admin = require("../../models/admin.model");
const SubAdmin = require("../../models/subAdmin.model");
const User = require("../../models/user.model");

//generateAgencyCode
const generateAgencyCode = require("../../util/generateAgencyCode");

//Cryptr
const Cryptr = require("cryptr");
const cryptr = new Cryptr("myTotallySecretKey");

//fs
const fs = require("fs");

//deletefile
const { deleteFile } = require("../../util/deletefile");

//private key
const firebaseAdminPromise = require("../../util/privateKey");

//create agency
exports.createAgency = async (req, res) => {
  try {
    const { name, email, commissionType, commission, password, countryCode, mobileNumber, description, countryFlagImage, country, uid } = req.body;

    if (!name || !email || !commissionType || !commission || !password || !countryCode || !mobileNumber || !req.file || !description || !countryFlagImage || !country || !uid) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "All fields are required!" });
    }

    const [subAdmin, agency, admin, user, agencyCode] = await Promise.all([
      SubAdmin.exists({ email }),
      Agency.exists({ email }),
      Admin.exists({ email }),
      User.exists({ email }),
      generateAgencyCode(),
    ]);

    if (agency || admin || user || subAdmin) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "This email is already in use." });
    }

    const newAgency = new Agency({
      uid,
      agencyCode,
      name,
      email,
      commissionType,
      commission,
      password: cryptr.encrypt(password),
      countryCode,
      mobileNumber,
      image: req.file.path,
      description,
      countryFlagImage,
      country: country.trim().toLowerCase(),
    });

    await newAgency.save();
    newAgency.password = cryptr.decrypt(newAgency.password);

    return res.status(200).json({
      status: true,
      message: "Agency created successfully under a valid license!",
      data: newAgency,
    });
  } catch (error) {
    console.error("createAgency error:", error);
    if (req.file) deleteFile(req.file.path);
    return res.status(500).json({ status: false, message: "Internal server error." });
  }
};

//update agency
exports.updateAgency = async (req, res) => {
  try {
    const { agencyId } = req.query;
    const { name, email, commissionType, commission, password, countryCode, mobileNumber, description, countryFlagImage, country, uid } = req.body;

    if (!agencyId) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "Agency ID is required." });
    }

    const agency = await Agency.findById(agencyId);
    if (!agency) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "Agency not found." });
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        if (req.file) deleteFile(req.file);
        return res.status(200).json({ status: false, message: "Invalid email format." });
      }

      const [subAdminExists, agencyExists, adminExists, userExists] = await Promise.all([
        SubAdmin.exists({ email: email.trim() }),
        Agency.exists({ email: email.trim(), _id: { $ne: agencyId } }), // exclude current agency
        Admin.exists({ email: email.trim() }),
        User.exists({ email: email.trim() }),
      ]);

      if (subAdminExists || agencyExists || adminExists || userExists) {
        if (req.file) deleteFile(req.file);
        return res.status(200).json({ status: false, message: "This email is already in use." });
      }
    }

    agency.name = name || agency.name;
    agency.email = email?.trim() || agency.email;
    agency.password = password ? cryptr?.encrypt(password) : agency.password;
    agency.countryCode = countryCode || agency.countryCode;
    agency.mobileNumber = mobileNumber || agency.mobileNumber;
    agency.commissionType = commissionType || agency.commissionType;
    agency.commission = commission || agency.commission;
    agency.description = description || agency.description;
    agency.countryFlagImage = countryFlagImage || agency.countryFlagImage;
    agency.country = country.trim().toLowerCase() || agency.country;

    if (req.file) {
      if (agency.image) {
        const imagePath = agency.image.includes("storage") ? "storage" + agency.image.split("storage")[1] : "";
        if (imagePath && fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      }
      agency.image = req.file.path;
    }

    // try {
    //   if (agency.uid && (email || password)) {
    //     const firebaseAdmin = await firebaseAdminPromise;

    //     const payload = {};
    //     if (email) payload.email = email.trim();
    //     if (password) payload.password = password;

    //     await firebaseAdmin.auth().updateUser(String(agency.uid), payload);
    //   }
    // } catch (fbErr) {
    //   if (req.file) deleteFile(req.file);
    //   console.error("Firebase update error:", fbErr);
    //   return res.status(200).json({
    //     status: false,
    //     message: fbErr?.message || "Failed to update credentials in Firebase.",
    //   });
    // }

    await agency.save();

    agency.password = cryptr.decrypt(agency.password);

    return res.status(200).json({
      status: true,
      message: "Agency updated successfully!",
      data: agency,
    });
  } catch (error) {
    if (req.file) deleteFile(req.file);
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal server error." });
  }
};

//toggle agency block status
exports.toggleAgencyBlockStatus = async (req, res, next) => {
  try {
    const { agencyId } = req.query;

    if (!agencyId) {
      return res.status(200).json({ status: false, message: "Agency ID is required." });
    }

    const agency = await Agency.findById(agencyId);
    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found." });
    }

    agency.isBlock = !agency.isBlock;
    await agency.save();

    return res.status(200).json({
      status: true,
      message: `Agency has been ${agency.isBlock ? "blocked" : "unblocked"} successfully.`,
      data: agency,
    });
  } catch (error) {
    console.error("Error updating agency block status:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while updating the agency's block status.",
    });
  }
};

//get agencies
exports.getAgencies = async (req, res) => {
  try {
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const searchString = req.query.search || "";
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    const countryFilter = req?.query?.country?.trim()?.toLowerCase() || "";
    const isBlockFilter = req.query.isBlock || false;

    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    let matchQuery = {};

    if (countryFilter) {
      matchQuery.country = { $regex: `^${countryFilter}$`, $options: "i" };
    }

    if (isBlockFilter) {
      matchQuery.isBlock = isBlockFilter === "true";
    }

    if (startDate !== "All" && endDate !== "All") {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);

      matchQuery.createdAt = { $gte: startDateObj, $lte: endDateObj };
    }

    if (searchString !== "All" && searchString !== "") {
      matchQuery.$or = [{ name: { $regex: searchString, $options: "i" } }, { email: { $regex: searchString, $options: "i" } }, { agencyCode: { $regex: searchString, $options: "i" } }];
    }

    const result = await Agency.aggregate([
      { $match: matchQuery },

      {
        $facet: {
          total: [{ $count: "count" }],
          agencies: [
            { $sort: { [sortBy]: sortOrder } },
            { $skip: (start - 1) * limit },
            { $limit: limit },
            {
              $lookup: {
                from: "hosts",
                localField: "_id",
                foreignField: "agencyId",
                pipeline: [
                  {
                    $match: {
                      status: 2,
                      isFake: false,
                    },
                  },
                  {
                    $count: "totalHosts",
                  },
                ],
                as: "hostStats",
              },
            },
            {
              $addFields: {
                totalHosts: { $ifNull: [{ $arrayElemAt: ["$hostStats.totalHosts", 0] }, 0] },
              },
            },
            { $unset: "hostStats" },
            {
              $project: {
                _id: 1,
                totalHosts: 1,
                name: 1,
                email: 1,
                description: 1,
                password: 1,
                commissionType: 1,
                commission: 1,
                agencyCode: 1,
                countryCode: 1,
                mobileNumber: 1,
                image: 1,
                countryFlagImage: 1,
                country: 1,
                hostCoins: 1,
                totalEarnings: 1,
                netAvailableEarnings: 1,
                isBlock: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },
    ]);

    const total = result[0].total[0]?.count || 0;
    const agencies = result[0].agencies;

    for (let i = 0; i < agencies.length; i++) {
      try {
        if (agencies[i].password && agencies[i].password.trim() !== "") {
          agencies[i].password = cryptr.decrypt(agencies[i].password);
        }
      } catch (err) {
        agencies[i].password = "Decryption Failed";
      }
    }

    return res.status(200).json({
      status: true,
      message: "Agencies retrieved successfully!",
      total: total,
      data: agencies,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal server error." });
  }
};

//delete agency
exports.deleteAgency = async (req, res) => {
  try {
    const { agencyId } = req.query;

    if (!agencyId) {
      return res.status(200).json({ status: false, message: "Agency ID is required." });
    }

    const agency = await Agency.findById(agencyId);
    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found." });
    }

    await agency.deleteOne();

    return res.status(200).json({
      status: true,
      message: "Agency deleted successfully!",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal server error." });
  }
};

//get agency list ( when assign host under agency )
exports.getActiveAgenciesList = async (req, res) => {
  try {
    const agencies = await Agency.find({ isBlock: false }).select("_id name agencyCode").lean();

    return res.status(200).json({
      status: true,
      message: "Active agencies retrieved successfully.",
      data: agencies,
    });
  } catch (error) {
    console.error("Error in getActiveAgenciesList:", error);
    return res.status(500).json({ status: false, message: "Internal Server Error", error: error.message });
  }
};
