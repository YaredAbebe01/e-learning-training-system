const express = require("express");
const { authMiddleware } = require("../auth");
const { connectToDatabase } = require("../db");
const { Certificate, Course, Enrollment, Lesson, LessonProgress, Module, Profile, Quiz, QuizAttempt, QuizQuestion } = require("../models");

const router = express.Router();

router.get("/dashboard", authMiddleware("admin"), async (_req, res) => {
  await connectToDatabase();

  const [
    totalUsers,
    totalCourses,
    totalEnrollments,
    totalCertificates,
    recentUsersRaw,
    recentCoursesRaw,
  ] = await Promise.all([
    Profile.countDocuments(),
    Course.countDocuments(),
    Enrollment.countDocuments(),
    Certificate.countDocuments(),
    Profile.find().sort({ created_at: -1 }).limit(5).lean(),
    Course.find()
      .sort({ created_at: -1 })
      .limit(5)
      .populate("instructor_id", "full_name")
      .lean(),
  ]);

  const recentUsers = (recentUsersRaw || []).map((user) => ({
    ...user,
    id: String(user._id),
  }));

  const recentCourses = (recentCoursesRaw || []).map((course) => ({
    ...course,
    id: String(course._id),
    instructor: course.instructor_id || null,
  }));

  res.json({
    stats: {
      totalUsers: totalUsers || 0,
      totalCourses: totalCourses || 0,
      totalEnrollments: totalEnrollments || 0,
      totalCertificates: totalCertificates || 0,
    },
    recentUsers,
    recentCourses,
  });
});

router.get("/reports", authMiddleware("admin"), async (_req, res) => {
  await connectToDatabase();

  const [users, courses, enrollmentsRaw, certificatesRaw, attempts] = await Promise.all([
    Profile.find({}, "role created_at is_active").lean(),
    Course.find({}, "title level category is_published created_at").lean(),
    Enrollment.find({}, "enrolled_at completed_at course_id")
      .populate("course_id", "title")
      .lean(),
    Certificate.find({}, "issued_at course_id")
      .populate("course_id", "title")
      .lean(),
    QuizAttempt.find({}, "score passed completed_at").lean(),
  ]);

  const enrollments = (enrollmentsRaw || []).map((e) => ({
    ...e,
    id: String(e._id),
    course_id: String(e.course_id?._id || e.course_id),
    course: e.course_id || null,
  }));

  const certificates = (certificatesRaw || []).map((c) => ({
    ...c,
    id: String(c._id),
    course_id: String(c.course_id?._id || c.course_id),
    course: c.course_id || null,
  }));

  res.json({
    users: users || [],
    courses: courses || [],
    enrollments,
    certificates,
    attempts: attempts || [],
  });
});

router.get("/users", authMiddleware("admin"), async (_req, res) => {
  await connectToDatabase();
  const usersRaw = await Profile.find().sort({ created_at: -1 }).lean();
  const users = (usersRaw || []).map((user) => ({
    ...user,
    id: String(user._id),
  }));
  res.json({ users });
});

router.patch("/users", authMiddleware("admin"), async (req, res) => {
  const { id, role, is_active } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing user id." });

  await connectToDatabase();
  const update = {};
  if (role) update.role = role;
  if (typeof is_active === "boolean") update.is_active = is_active;
  if (!Object.keys(update).length) return res.status(400).json({ error: "No updates provided." });

  await Profile.findByIdAndUpdate(id, update);
  res.json({ ok: true });
});

router.delete("/users", authMiddleware("admin"), async (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing user id." });

  await connectToDatabase();
  await Profile.findByIdAndDelete(id);
  res.json({ ok: true });
});

router.get("/courses", authMiddleware("admin"), async (_req, res) => {
  await connectToDatabase();
  const courses = await Course.find()
    .sort({ created_at: -1 })
    .populate("instructor_id", "full_name email")
    .lean();

  const courseIds = courses.map((c) => c._id);
  const enrollAgg = await Enrollment.aggregate([
    { $match: { course_id: { $in: courseIds } } },
    { $group: { _id: "$course_id", count: { $sum: 1 } } },
  ]);
  const enrollMap = new Map(enrollAgg.map((e) => [String(e._id), e.count]));

  const payload = courses.map((c) => ({
    ...c,
    id: String(c._id),
    instructor: c.instructor_id,
    enrollmentCount: enrollMap.get(String(c._id)) || 0,
  }));

  res.json({ courses: payload });
});

router.patch("/courses", authMiddleware("admin"), async (req, res) => {
  const { id, is_published } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing course id." });

  await connectToDatabase();
  await Course.findByIdAndUpdate(id, { is_published: !!is_published });
  res.json({ ok: true });
});

router.delete("/courses", authMiddleware("admin"), async (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing course id." });

  await connectToDatabase();
  const quizzes = await Quiz.find({ course_id: id }, "_id").lean();
  const quizIds = quizzes.map((q) => q._id);

  await Promise.all([
    Lesson.deleteMany({ course_id: id }),
    LessonProgress.deleteMany({ course_id: id }),
    Module.deleteMany({ course_id: id }),
    Enrollment.deleteMany({ course_id: id }),
    Certificate.deleteMany({ course_id: id }),
    QuizAttempt.deleteMany({ quiz_id: { $in: quizIds } }),
    QuizQuestion.deleteMany({ quiz_id: { $in: quizIds } }),
    Quiz.deleteMany({ course_id: id }),
    Course.findByIdAndDelete(id),
  ]);

  res.json({ ok: true });
});

module.exports = router;
