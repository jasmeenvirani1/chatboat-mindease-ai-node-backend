const jwt = require("jsonwebtoken");

function generateAppleClientSecret() {
  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      iss: process.env.APPLE_TEAM_ID,
      iat: now,
      exp: now + 60 * 60 * 24 * 180, // valid for 180 days
      aud: "https://appleid.apple.com",
      sub: process.env.APPLE_CLIENT_ID,
    },
    process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    {
      algorithm: "ES256",
      keyid: process.env.APPLE_KEY_ID,
    }
  );
}

module.exports = { generateAppleClientSecret };
