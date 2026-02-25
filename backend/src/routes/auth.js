const express = require("express");
const bcrypt = require("bcryptjs");
const { connectToDatabase } = require("../db");
const { Profile } = require("../models");
const { signToken, authMiddleware } = require("../auth");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { full_name, email, password, role } = req.body || {};
  if (!full_name || !email || !password) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  await connectToDatabase();
  const existing = await Profile.findOne({ email: String(email).toLowerCase().trim() }).lean();
  if (existing) return res.status(409).json({ error: "Email already registered." });

  const password_hash = await bcrypt.hash(password, 10);
  const profile = await Profile.create({
    full_name,
    email: String(email).toLowerCase().trim(),
    password_hash,
    role: role === "instructor" ? "instructor" : "learner",
    is_active: true,
  });

  const token = signToken(profile);
  res.cookie("auth_token", token, { httpOnly: true, sameSite: "lax" });
  return res.json({ id: String(profile._id), email: profile.email, role: profile.role });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password." });
  }

  await connectToDatabase();
  const profile = await Profile.findOne({ email: String(email).toLowerCase().trim() })
    .select("+password_hash")
    .lean();
  if (!profile || !profile.is_active) return res.status(401).json({ error: "Invalid credentials" });

  const matches = await bcrypt.compare(password, profile.password_hash);
  if (!matches) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken(profile);
  res.cookie("auth_token", token, { httpOnly: true, sameSite: "lax" });
  return res.json({ id: profile.id, email: profile.email, role: profile.role });
});

router.post("/logout", (req, res) => {
  res.clearCookie("auth_token");
  return res.json({ ok: true });
});

router.get("/me", authMiddleware(), async (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;
