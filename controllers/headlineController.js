const Headline = require("../models/HeadlineModel");

const HeadlineController = {
createHeadline: async (req, res) => {
  try {
    const { dailyMessage, dailyQuestion, date } = req.body;

    if (!dailyMessage || !dailyQuestion || !date) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const newHeadline = await Headline.create({
      dailyMessage,
      dailyQuestion,
      date,
    });

    res.status(201).json({
      success: true,
      message: "Headline created successfully",
      data: newHeadline,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create headline",
      error: error.message,
    });
  }
},

getAllHeadlines: async (req, res) => {
  try {
    const headlines = await Headline.find().sort({ date: -1 });

    res.status(200).json({
      success: true,
      total: headlines.length,
      data: headlines,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch headlines",
      error: error.message,
    });
  }
},

getHeadlineByDate: async (req, res) => {
  try {
    const { date } = req.params; // "2026-01-28" OR ISO string

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required",
      });
    }

    const inputDate = new Date(date);
    if (isNaN(inputDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }

    // ✅ Build range for that day in UTC
    const start = new Date(Date.UTC(
      inputDate.getUTCFullYear(),
      inputDate.getUTCMonth(),
      inputDate.getUTCDate(),
      0, 0, 0, 0
    ));

    const end = new Date(Date.UTC(
      inputDate.getUTCFullYear(),
      inputDate.getUTCMonth(),
      inputDate.getUTCDate(),
      23, 59, 59, 999
    ));

    const headline = await Headline.findOne({
      date: { $gte: start, $lte: end },
    });

    if (!headline) {
      return res.status(404).json({
        success: false,
        message: "Headline not found for this date",
      });
    }

    return res.status(200).json({
      success: true,
      data: headline,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch headline",
      error: error.message,
    });
  }
},

updateHeadline: async (req, res) => {
  try {
    const { id } = req.params;

    const updatedHeadline = await Headline.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedHeadline) {
      return res.status(404).json({
        success: false,
        message: "Headline not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Headline updated successfully",
      data: updatedHeadline,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update headline",
      error: error.message,
    });
  }
},

deleteHeadline: async (req, res) => {
  try {
    const { id } = req.params;

    const deletedHeadline = await Headline.findByIdAndDelete(id);

    if (!deletedHeadline) {
      return res.status(404).json({
        success: false,
        message: "Headline not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Headline deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete headline",
      error: error.message,
    });
  }
},
};

module.exports = HeadlineController;