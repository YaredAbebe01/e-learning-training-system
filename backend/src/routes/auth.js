const express = require("express");
const bcrypt = require("bcryptjs");
const { connectToDatabase } = require("../db");
const { Profile } = require("../models");
const { signToken, authMiddleware } = require("../auth");
const { getLearnerPointSummary } = require("../points");

const router = express.Router();

function getCookieOptions() {
  const secure = process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
  const sameSite = process.env.COOKIE_SAME_SITE || "lax";

  return {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
  };
}

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
    bio: null,
    is_active: true,
  });

  const token = signToken(profile);
  res.cookie("auth_token", token, getCookieOptions());
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
  res.cookie("auth_token", token, getCookieOptions());
  return res.json({ id: profile.id, email: profile.email, role: profile.role });
});

router.post("/logout", (req, res) => {
  res.clearCookie("auth_token", getCookieOptions());
  return res.json({ ok: true });
});

router.get("/me", authMiddleware(), async (req, res) => {
  await connectToDatabase();
  const profile = await Profile.findById(req.user.id).lean();
  if (!profile || !profile.is_active) return res.status(401).json({ error: "Unauthorized" });

  return res.json({
    user: {
      id: String(profile._id),
      email: profile.email,
      role: profile.role,
      name: profile.full_name || profile.email,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url || null,
      bio: profile.bio || null,
    },
  });
});

router.get("/profile", authMiddleware(), async (req, res) => {
  await connectToDatabase();
  const profile = await Profile.findById(req.user.id).lean();
  if (!profile || !profile.is_active) return res.status(404).json({ error: "Profile not found." });

  const points = profile.role === "learner" ? await getLearnerPointSummary(req.user.id) : { total: 0, recent: [] };

  res.json({
    profile: {
      ...profile,
      id: String(profile._id),
    },
    points,
  });
});

router.patch("/profile", authMiddleware(), async (req, res) => {
  const body = req.body || {};
  await connectToDatabase();

  const profile = await Profile.findById(req.user.id).lean();
  if (!profile || !profile.is_active) return res.status(404).json({ error: "Profile not found." });

  const nextEmail = body.email !== undefined ? String(body.email).toLowerCase().trim() : profile.email;
  if (!nextEmail) return res.status(400).json({ error: "Email is required." });
  if (!body.full_name?.trim()) return res.status(400).json({ error: "Full name is required." });

  const existing = await Profile.findOne({ email: nextEmail, _id: { $ne: req.user.id } }).lean();
  if (existing) return res.status(409).json({ error: "Email already registered." });

  const updated = await Profile.findByIdAndUpdate(
    req.user.id,
    {
      full_name: body.full_name.trim(),
      email: nextEmail,
      avatar_url: body.avatar_url?.trim() || null,
      bio: body.bio?.trim() || null,
    },
    { new: true }
  ).lean();

  const token = signToken(updated);
  res.cookie("auth_token", token, getCookieOptions());

  res.json({
    ok: true,
    profile: {
      ...updated,
      id: String(updated._id),
    },
  });
});

router.patch("/password", authMiddleware(), async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) {
    return res.status(400).json({ error: "Current password and new password are required." });
  }
  if (String(new_password).length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }

  await connectToDatabase();
  const profile = await Profile.findById(req.user.id).select("+password_hash");
  if (!profile || !profile.is_active) return res.status(404).json({ error: "Profile not found." });

  const matches = await bcrypt.compare(current_password, profile.password_hash);
  if (!matches) return res.status(400).json({ error: "Current password is incorrect." });

  profile.password_hash = await bcrypt.hash(new_password, 10);
  await profile.save();

  res.json({ ok: true });
});

module.exports = router;
