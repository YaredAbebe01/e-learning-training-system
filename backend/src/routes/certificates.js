const express = require("express");
const { authMiddleware } = require("../auth");
const { connectToDatabase } = require("../db");
const { Certificate, Course, Profile } = require("../models");

const router = express.Router();

router.get("/:certId", authMiddleware("learner"), async (req, res) => {
  await connectToDatabase();
  const cert = await Certificate.findById(req.params.certId).lean();
  if (!cert || String(cert.learner_id) !== String(req.user.id)) {
    return res.status(404).json({ error: "Certificate not found." });
  }

  const [course, profile] = await Promise.all([
    Course.findById(cert.course_id)
      .populate("instructor_id", "full_name")
      .lean(),
    Profile.findById(req.user.id, "full_name email").lean(),
  ]);

  res.json({
    cert: {
      ...cert,
      course: course ? { ...course, instructor: course.instructor_id } : null,
    },
    profile,
  });
});

module.exports = router;
