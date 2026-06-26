require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const cookieParser = require("cookie-parser"); // ✅ ADD THIS
const { startDailyMessageCron } = require("./cron/HeadlineCron.js");
const adminRoutes = require("./Routes/adminRoutes");
const authRoutes = require("./Routes/authRoutes");
const paymentRoutes = require("./Routes/paymentRoutes");
const marriageVerdictRoutes = require("./Routes/marriageVerdictRoutes.js");
const { loadIndex, search, buildPrompt } = require("./helper/search.js");
const { startTrendingTopicsCron } = require("./cron/TrendingTopicsCron.js");

require("./db/db.js");
startDailyMessageCron();
startTrendingTopicsCron();
// Create Express app
const app = express();

// Middleware
// app.use(cors());
// server.js
app.use(cookieParser());

const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://192.168.1.114:3000",
    "http://localhost:3001",
    "http://192.168.1.114:3001",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options("*", cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/api/public", express.static(path.join(__dirname, "public")));

// Create HTTP server
const server = http.createServer(app);

loadIndex();

// Routes
app.use("/api/backend/marriage-verdict", marriageVerdictRoutes);
app.use("/api/backend", adminRoutes);
app.use("/api", authRoutes);
app.use("/api/payment", paymentRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ Server running on port ${PORT}`);
});
