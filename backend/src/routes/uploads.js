const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { authMiddleware } = require("../auth");

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
