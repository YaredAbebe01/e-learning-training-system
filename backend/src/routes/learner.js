const express = require("express");
const { authMiddleware } = require("../auth");
const { connectToDatabase } = require("../db");
const { Certificate, Course, Enrollment, Lesson, LessonProgress, Module, Profile, Quiz, QuizAttempt, QuizQuestion } = require("../models");

const router = express.Router();

router.get("/dashboard", authMiddleware("learner"), async (req, res) => {
  await connectToDatabase();

  const [profile, enrollmentsRaw, certificatesRaw, lessonProgress] = await Promise.all([
    Profile.findById(req.user.id, "full_name email").lean(),
    Enrollment.find({ learner_id: req.user.id })
      .sort({ enrolled_at: -1 })
      .populate({
        path: "course_id",
        populate: { path: "instructor_id", select: "full_name" },
      })
      .lean(),
    Certificate.find({ learner_id: req.user.id })
      .populate("course_id", "title")
      .lean(),
    LessonProgress.find({ learner_id: req.user.id }).lean(),
  ]);

  const enrollments = (enrollmentsRaw || []).map((e) => ({
    ...e,
    id: String(e._id),
    course_id: String(e.course_id?._id || e.course_id),
    course: e.course_id
      ? {
          ...e.course_id,
          instructor: e.course_id.instructor_id,
        }
      : null,
  }));

  const certificates = (certificatesRaw || []).map((c) => ({
    ...c,
    id: String(c._id),
    course_id: String(c.course_id?._id || c.course_id),
    course: c.course_id || null,
  }));

  res.json({
    profile,
    enrollments,
    certificates,
    lessonProgress: lessonProgress || [],
  });
});

router.get("/courses", authMiddleware("learner"), async (req, res) => {
  await connectToDatabase();

  const query = { is_published: true };
  if (req.query.level && req.query.level !== "all") query.level = req.query.level;
  if (req.query.category) query.category = { $regex: req.query.category, $options: "i" };
  if (req.query.q) query.title = { $regex: req.query.q, $options: "i" };

  const coursesRaw = await Course.find(query)
    .sort({ created_at: -1 })
    .populate("instructor_id", "full_name")
    .lean();

  const courses = (coursesRaw || []).map((course) => ({
    ...course,
    id: String(course._id),
    instructor: course.instructor_id || null,
  }));

  const enrollments = await Enrollment.find({ learner_id: req.user.id }, "course_id").lean();
  const enrolledIds = enrollments?.map((e) => String(e.course_id)) || [];

  res.json({ courses, enrolledIds });
});

router.get("/my-learning", authMiddleware("learner"), async (req, res) => {
  await connectToDatabase();

  const enrollmentsRaw = await Enrollment.find({ learner_id: req.user.id })
    .sort({ enrolled_at: -1 })
    .populate({
      path: "course_id",
      populate: { path: "instructor_id", select: "full_name" },
    })
    .lean();

  const courseIds = (enrollmentsRaw || []).map((e) => e.course_id?._id).filter(Boolean);

  const [lessonsAgg, progressAgg] = await Promise.all([
    Lesson.aggregate([
      { $match: { course_id: { $in: courseIds } } },
      { $group: { _id: "$course_id", count: { $sum: 1 } } },
    ]),
    LessonProgress.aggregate([
      { $match: { learner_id: req.user.id, is_completed: true } },
      { $group: { _id: "$course_id", count: { $sum: 1 } } },
    ]),
  ]);

  const lessonsMap = new Map(lessonsAgg.map((l) => [String(l._id), l.count]));
  const completedMap = new Map(progressAgg.map((p) => [String(p._id), p.count]));

  const enrollments = (enrollmentsRaw || []).map((e) => ({
    ...e,
    id: String(e._id),
    course_id: String(e.course_id?._id || e.course_id),
    completedLessons: completedMap.get(String(e.course_id?._id || e.course_id)) || 0,
    course: e.course_id
      ? {
          ...e.course_id,
          instructor: e.course_id.instructor_id,
          lessonCount: lessonsMap.get(String(e.course_id._id)) || 0,
        }
      : null,
  }));

  res.json({ enrollments });
});

router.get("/progress", authMiddleware("learner"), async (req, res) => {
  await connectToDatabase();

  const [enrollmentsRaw, lessonProgress, attemptsRaw] = await Promise.all([
    Enrollment.find({ learner_id: req.user.id })
      .populate("course_id", "title level")
      .lean(),
    LessonProgress.find({ learner_id: req.user.id }).lean(),
    QuizAttempt.find({ learner_id: req.user.id })
      .sort({ started_at: -1 })
      .populate("quiz_id", "title")
      .lean(),
  ]);

  const courseIds = (enrollmentsRaw || []).map((e) => e.course_id?._id).filter(Boolean);
  const lessonsAgg = await Lesson.aggregate([
    { $match: { course_id: { $in: courseIds } } },
    { $group: { _id: "$course_id", count: { $sum: 1 } } },
  ]);
  const lessonsMap = new Map(lessonsAgg.map((l) => [String(l._id), l.count]));

  const enrollments = (enrollmentsRaw || []).map((e) => ({
    ...e,
    id: String(e._id),
    course_id: String(e.course_id?._id || e.course_id),
    course: e.course_id
      ? {
          ...e.course_id,
          lessonCount: lessonsMap.get(String(e.course_id._id)) || 0,
        }
      : null,
  }));

  const attempts = (attemptsRaw || []).map((a) => ({
    ...a,
    id: String(a._id),
    quiz_id: String(a.quiz_id?._id || a.quiz_id),
    quiz: a.quiz_id || null,
  }));

  res.json({
    enrollments,
    lessonProgress: lessonProgress || [],
    attempts,
  });
});

