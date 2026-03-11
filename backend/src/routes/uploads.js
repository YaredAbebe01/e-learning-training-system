const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { authMiddleware } = require("../auth");
const { connectToDatabase } = require("../db");
const { Profile } = require("../models");

const router = express.Router();

cloudinary.config(
  process.env.CLOUDINARY_URL
    ? { secure: true }
    : {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      }
);

function assertCloudinaryConfig() {
  if (process.env.CLOUDINARY_URL) return null;
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return "Missing Cloudinary credentials. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.";
  }
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function isSupportedProfileImage(file) {
  return ["image/png", "image/jpeg", "image/jpg"].includes(file?.mimetype || "");
}

router.post("/profile-image", authMiddleware(), upload.single("image"), async (req, res) => {
  const configError = assertCloudinaryConfig();
  if (configError) return res.status(500).json({ error: configError });

  if (!req.file) return res.status(400).json({ error: "Profile image is required." });
  if (!isSupportedProfileImage(req.file)) {
    return res.status(400).json({ error: "Only JPG and PNG profile images are allowed." });
  }

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "learnhub/profile-images",
          resource_type: "image",
          public_id: `profile-${req.user.id}-${Date.now()}`,
          overwrite: true,
        },
        (err, uploadResult) => {
          if (err) return reject(err);
          return resolve(uploadResult);
        }
      );
      stream.end(req.file.buffer);
    });

    await connectToDatabase();
    const profile = await Profile.findByIdAndUpdate(
      req.user.id,
      { avatar_url: result.secure_url },
      { new: true }
    ).lean();

    return res.json({
      url: result.secure_url,
      profile: profile
        ? {
            ...profile,
            id: String(profile._id),
          }
        : null,
    });
  } catch (err) {
    const message = err && err.message ? err.message : "Failed to upload profile image.";
    return res.status(500).json({ error: message });
  }
});


router.post("/image", authMiddleware("instructor"), upload.single("image"), async (req, res) => {
  const configError = assertCloudinaryConfig();
  if (configError) return res.status(500).json({ error: configError });

  if (!req.file) return res.status(400).json({ error: "Image file is required." });
  if (!req.file.mimetype.startsWith("image/")) {
    return res.status(400).json({ error: "Only image files are allowed." });
  }

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "learnhub", resource_type: "image" },
        (err, uploadResult) => {
          if (err) return reject(err);
          return resolve(uploadResult);
        }
      );
      stream.end(req.file.buffer);
    });

    return res.json({ url: result.secure_url });
  } catch (err) {
    const message = err && err.message ? err.message : "Failed to upload image.";
    return res.status(500).json({ error: message });
  }
});


module.exports = router;
