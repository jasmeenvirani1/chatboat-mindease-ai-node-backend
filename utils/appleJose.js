const jose = require("jose");

let appleJWKS = null;

async function getJose() {
  return jose;
}

async function getAppleJwks() {
  if (!appleJWKS) {
    appleJWKS = jose.createRemoteJWKSet(
      new URL("https://appleid.apple.com/auth/keys")
    );
  }
  return appleJWKS;
}

module.exports = { getJose, getAppleJwks };
