const Agency = require("../../models/agency.model");

const generateAgencyCode = require("../../util/generateAgencyCode");

//Cryptr
const Cryptr = require("cryptr");
const cryptr = new Cryptr("myTotallySecretKey");

//create agency
exports.createAgency = async (req, res) => {
  try {
    const { name, email, commissionType, commission, password, mobileNumber, description, countryFlagImage, country } = req.body;

    if (!name || !email || !commissionType || !commission || !password || !mobileNumber || !req.file || !description || !countryFlagImage || !country) {
      return res.status(200).json({ status: false, message: "All fields are required!" });
    }

    const [existingAgency, agencyCode] = await Promise.all([Agency.findOne({ email: email.trim() }), generateAgencyCode()]);

    if (existingAgency) {
      return res.status(200).json({ status: false, message: "Email already exists!" });
    }

    const newAgency = new Agency({
      agencyCode,
      name,
      email,
      commissionType,
      commission,
      password: cryptr.encrypt(password),
      mobileNumber,
      image: req.file.path,
      description,
      countryFlagImage,
      country,
    });

    await newAgency.save();

    newAgency.password = cryptr.decrypt(newAgency.password);

    return res.status(200).json({
      status: true,
      message: "Agency created successfully!",
      data: newAgency,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal server error." });
  }
};

//update agency
exports.updateAgency = async (req, res) => {
  try {
    const { agencyId } = req.query;
    const { name, email, commissionType, commission, password, mobileNumber, description, countryFlagImage, country } = req.body;

    if (!agencyId) {
      return res.status(200).json({ status: false, message: "Agency ID is required." });
    }

    const [existingAgency, agency] = await Promise.all([email ? Agency.findOne({ email: email.trim() }) : null, Agency.findById(agencyId)]);

    if (email && existingAgency) {
      return res.status(200).json({ status: false, message: "Email already exists!" });
    }

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found." });
    }

    agency.name = name || agency.name;
    agency.email = email.trim() || agency.email;
    agency.password = cryptr.encrypt(password) || agency.password;
    agency.mobileNumber = mobileNumber || agency.mobileNumber;
    agency.commissionType = commissionType || agency.commissionType;
    agency.commission = commission || agency.commission;
    agency.description = description || agency.description;
    agency.countryFlagImage = countryFlagImage || agency.countryFlagImage;
    agency.country = country || agency.country;

    if (req.file) {
      if (agency.image) {
        const imagePath = agency.image.includes("storage") ? "storage" + agency.image.split("storage")[1] : "";
        if (imagePath && fs.existsSync(imagePath)) {
          const imageName = imagePath.split("/").pop();
          if (!["male.png", "female.png"].includes(imageName)) {
            fs.unlinkSync(imagePath);
          }
        }
      }
      agency.image = req.file.path;
    }

    await agency.save();

    agency.password = cryptr.decrypt(agency.password);

    return res.status(200).json({
      status: true,
      message: "Agency updated successfully!",
      data: agency,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal server error." });
  }
};

//get all agencies
exports.getAgencies = async (req, res) => {
  try {
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const agencies = await Agency.find()
      .skip((start - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({
      status: true,
      message: "Agencies retrieved successfully!",
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
      return res.status(400).json({ status: false, message: "Agency ID is required." });
    }

    const agency = await Agency.findById(agencyId);
    if (!agency) {
      return res.status(404).json({ status: false, message: "Agency not found." });
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
