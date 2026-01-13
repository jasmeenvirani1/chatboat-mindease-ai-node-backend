const Setting = require("../models/SettingModel");
const fs = require("fs");
const path = require("path");
const logger = require("../helper/logger");

const SettingController = {
  // Fetch all settings
  index: async (req, res) => {
    try {
      const settings = await Setting.find();
      res.json({ settings });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Store new settings
  store: async (req, res) => {
    try {
      const {
        siteName,
        phone,
        address,
        aboutus,
        contactEmail,
        facebookLink,
        linkedinLink,
        instagramLink,
        twitterLink,
        copyrightYear,
        adminEmail,
        smtpHost,
        smtpPort,
        smtpUsername,
        smtpPassword,
        smtpFromEmail,
      } = req.body;

      const uploadDir = path.join(__dirname, "../public/uploads/settings");
      if (!fs.existsSync(uploadDir))
        fs.mkdirSync(uploadDir, { recursive: true });

      // Helper to safely rename file with deletion of existing one
      function handleFile(file, prefix, forceExt = null) {
        const originalExt = path.extname(file.originalname);
        const ext = forceExt || originalExt || ".png";
        const finalFileName = `${prefix}${ext}`;
        const newPath = path.join(uploadDir, finalFileName);

        // Delete old file if exists
        fs.readdirSync(uploadDir).forEach((f) => {
          if (f.startsWith(prefix)) fs.unlinkSync(path.join(uploadDir, f));
        });

        // ✅ Use file.path instead of guessing its folder
        fs.renameSync(file.path, newPath);

        return finalFileName;
      }

      // Handle uploads safely
      const headerFinal = handleFile(req.files.headerLogo[0], "headerLogo");
      const footerFinal = handleFile(req.files.footerLogo[0], "footerLogo");
      const faviconFinal = handleFile(req.files.favicon[0], "favicon", ".ico");

      const settings = new Setting({
        siteName,
        phone,
        address,
        aboutus,
        contactEmail,
        facebookLink,
        linkedinLink,
        instagramLink,
        twitterLink,
        copyrightYear,
        adminEmail,
        headerLogo: headerFinal,
        footerLogo: footerFinal,
        favicon: faviconFinal,
        smtpHost,
        smtpPort,
        smtpUsername,
        smtpPassword,
        smtpFromEmail,
      });

      await settings.save();
      logger.log("Settings created successfully");

      return res.json({ message: "Settings created successfully", settings });
    } catch (error) {
      logger.error("Error creating settings: " + error.message);
      return res.status(500).json({ error: error.message });
    }
  },

  // Update settings
  update: async (req, res) => {
    try {
      const { id } = req.params;
      let updateData = { ...req.body };

      const uploadDir = path.join(__dirname, "../public/uploads/settings");
      if (!fs.existsSync(uploadDir))
        fs.mkdirSync(uploadDir, { recursive: true });

      // ✅ Fetch existing settings
      const existingSetting = await Setting.findById(id);
      if (!existingSetting) {
        return res.status(404).json({ message: "Settings not found" });
      }

      // ✅ Handle headerLogo
      if (req.files?.headerLogo?.[0]) {
        const file = req.files.headerLogo[0];
        const finalName = "headerLogo.png";
        const oldPath = path.resolve(file.path);
        const newPath = path.join(uploadDir, finalName);

        // Delete old header logo if exists
        if (fs.existsSync(newPath)) fs.unlinkSync(newPath);

        fs.renameSync(oldPath, newPath);
        updateData.headerLogo = finalName;
      } else {
        updateData.headerLogo = existingSetting.headerLogo || "";
      }

      // ✅ Handle footerLogo
      if (req.files?.footerLogo?.[0]) {
        const file = req.files.footerLogo[0];
        const finalName = "footerLogo.png";
        const oldPath = path.resolve(file.path);
        const newPath = path.join(uploadDir, finalName);

        if (fs.existsSync(newPath)) fs.unlinkSync(newPath);

        fs.renameSync(oldPath, newPath);
        updateData.footerLogo = finalName;
      } else {
        updateData.footerLogo = existingSetting.footerLogo || "";
      }

      // ✅ Handle favicon
      if (req.files?.favicon?.[0]) {
        const file = req.files.favicon[0];
        const finalName = "favicon.ico";
        const oldPath = path.resolve(file.path);
        const newPath = path.join(uploadDir, finalName);

        // 🔒 Safely replace existing favicon
        if (fs.existsSync(newPath)) fs.unlinkSync(newPath);

        fs.renameSync(oldPath, newPath);
        updateData.favicon = finalName;
      } else {
        updateData.favicon = existingSetting.favicon || "";
      }

      // ✅ Update DB
      const settings = await Setting.findByIdAndUpdate(id, updateData, {
        new: true,
      });
      return res.json({ message: "Settings updated successfully", settings });
    } catch (error) {
      console.error("Error updating settings:", error);
      if (!res.headersSent) {
        return res.status(500).json({ error: error.message });
      }
    }
  },
};

module.exports = SettingController;
