// services/appleAuthService.js
const axios = require("axios");
const jwt = require("jsonwebtoken");

const User = require("../models/UserModel"); // ✅ adjust path to your User model
const { generateAppleClientSecret } = require("../utils/appleClientSecret"); // ✅ adjust path
const { getJose, getAppleJwks } = require("../utils/appleJose"); // ✅ adjust path
const { makeUsernameFromEmail } = require("../utils/makeUsername"); // ✅ adjust path

const appleLoginService = async ({ code, roleId }) => {
    const JWT_SECRET = 'jwttoken';
    if (!code) throw new Error("authorization code is required");

  const clientSecret = generateAppleClientSecret();

  const tokenResponse = await axios.post(
    "https://appleid.apple.com/auth/token",
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.APPLE_CLIENT_ID,
      client_secret: clientSecret,
      redirect_uri: process.env.APPLE_REDIRECT_URI, // ✅ must match exactly
    }).toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  const { id_token } = tokenResponse.data;
  if (!id_token) throw new Error("Apple id_token missing");

  const { jwtVerify } = await getJose();
  const APPLE_JWKS = await getAppleJwks();

  const { payload } = await jwtVerify(id_token, APPLE_JWKS, {
    issuer: "https://appleid.apple.com",
    audience: process.env.APPLE_CLIENT_ID,
  });

  const appleId = payload.sub;
  const email = payload.email || null;

  let user = await User.findOne({
    $or: [
      { appleId },
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
    throw new Error("User is disabled or deleted");
  }
  const appToken = jwt.sign(
    { id: user._id, email: user.email, roleId: user.roleId },
    JWT_SECRET, // ✅ important
    { expiresIn: "10d" }
  );

  return {
    token: appToken,
    user: {
      _id: user._id,
      email: user.email,
      username: user.username,
      roleId: user.roleId,
    },
  };
};

module.exports = appleLoginService;
