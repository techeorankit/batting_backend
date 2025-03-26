const Agency = require("../models/agency.model");

const generateAgencyCode = async () => {
  let uniqueCode;
  let isUnique = false;

  while (!isUnique) {
    uniqueCode = `AG${crypto.randomInt(100000, 999999)}`;
    const existingAgency = await Agency.findOne({ agencyCode: uniqueCode });
    if (!existingAgency) {
      isUnique = true;
    }
  }
  return uniqueCode;
};

module.exports = generateAgencyCode;
