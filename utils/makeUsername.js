function makeUsernameFromEmail(email) {
  return email.split("@")[0] + "_" + Math.floor(Math.random() * 10000);
}

module.exports = { makeUsernameFromEmail };
