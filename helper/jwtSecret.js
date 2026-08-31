// Single source of truth for the app's JWT signing key.
//
// This used to be the hardcoded literal "jwttoken" duplicated across five
// files, which let anyone mint a token for any user id. Every consumer now
// reads it from here so it can only ever be configured in one place.
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Refusing to start without it.");
}

if (JWT_SECRET === "jwttoken") {
  throw new Error(
    "JWT_SECRET is still the old hardcoded default. Set a strong random value.",
  );
}

module.exports = JWT_SECRET;
