const LiveBroadcaster = require("../../models/liveBroadcaster.model");
const Agency = require("../../models/agency.model");

const mongoose = require("mongoose");

//get live hosts
exports.getLiveHosts = async (req, res) => {
  try {
    if (!req.agency || !req.agency._id) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const agencyObjectId = new mongoose.Types.ObjectId(req.agency._id);

    const [agency, liveData] = await Promise.all([
      Agency.findById(agencyObjectId).select("_id").lean(),
      LiveBroadcaster.aggregate([
        {
          $match: {
            hostId: { $ne: null },
          },
        },
        {
          $lookup: {
            from: "hosts",
            localField: "hostId",
            foreignField: "_id",
            pipeline: [
              {
                $match: { agencyId: agencyObjectId },
              },
              {
                $project: {
                  _id: 1,
                  name: 1,
                  gender: 1,
                  image: 1,
                  countryFlagImage: 1,
                  country: 1,
                },
              },
            ],
            as: "hostData",
          },
        },
        { $unwind: "$hostData" },
        {
          $match: {
            "hostData.agencyId": agencyObjectId,
          },
        },
        {
          $facet: {
            totalCount: [{ $count: "count" }],
            liveHosts: [
              { $sort: { view: -1 } },
              { $skip: (start - 1) * limit },
              { $limit: limit },
              {
                $project: {
                  _id: "$hostData._id",
                  name: "$hostData.name",
                  gender: "$hostData.gender",
                  image: "$hostData.image",
                  countryFlagImage: "$hostData.countryFlagImage",
                  country: "$hostData.country",
                  view: 1,
                  createdAt: 1,
                },
              },
            ],
          },
        },
      ]),
    ]);

    const liveHosts = liveData[0]?.liveHosts || [];
    const totalCount = liveData[0]?.totalCount[0]?.count || 0;

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found." });
    }

    return res.status(200).json({
      status: true,
      message: "Live hosts retrieved successfully.",
      total: totalCount,
      hosts: liveHosts,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "An error occurred while retrieving live hosts.",
      error: error.message || "Internal Server Error",
    });
  }
};
