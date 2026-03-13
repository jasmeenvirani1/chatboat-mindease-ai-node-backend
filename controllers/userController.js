const axios = require("axios");
const User = require("../models/UserModel");
const Setting = require("../models/SettingModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const logger = require("../helper/logger");
const TempOtp = require("../models/OTPmodel");
const { OAuth2Client } = require("google-auth-library");
const Chat = require("../models/ChatModel");
const { generateAppleClientSecret } = require("../utils/appleClientSecret");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = "jwttoken";

const makeUsernameFromEmail = (email) => {
  const base = (email || "user").split("@")[0];
  return base.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 20) || "user";
};
let _appleJwks = null;

async function getAppleJwks() {
  if (_appleJwks) return _appleJwks;
  const jose = await import("jose");
  _appleJwks = jose.createRemoteJWKSet(
    new URL("https://appleid.apple.com/auth/keys"),
  );
  return _appleJwks;
}

async function getJose() {
  return import("jose");
}

const userController = {
  loginUser: async (req, res) => {
    const { email, password, anonymousChatIds = [] } = req.body; // Add anonymousChatIds from frontend
    logger.log(`Login attempt by: ${email}`);

    try {
      // 🔍 Basic validation
      if (!email || !password) {
        return res.status(400).json({
          error: "Email and password are required",
        });
      }

      // 🔍 Find user by email
      const user = await User.findOne({
        email: new RegExp(`^${email}$`, "i"),
      });

      // ❌ User not found
      if (!user) {
        return res.status(404).json({
          error: "User not registered. Please sign up first.",
        });
      }

      // 🔐 Password check
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        logger.log(`Login failed: Incorrect password - ${email}`);
        return res.status(401).json({
          error: "Invalid credentials",
        });
      }

      // 🎯 Role check (optional but safe)
      // if (roleId && user.roleId !== roleId) {
      //   return res.status(403).json({
      //     error: "Invalid role for this account",
      //   });
      // }

      // 🔐 JWT token
      const token = jwt.sign(
        {
          id: user._id,
          email: user.email,
          roleId: user.roleId,
        },
        JWT_SECRET,
        { expiresIn: "10d" },
      );

      // ✅ If anonymous chat IDs provided, find and update them
      let migratedChats = [];
      if (anonymousChatIds && anonymousChatIds.length > 0) {
        try {
          // Find all anonymous chats
          const chats = await Chat.find({
            _id: { $in: anonymousChatIds },
            userId: { $exists: false }, // Only chats without userId (anonymous)
          });

          // Update each chat with user ID
          for (const chat of chats) {
            chat.userId = user._id;
            await chat.save();
            migratedChats.push(chat._id);
          }

          logger.log(
            `Migrated ${migratedChats.length} chats to user ${user._id}`,
          );
        } catch (migrationError) {
          logger.error("Error migrating anonymous chats:", migrationError);
          // Don't fail login if migration fails
        }
      }

      logger.log(`Login successful: ${email}`);

      // ✅ Success response - include migrated chats
      return res.status(200).json({
        message: "Login successful",
        token,
        user: {
          _id: user._id,
          email: user.email,
          username: user.username,
          mobileNo: user.mobileNo,
          preferredLanguage: user.preferredLanguage,
          roleId: user.roleId,
        },
        migratedChats: migratedChats, // Send back which chats were migrated
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
    const { roleId, email, username, password, mobileNo, preferredLanguage } =
      req.body;

    logger.log(`Registration attempt for ${email}`);

    try {
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      if (!roleId) {
        return res.status(400).json({ error: "Role is required" });
      }

      // 🔴 CHECK IF EMAIL ALREADY EXISTS
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        logger.log(`Registration failed: Email already exists - ${email}`);
        return res.status(400).json({
          error: "Email is already registered",
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
        roleId: roleId,
        email,
        username,
        password: hashedPassword,
        preferredLanguage,
        mobileNo,
      });

      await newUser.save();

      logger.log(`Registration successful for ${email}`);

      return res.status(201).json({
        message: "User registered successfully",
        userId: newUser._id,
        roleId: newUser.roleId,
      });
    } catch (error) {
      logger.error(`Registration error for ${email}`, error);
      return res.status(500).json({ error: error.message });
    }
  },

  googleLogin: async (req, res) => {
    try {
      const { idToken, roleId } = req.body;

      if (!idToken) {
        return res.status(400).json({ error: "idToken is required" });
      }

      // ✅ Verify token with Google
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        return res.status(401).json({ error: "Invalid Google token" });
      }

      const googleId = payload.sub;
      const email = payload.email;
      const emailVerified = payload.email_verified;
      const name = payload.name || "";
      const picture = payload.picture || "";

      if (!email || !emailVerified) {
        return res.status(401).json({ error: "Google email not verified" });
      }

      // ✅ Find user by email
      let user = await User.findOne({ email: new RegExp(`^${email}$`, "i") });

      // ✅ If not exists -> create user (no password)
      if (!user) {
        user = await User.create({
          roleId: roleId || 2,
          email,
          username: name || makeUsernameFromEmail(email),
          password: null,
          googleId: googleId || "",
          provider: "google",
          avatar: picture,
          isActive: true,
          isDeleted: false,
        });
      } else {
        // ✅ If user exists, link Google account (do not break existing local login)
        // (You can keep password login working as-is.)
        user.googleId = user.googleId || googleId || "";
        user.provider = user.provider || "google";
        user.avatar = user.avatar || picture;

        // optional: role check if you want strict roles
        // if (roleId && user.roleId !== roleId) {
        //   return res
        //     .status(403)
        //     .json({ error: "Invalid role for this account" });
        // }

        await user.save();
      }

      if (!user.isActive || user.isDeleted) {
        return res.status(403).json({ error: "User is disabled or deleted" });
      }

      // ✅ Issue SAME JWT as your normal login
      const token = jwt.sign(
        { id: user._id, email: user.email, roleId: user.roleId },
        JWT_SECRET,
        { expiresIn: "10d" },
      );

      return res.status(200).json({
        message: "Google login successful",
        token,
        user: {
          _id: user._id,
          email: user.email,
          username: user.username,
          roleId: user.roleId,
        },
      });
    } catch (error) {
      console.error("Google login error:", error);
      return res.status(500).json({
        error: "Google login failed",
        details: error.message,
      });
    }
  },

  appleLogin: async (req, res) => {
    try {
      const { code, roleId } = req.body;

      if (!code) {
        return res
          .status(400)
          .json({ error: "authorization code is required" });
      }

      // 🔐 Generate client_secret
      const clientSecret = await generateAppleClientSecret();

      // 🔁 Exchange code → tokens
      const tokenResponse = await axios.post(
        "https://appleid.apple.com/auth/token",
        new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: process.env.APPLE_CLIENT_ID,
          client_secret: clientSecret,
          redirect_uri: process.env.APPLE_REDIRECT_URI,
        }).toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      );

      const { id_token } = tokenResponse.data;
      if (!id_token) {
        return res.status(401).json({ error: "Apple id_token missing" });
      }

      // ✅ Verify id_token (jose loaded here)
      const jose = await getJose();
      const APPLE_JWKS = await getAppleJwks();

      const { payload } = await jose.jwtVerify(id_token, APPLE_JWKS, {
        issuer: "https://appleid.apple.com",
        audience: process.env.APPLE_CLIENT_ID,
      });

      const appleId = payload.sub;
      const email = payload.email || null;

      let user = await User.findOne({
        $or: [
          { appleId: appleId },
          ...(email ? [{ email: new RegExp(`^${email}$`, "i") }] : []),
        ],
      });

      if (!user) {
        user = await User.create({
          roleId: roleId ? Number(roleId) : 2,
          email: email || `${appleId}@apple.local`,
          username: email ? makeUsernameFromEmail(email) : "apple_user",
          password: null,
          appleId,
          provider: "apple",
          isActive: true,
          isDeleted: false,
        });
      } else {
        user.appleId = user.appleId || appleId;
        user.provider = "apple";
        await user.save();
      }

      if (!user.isActive || user.isDeleted) {
        return res.status(403).json({ error: "User is disabled or deleted" });
      }

      const appToken = jwt.sign(
        { id: user._id, email: user.email, roleId: user.roleId },
        JWT_SECRET,
        { expiresIn: "10d" },
      );

      return res.status(200).json({
        message: "Apple login successful",
        token: appToken,
        user: {
          _id: user._id,
          email: user.email,
          username: user.username,
          roleId: user.roleId,
        },
      });
    } catch (error) {
      console.error("Apple login error:", error.response?.data || error);
      return res.status(500).json({
        error: "Apple login failed",
        details: error.message,
      });
    }
  },

  appleStart: (req, res) => {
    const params = new URLSearchParams({
      response_type: "code",
      response_mode: "form_post",
      client_id: process.env.APPLE_CLIENT_ID,
      redirect_uri: process.env.APPLE_REDIRECT_URI, // must be frontend callback
      scope: "name email",
    });
    return res.redirect(
      `https://appleid.apple.com/auth/authorize?${params.toString()}`,
    );
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
      // gzrtvbeppsnwwbcd
      const supportPassword = process.env.SUPPORT_PASSWORD;

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
          { upsert: true, new: true },
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
    console.log("Password:", newPassword);

    try {
      if (!resetToken || !newPassword) {
        logger.log(`Password reset failed: Missing token or new password`);
        return res
          .status(400)
          .json({ error: "Reset token and new password are required" });
      }

      let decoded;
      try {
        const jwtkey = "jwttoken";
        decoded = jwt.verify(resetToken, jwtkey);
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
        `Fetched ${users.length} users. Filter: ${JSON.stringify(filter)}`,
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
        "name price desc isActive",
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
        },
      );

      if (!updatedUser) {
        logger.log(`Update failed: User not found - ID ${req.params.id}`);
        return res.status(404).json({ message: "User not found" });
      }

      logger.log(
        `Updated user: ${updatedUser.username} (ID: ${req.params.id})`,
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
        { new: true },
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
        { new: true },
      );

      if (!updatedUser) {
        logger.log(`Update failed: User not found - ID ${req.params.id}`);
        return res.status(404).json({ message: "User not found" });
      }

      logger.log(
        `Updated FCM token for user: ${updatedUser.name} (ID: ${req.params.id})`,
      );
      res.status(200).json(updatedUser);
    } catch (err) {
      logger.error(
        `Error updating FCM token for user ID ${req.params.id}`,
        err,
      );
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = userController;