router.get("/certificates", authMiddleware("learner"), async (req, res) => {
  await connectToDatabase();

  const [certificatesRaw, profile] = await Promise.all([
    Certificate.find({ learner_id: req.user.id })
      .sort({ issued_at: -1 })
      .populate({
        path: "course_id",
        select: "title category level instructor_id",
        populate: { path: "instructor_id", select: "full_name" },
      })
      .lean(),
    Profile.findById(req.user.id, "full_name").lean(),
  ]);

  const certificates = (certificatesRaw || []).map((cert) => ({
    ...cert,
    id: String(cert._id),
    course_id: String(cert.course_id?._id || cert.course_id),
    course: cert.course_id
      ? {
          ...cert.course_id,
          instructor: cert.course_id.instructor_id,
        }
      : null,
  }));

  res.json({ certificates, profile });
});

router.post("/enroll", authMiddleware("learner"), async (req, res) => {
  const { courseId } = req.body || {};
  if (!courseId) return res.status(400).json({ error: "Missing course id." });

  await connectToDatabase();
  const course = await Course.findById(courseId).lean();
  if (!course || !course.is_published) return res.status(404).json({ error: "Course not found." });

  const existing = await Enrollment.findOne({ learner_id: req.user.id, course_id: courseId }).lean();
  if (!existing) {
    await Enrollment.create({ learner_id: req.user.id, course_id: courseId });
  }

  res.json({ ok: true });
});

router.get("/course-viewer/:courseId", authMiddleware("learner"), async (req, res) => {
  await connectToDatabase();
  const course = await Course.findById(req.params.courseId)
    .populate("instructor_id", "full_name")
    .lean();

  if (!course) return res.status(404).json({ error: "Course not found." });

  let enrollment = await Enrollment.findOne({ learner_id: req.user.id, course_id: req.params.courseId }).lean();
  if (!enrollment) {
    enrollment = await Enrollment.create({ learner_id: req.user.id, course_id: req.params.courseId });
  }

  const [modules, lessons, quizzes, lessonProgress] = await Promise.all([
    Module.find({ course_id: req.params.courseId }).sort({ order_index: 1 }).lean(),
    Lesson.find({ course_id: req.params.courseId }).sort({ order_index: 1 }).lean(),
    Quiz.find({ course_id: req.params.courseId }).lean(),
    LessonProgress.find({ learner_id: req.user.id, course_id: req.params.courseId }).lean(),
  ]);

  const lessonsByModule = new Map();
  for (const lesson of lessons) {
    const key = String(lesson.module_id);
    const list = lessonsByModule.get(key) || [];
    list.push(lesson);
    lessonsByModule.set(key, list);
  }

  const payloadModules = modules.map((mod) => ({
    ...mod,
    lessons: lessonsByModule.get(String(mod._id)) || [],
  }));

  const quizIds = quizzes.map((q) => q._id);
  const counts = await QuizQuestion.aggregate([
    { $match: { quiz_id: { $in: quizIds } } },
    { $group: { _id: "$quiz_id", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  const payloadQuizzes = quizzes.map((q) => ({
    ...q,
    quiz_questions: [{ count: countMap.get(String(q._id)) || 0 }],
  }));

  res.json({
    course: { ...course, instructor: course.instructor_id },
    modules: payloadModules,
    quizzes: payloadQuizzes,
    enrollment,
    lessonProgress,
  });
});

router.post("/lesson-complete", authMiddleware("learner"), async (req, res) => {
  const { courseId, lessonId } = req.body || {};
  if (!courseId || !lessonId) {
    return res.status(400).json({ error: "Missing course or lesson id." });
  }

  await connectToDatabase();
  await LessonProgress.findOneAndUpdate(
    { learner_id: req.user.id, lesson_id: lessonId },
    {
      learner_id: req.user.id,
      lesson_id: lessonId,
      course_id: courseId,
      is_completed: true,
      completed_at: new Date(),
    },
    { upsert: true, new: true }
  );

  const [totalLessons, completedLessons, enrollment] = await Promise.all([
    Lesson.countDocuments({ course_id: courseId }),
    LessonProgress.countDocuments({ learner_id: req.user.id, course_id: courseId, is_completed: true }),
    Enrollment.findOne({ learner_id: req.user.id, course_id: courseId }).lean(),
  ]);

  if (totalLessons > 0 && completedLessons >= totalLessons && enrollment && !enrollment.completed_at) {
    await Enrollment.findByIdAndUpdate(enrollment._id, { completed_at: new Date() });

    const existingCert = await Certificate.findOne({ learner_id: req.user.id, course_id: courseId }).lean();
    if (!existingCert) {
      const certNum = `CERT-${Date.now()}-${String(req.user.id).slice(0, 8).toUpperCase()}`;
      await Certificate.create({
        learner_id: req.user.id,
        course_id: courseId,
        certificate_number: certNum,
      });
    }
  }

  res.json({ ok: true });
});

module.exports = router;
