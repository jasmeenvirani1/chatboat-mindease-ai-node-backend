const mongoose = require("mongoose");

const mongoURI = process.env.MONGODB_URL; // Access MongoDB URL from environment variable
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const connection = mongoose.connection;
connection.once("open", () => {
  console.log("MongoDB connection established successfully");
});
