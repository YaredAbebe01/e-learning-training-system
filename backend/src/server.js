require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const instructorRoutes = require("./routes/instructor");
const learnerRoutes = require("./routes/learner");
const quizRoutes = require("./routes/quizzes");
const certificateRoutes = require("./routes/certificates");
const uploadRoutes = require("./routes/uploads");
const { connectToDatabase } = require("./db");
const { Profile } = require("./models");

const app = express();
const port = process.env.PORT || 4000;

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/instructor", instructorRoutes);
app.use("/api/learner", learnerRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/uploads", uploadRoutes);

async function ensureAdminUser() {
  const email = "yaredoabebe07@gmail.com".toLowerCase().trim();
  const password = "12345678";
  const password_hash = await bcrypt.hash(password, 10);

  await connectToDatabase();
  await Profile.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        full_name: "Admin",
        password_hash,
        role: "admin",
        is_active: true,
      },
    },
    { upsert: true }
  );
}

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  ensureAdminUser().catch((err) => {
    console.error("Failed to ensure admin user:", err);
  });
});
