const mongoose = require("mongoose");

const { Schema, model } = mongoose;

const SettingSchema = new Schema(
  {
    siteName: { type: String, required: false },
    phone: { type: String, required: false },
    address: { type: String, required: false },
    aboutus: { type: String, required: false },
    contactEmail: { type: String, required: false },
    facebookLink: { type: String, required: false },
    linkedinLink: { type: String, required: false },
    instagramLink: { type: String, required: false },
    twitterLink: { type: String, required: false },
    copyrightYear: { type: String, required: false },
    adminEmail: { type: String, required: false },
    headerLogo: { type: String, required: false },
    footerLogo: { type: String, required: false },
    favicon: { type: String, required: false },
    smtpHost: { type: String, required: false },
    smtpPort: { type: String, required: false },
    smtpUsername: { type: String, required: false },
    smtpPassword: { type: String, required: false },
    smtpFromEmail: { type: String, required: false },
    gemini_api_key: { type: String, required: false },
    gemini_model: { type: String, required: false },
    gemini_api_key2: { type: String, required: false },
    gemini_model2: { type: String, required: false },
    testDomain: { type: String, required: false },
  },
  { timestamps: true },
);

const Setting = model("Setting", SettingSchema);

module.exports = Setting;
