const UserModel = require("../models/UserModel");

const trackUserActivity = async (req, res, next) => {
    if (req.user) {
        await UserModel.findByIdAndUpdate(req.user._id, { lastActivity: new Date() });
    }
    next();
};

module.exports = trackUserActivity;
