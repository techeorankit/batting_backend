const Agency = require("../../models/agency.model");

//Cryptr
const Cryptr = require("cryptr");
const cryptr = new Cryptr("myTotallySecretKey");

//agency login

//update agency
exports.modifyAgency = async (req, res) => {
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

//get agency profile
