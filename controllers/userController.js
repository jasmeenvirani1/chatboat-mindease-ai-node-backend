const User = require("../models/UserModel");
const Setting = require("../models/SettingModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const logger = require("../helper/logger");
const TempOtp = require("../models/OTPmodel");
const JWT_SECRET = "jwttoken"; // Move to .env in production

const userController = {
  loginUser: async (req, res) => {
    const { email, password, roleId } = req.body;
    logger.log(`Login attempt by: ${email}`);

    try {
      // 🔍 Find user by email OR mobile
      let user = await User.findOne({
        $or: [{ email: new RegExp(`^${email}$`, "i") }, { mobileNo: email }],
      })
        .populate("categories", "name");

      // ❌ USER NOT FOUND
      if (!user) {
        return res.status(404).json({
          error: "User not registered. Please sign up first.",
        });
      }

      // ❌ INACTIVE USER
      if (!user.isActive) {
        return res.status(403).json({
          error: "Access denied. User is inactive.",
        });
      }

      // 🔐 PASSWORD CHECK
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        logger.log(`Login failed: Incorrect password - ${email}`);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // 🎯 ROLE RESOLUTION
      let finalRoleId;

      if (roleId) {
        // Role selected from frontend
        if (!user.roleId.includes(roleId)) {
          return res.status(403).json({
            error: "This role is not assigned to your account",
          });
        }
        finalRoleId = roleId;
      } else if (user.activeRoleId) {
        // Last logged-in role
        finalRoleId = user.activeRoleId;
      } else {
        // Fallback → first role
        finalRoleId = user.roleId[0];
      }

      // 🧠 Save last active role
      user.activeRoleId = finalRoleId;
      await user.save();

      // 🔑 Admin detection
      const setting = await Setting.findOne().sort({ created_at: -1 });
      const adminEmail = setting?.adminEmail?.toLowerCase();
      const isAdmin = adminEmail && user.email?.toLowerCase() === adminEmail;

      // 🔐 JWT TOKEN
      const token = jwt.sign(
        {
          id: user._id,
          email: user.email,
          roleId: finalRoleId,
          roles: user.roleId,
          isAdmin: isAdmin || false,
        },
        JWT_SECRET,
        { expiresIn: "10d" }
      );

      logger.log(`Login successful: ${email} | Role: ${finalRoleId}`);

      // ✅ SUCCESS RESPONSE
      return res.json({
        message: "Login successful",
        token,
        user: {
          _id: user._id,
          email: user.email,
          username: user.username,
          roleId: user.roleId,
          activeRoleId: finalRoleId,
          categories: user.categories,
          subscription: user.subscriptionId,
        },
      });
    } catch (error) {
      logger.error(`Login error for ${email}`, error);
      return res.status(500).json({
        error: "Login failed",
        details: error.message,
      });
    }
  },

  register: async (req, res) => {
    const {
      roleId,
      companyName,
      email,
      username,
      password,
      mobileNo,
      gstNumber,
      gstRegistrationDate,
      legalStatusOfFirm,
      annualTurnover,
      indiamartMemberSince,
      country,
      state,
      categories,
      city,
    } = req.body;

    logger.log(`Registration attempt for ${email}`);

    try {
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      if (!roleId) {
        return res.status(400).json({ error: "Role is required" });
      }

      let user = await User.findOne({ email });

      // -----------------------------
      // 🟢 USER EXISTS → ADD ROLE
      // -----------------------------
      if (user) {
        // ❌ Role already exists
        if (user.roleId?.includes(roleId)) {
          return res.status(400).json({
            error: "This role is already registered for this email",
          });
        }

        // ➕ Add new role
        user.roleId.push(roleId);
        user.activeRoleId = roleId;

        // Optional: update missing profile fields
        user.companyName = user.companyName || companyName;
        user.mobileNo = user.mobileNo || mobileNo;
        user.country = user.country || country;
        user.state = user.state || state;
        user.city = user.city || city;
        user.categories = user.categories?.length
          ? user.categories
          : categories;

        await user.save();

        logger.log(`Role ${roleId} added to existing user ${email}`);

        return res.status(200).json({
          message: "New role added successfully",
          userId: user._id,
          roleId: user.roleId,
          activeRoleId: user.activeRoleId,
        });
      }

      // -----------------------------
      // 🆕 NEW USER REGISTRATION
      // -----------------------------
      if (!username || !password) {
        return res.status(400).json({
          error: "Username and password are required for new registration",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = new User({
        roleIds: [roleId],
        activeRoleId: roleId,
        companyName,
        email,
        username,
        password: hashedPassword,
        mobileNo,
        gstNumber,
        gstRegistrationDate,
        legalStatusOfFirm,
        annualTurnover,
        indiamartMemberSince,
        country,
        state,
        categories,
        city,
      });

      await newUser.save();

      // 📧 Welcome email
      const roleType = roleId === 2 ? "Vendor" : "Buyer";
      await sendWelcomeEmail(email, username, roleType);

      logger.log(`Registration successful for ${email}`);

      return res.status(201).json({
        message: "User registered successfully",
        userId: newUser._id,
        roleId: newUser.roleId,
        activeRoleId: newUser.activeRoleId,
      });
    } catch (error) {
      logger.error(`Registration error for ${email}`, error);
      return res.status(500).json({ error: error.message });
    }
  },

  sendOtp: async (req, res) => {
    const { email } = req.body;
    console.log("email", email);

    try {
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const adminEmail = "viranijasmeen@gmail.com";
      const supportEmail = "viranijasmeen@gmail.com";
      const supportPassword = "gzrtvbeppsnwwbcd";

      const user = await User.findOne({ email: new RegExp(`^${email}$`, "i") });
      const isAdmin = email.toLowerCase() === adminEmail.toLowerCase();

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: supportEmail,
          pass: supportPassword,
        },
        tls: { rejectUnauthorized: false },
      });

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiry = Date.now() + 10 * 60 * 1000;

      if (user) {
        // Save OTP inside user document
        user.otp = otp;
        user.otpExpiry = otpExpiry;
        await user.save();
      } else {
        // Save OTP for unregistered emails
        await TempOtp.findOneAndUpdate(
          { email: email.toLowerCase() },
          { otp, otpExpiry },
          { upsert: true, new: true }
        );
      }

      // Send OTP email
      await transporter.sendMail({
        from: `"Support Team" <${supportEmail}>`,
        to: email,
        subject: "Your OTP Code",
        html: `<p>Your OTP is <strong>${otp}</strong>. Valid for 10 minutes.</p>`,
      });

      return res.json({ message: "OTP sent to your email" });
    } catch (error) {
      console.log("Error sending OTP:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  verifyOtp: async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    // Try matching registered user OTP
    let user = await User.findOne({
      email: email.toLowerCase(),
      otp,
      otpExpiry: { $gt: Date.now() },
    });

    if (!user) {
      // Check in TempOtp collection for unregistered email
      const tempOtp = await TempOtp.findOne({
        email: email.toLowerCase(),
        otp,
        otpExpiry: { $gt: Date.now() },
      });

      if (!tempOtp) {
        return res.status(400).json({ error: "Invalid or expired OTP" });
      }

      // Remove temp OTP so it cannot be reused
      await TempOtp.deleteOne({ email: email.toLowerCase() });

      return res.json({
        message: "OTP verified (unregistered email)",
        status: "UNREGISTERED_USER",
      });
    }

    // OTP matched for registered user
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    const resetToken = jwt.sign({ email: user.email }, JWT_SECRET, {
      expiresIn: "10m",
    });

    res.json({ message: "OTP verified", resetToken });
  },

  resetPasswordWithOtp: async (req, res) => {
    const { resetToken, newPassword } = req.body;
    logger.log(`Password reset attempt`);

    try {
      if (!resetToken || !newPassword) {
        logger.log(`Password reset failed: Missing token or new password`);
        return res
          .status(400)
          .json({ error: "Reset token and new password are required" });
      }

      let decoded;
      try {
        decoded = jwt.verify(resetToken, jwtKey);
      } catch (err) {
        logger.log(`Password reset failed: Invalid or expired reset token`);
        return res
          .status(401)
          .json({ error: "Invalid or expired reset token" });
      }

      const email = decoded.email;
      const user = await User.findOne({ email: new RegExp(`^${email}$`, "i") });

      if (!user) {
        logger.log(`Password reset failed: User not found - ${email}`);
        return res.status(404).json({ error: "User not found" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      logger.log(`Password reset successful for ${email}`);
      res.json({ message: "Password reset successful" });
    } catch (error) {
      logger.error(`Password reset error`, error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
  getAllUsers: async (req, res) => {
    try {
      const { roleId, search } = req.query;

      // 🧩 Build dynamic filter
      const filter = { isDeleted: false };

      if (roleId) {
        filter.roleId = Number(roleId);
      }

      // 🧩 Add search functionality
      if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim(), "i"); // Case-insensitive search

        // Search in multiple fields
        filter.$or = [
          { username: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
          { mobileNo: { $regex: searchRegex } },
          { country: { $regex: searchRegex } },
          { companyName: { $regex: searchRegex } },
          { city: { $regex: searchRegex } },
          { state: { $regex: searchRegex } },
        ];
      }

      // Fetch users + total count
      const [users, totalCount] = await Promise.all([
        User.find(filter),
        User.countDocuments(filter),
      ]);

      logger.log(
        `Fetched ${users.length} users. Filter: ${JSON.stringify(filter)}`
      );

      res.status(200).json({
        success: true,
        total: totalCount,
        data: users,
      });
    } catch (err) {
      logger.error("Error fetching all users", err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  getUserById: async (req, res) => {
    try {
      const user = await User.findById(req.params.id).populate(
        "name price desc isActive"
      );
      if (!user) {
        logger.log(`User not found: ID ${req.params.id}`);
        return res.status(404).json({ message: "User not found" });
      }

      logger.log(`Fetched user: ${user.name} (ID: ${req.params.id})`);
      res.status(200).json(user);
    } catch (err) {
      logger.error(`Error fetching user with ID ${req.params.id}`, err);
      res.status(500).json({ error: err.message });
    }
  },
  updateUser: async (req, res) => {
    try {
      const updateData = { ...req.body };

      // 🔹 If password field is present, hash it before updating
      if (updateData.password) {
        const hashedPassword = await bcrypt.hash(updateData.password, 10);
        updateData.password = hashedPassword;
      }

      // 🔹 (Optional) also support newPassword for password change API
      if (updateData.newPassword) {
        const hashedPassword = await bcrypt.hash(updateData.newPassword, 10);
        updateData.password = hashedPassword;
        delete updateData.newPassword; // remove it from update data
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        updateData,
        {
          new: true,
        }
      );

      if (!updatedUser) {
        logger.log(`Update failed: User not found - ID ${req.params.id}`);
        return res.status(404).json({ message: "User not found" });
      }

      logger.log(
        `Updated user: ${updatedUser.username} (ID: ${req.params.id})`
      );
      res.status(200).json(updatedUser);
    } catch (err) {
      logger.error(`Error updating user ID ${req.params.id}`, err);
      res.status(500).json({ error: err.message });
    }
  },
  deleteUser: async (req, res) => {
    try {
      const deletedUser = await User.findByIdAndDelete(
        req.params.id,
        { $set: { isDeleted: true } },
        { new: true }
      );
      if (!deletedUser) {
        logger.log(`Delete failed: User not found - ID ${req.params.id}`);
        return res.status(404).json({ message: "User not found" });
      }

      logger.log(`Deleted user: ${deletedUser.name} (ID: ${req.params.id})`);
      res.status(200).json({ message: "User deleted successfully" });
    } catch (err) {
      logger.error(`Error deleting user with ID ${req.params.id}`, err);
      res.status(500).json({ error: err.message });
    }
  },

  updatefcmToken: async (req, res) => {
    try {
      const { fcmToken } = req.body;

      if (!fcmToken) {
        return res.status(400).json({ message: "fcmToken is required" });
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        { fcmToken }, // Only update fcmToken
        { new: true }
      );

      if (!updatedUser) {
        logger.log(`Update failed: User not found - ID ${req.params.id}`);
        return res.status(404).json({ message: "User not found" });
      }

      logger.log(
        `Updated FCM token for user: ${updatedUser.name} (ID: ${req.params.id})`
      );
      res.status(200).json(updatedUser);
    } catch (err) {
      logger.error(
        `Error updating FCM token for user ID ${req.params.id}`,
        err
      );
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = userController;
