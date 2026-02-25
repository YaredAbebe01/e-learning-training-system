const express = require("express");
const { authMiddleware } = require("../auth");
const { connectToDatabase } = require("../db");
const { Certificate, Course, Enrollment, Lesson, LessonProgress, Module, Quiz, QuizAttempt, QuizQuestion } = require("../models");

const router = express.Router();

router.get("/dashboard", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();

  const coursesRaw = await Course.find({ instructor_id: req.user.id })
    .sort({ created_at: -1 })
    .lean();
  const courseIds = coursesRaw.map((c) => c._id);

  const [enrollmentsRaw, quizzes] = await Promise.all([
    Enrollment.find({ course_id: { $in: courseIds } })
      .populate("course_id", "title")
      .sort({ enrolled_at: -1 })
      .lean(),
    Quiz.find({ course_id: { $in: courseIds } }, "_id").lean(),
  ]);

  const quizIds = quizzes.map((q) => q._id);
  const attempts = await QuizAttempt.find({ quiz_id: { $in: quizIds } }, "score passed").lean();

  const enrollAgg = await Enrollment.aggregate([
    { $match: { course_id: { $in: courseIds } } },
    { $group: { _id: "$course_id", count: { $sum: 1 } } },
  ]);
  const enrollMap = new Map(enrollAgg.map((e) => [String(e._id), e.count]));

  const courses = coursesRaw.map((c) => ({
    ...c,
    id: String(c._id),
    enrollmentsCount: enrollMap.get(String(c._id)) || 0,
  }));

  const enrollments = (enrollmentsRaw || []).map((e) => ({
    ...e,
    id: String(e._id),
    course_id: String(e.course_id?._id || e.course_id),
    course: e.course_id || null,
  }));

  const totalEnrollments = enrollments.length;
  const avgScore = attempts?.length
    ? Math.round(attempts.reduce((sum, a) => sum + (a.score || 0), 0) / attempts.length)
    : 0;

  res.json({
    courses,
    enrollments,
    totalEnrollments,
    quizzesCount: quizzes?.length || 0,
    avgScore,
  });
});

router.get("/analytics", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();

  const coursesRaw = await Course.find({ instructor_id: req.user.id }, "title is_published").lean();
  const courseIds = coursesRaw.map((c) => c._id);

  const [enrollmentsRaw, attemptsRaw, lessonProgress] = await Promise.all([
    Enrollment.find({ course_id: { $in: courseIds } })
      .populate("course_id", "title")
      .populate("learner_id", "full_name")
      .lean(),
    QuizAttempt.find({ quiz_id: { $in: (await Quiz.find({ course_id: { $in: courseIds } }, "_id").lean()).map((q) => q._id) } })
      .populate("quiz_id", "title passing_score")
      .lean(),
    LessonProgress.find({ course_id: { $in: courseIds } }, "is_completed course_id").lean(),
  ]);

  const courses = (coursesRaw || []).map((c) => ({
    ...c,
    id: String(c._id),
  }));

  const enrollments = (enrollmentsRaw || []).map((e) => ({
    ...e,
    id: String(e._id),
    course_id: String(e.course_id?._id || e.course_id),
    course: e.course_id || null,
    learner: e.learner_id || null,
  }));

  const attempts = (attemptsRaw || []).map((a) => ({
    ...a,
    id: String(a._id),
    quiz_id: String(a.quiz_id?._id || a.quiz_id),
    quiz: a.quiz_id || null,
  }));

  res.json({
    courses,
    enrollments,
    attempts,
    lessonProgress: lessonProgress || [],
  });
});

router.get("/courses", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();

  const coursesRaw = await Course.find({ instructor_id: req.user.id })
    .sort({ created_at: -1 })
    .lean();
  const courseIds = coursesRaw.map((c) => c._id);

  const [modulesAgg, enrollmentsAgg] = await Promise.all([
    Module.aggregate([
      { $match: { course_id: { $in: courseIds } } },
      { $group: { _id: "$course_id", count: { $sum: 1 } } },
    ]),
    Enrollment.aggregate([
      { $match: { course_id: { $in: courseIds } } },
      { $group: { _id: "$course_id", count: { $sum: 1 } } },
    ]),
  ]);

  const modulesMap = new Map(modulesAgg.map((m) => [String(m._id), m.count]));
  const enrollMap = new Map(enrollmentsAgg.map((e) => [String(e._id), e.count]));

  const courses = coursesRaw.map((c) => ({
    ...c,
    id: String(c._id),
    modulesCount: modulesMap.get(String(c._id)) || 0,
    enrollmentsCount: enrollMap.get(String(c._id)) || 0,
  }));

  res.json({ courses });
});

router.post("/courses", authMiddleware("instructor"), async (req, res) => {
  const { title, description, category, level, thumbnail_url } = req.body || {};
  if (!title) return res.status(400).json({ error: "Title is required." });

  await connectToDatabase();
  const course = await Course.create({
    title,
    description: description || null,
    category: category || null,
    level: level || "beginner",
    thumbnail_url: thumbnail_url || null,
    instructor_id: req.user.id,
    is_published: false,
  });

  res.json({ id: course.id });
});

router.get("/courses/:id", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();
  const course = await Course.findOne({ _id: req.params.id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(404).json({ error: "Course not found." });

  const [modules, lessons] = await Promise.all([
    Module.find({ course_id: req.params.id }).sort({ order_index: 1 }).lean(),
    Lesson.find({ course_id: req.params.id }).sort({ order_index: 1 }).lean(),
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

  res.json({ course, modules: payloadModules });
});

router.patch("/courses/:id", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();
  const course = await Course.findOne({ _id: req.params.id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(404).json({ error: "Course not found." });

  const update = {};
  const body = req.body || {};
  if (body.title !== undefined) update.title = body.title;
  if (body.description !== undefined) update.description = body.description || null;
  if (body.category !== undefined) update.category = body.category || null;
  if (body.level !== undefined) update.level = body.level;
  if (body.thumbnail_url !== undefined) update.thumbnail_url = body.thumbnail_url || null;
  if (typeof body.is_published === "boolean") update.is_published = body.is_published;

  if (!Object.keys(update).length) return res.status(400).json({ error: "No updates provided." });
  await Course.findByIdAndUpdate(req.params.id, update);
  res.json({ ok: true });
});

router.delete("/courses/:id", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();
  const course = await Course.findOne({ _id: req.params.id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(404).json({ error: "Course not found." });

  const quizzes = await Quiz.find({ course_id: req.params.id }, "_id").lean();
  const quizIds = quizzes.map((q) => q._id);

  await Promise.all([
    Lesson.deleteMany({ course_id: req.params.id }),
    LessonProgress.deleteMany({ course_id: req.params.id }),
    Module.deleteMany({ course_id: req.params.id }),
    Enrollment.deleteMany({ course_id: req.params.id }),
    Certificate.deleteMany({ course_id: req.params.id }),
    QuizAttempt.deleteMany({ quiz_id: { $in: quizIds } }),
    QuizQuestion.deleteMany({ quiz_id: { $in: quizIds } }),
    Quiz.deleteMany({ course_id: req.params.id }),
    Course.findByIdAndDelete(req.params.id),
  ]);

  res.json({ ok: true });
});

router.post("/courses/:id/modules", authMiddleware("instructor"), async (req, res) => {
  const { title, description } = req.body || {};
  if (!title) return res.status(400).json({ error: "Module title is required." });

  await connectToDatabase();
  const course = await Course.findOne({ _id: req.params.id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(404).json({ error: "Course not found." });

  const count = await Module.countDocuments({ course_id: req.params.id });
  const moduleDoc = await Module.create({
    course_id: req.params.id,
    title,
    description: description || null,
    order_index: count,
  });

  res.json({ id: moduleDoc.id });
});

router.delete("/courses/:id/modules/:moduleId", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();
  const course = await Course.findOne({ _id: req.params.id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(404).json({ error: "Course not found." });

  await Promise.all([
    Lesson.deleteMany({ module_id: req.params.moduleId }),
    Module.findByIdAndDelete(req.params.moduleId),
  ]);

  res.json({ ok: true });
});

router.post("/courses/:id/lessons", authMiddleware("instructor"), async (req, res) => {
  const { module_id, title, description, video_url } = req.body || {};
  if (!module_id || !title) {
    return res.status(400).json({ error: "Module and title are required." });
  }

  await connectToDatabase();
  const course = await Course.findOne({ _id: req.params.id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(404).json({ error: "Course not found." });

  const moduleDoc = await Module.findOne({ _id: module_id, course_id: req.params.id }).lean();
  if (!moduleDoc) return res.status(404).json({ error: "Module not found." });

  const count = await Lesson.countDocuments({ module_id });
  const lesson = await Lesson.create({
    module_id,
    course_id: req.params.id,
    title,
    description: description || null,
    video_url: video_url || null,
    order_index: count,
  });

  res.json({ id: lesson.id });
});

router.delete("/courses/:id/lessons/:lessonId", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();
  const course = await Course.findOne({ _id: req.params.id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(404).json({ error: "Course not found." });

  await Lesson.findByIdAndDelete(req.params.lessonId);
  res.json({ ok: true });
});

router.get("/quizzes", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();
  const courses = await Course.find({ instructor_id: req.user.id }, "title").lean();
  const courseIds = courses.map((c) => c._id);

  const quizzes = await Quiz.find({ course_id: { $in: courseIds } })
    .sort({ created_at: -1 })
    .lean();
  const quizIds = quizzes.map((q) => q._id);
  const counts = await QuizQuestion.aggregate([
    { $match: { quiz_id: { $in: quizIds } } },
    { $group: { _id: "$quiz_id", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  const courseMap = new Map(courses.map((c) => [String(c._id), c]));
  const payload = quizzes.map((q) => ({
    ...q,
    course: courseMap.get(String(q.course_id)) || null,
    quiz_questions: [{ count: countMap.get(String(q._id)) || 0 }],
  }));

  res.json({ courses, quizzes: payload });
});

router.post("/quizzes", authMiddleware("instructor"), async (req, res) => {
  const { title, description, course_id, passing_score, time_limit_minutes } = req.body || {};
  if (!title || !course_id) return res.status(400).json({ error: "Title and course are required." });

  await connectToDatabase();
  const course = await Course.findOne({ _id: course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(404).json({ error: "Course not found." });

  const quiz = await Quiz.create({
    title,
    description: description || null,
    course_id,
    passing_score: Number(passing_score) || 70,
    time_limit_minutes: time_limit_minutes ? Number(time_limit_minutes) : null,
  });

  res.json({ id: quiz.id });
});

router.delete("/quizzes/:id", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();
  const quiz = await Quiz.findById(req.params.id).lean();
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });

  const course = await Course.findOne({ _id: quiz.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  await Promise.all([
    QuizAttempt.deleteMany({ quiz_id: req.params.id }),
    QuizQuestion.deleteMany({ quiz_id: req.params.id }),
    Quiz.findByIdAndDelete(req.params.id),
  ]);

  res.json({ ok: true });
});

router.get("/quizzes/:id/questions", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();
  const quiz = await Quiz.findById(req.params.id).lean();
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });

  const course = await Course.findOne({ _id: quiz.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  const questions = await QuizQuestion.find({ quiz_id: req.params.id }).sort({ order_index: 1 }).lean();
  res.json({ questions });
});

router.post("/quizzes/:id/questions", authMiddleware("instructor"), async (req, res) => {
  const body = req.body || {};
  if (!body.question_text) return res.status(400).json({ error: "Question text is required." });

  await connectToDatabase();
  const quiz = await Quiz.findById(req.params.id).lean();
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });

  const course = await Course.findOne({ _id: quiz.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  const count = await QuizQuestion.countDocuments({ quiz_id: req.params.id });
  const question = await QuizQuestion.create({
    quiz_id: req.params.id,
    question_text: body.question_text,
    question_type: body.question_type || "mcq",
    options: body.options?.length ? body.options : null,
    correct_answer: body.correct_answer || null,
    points: Number(body.points) || 1,
    order_index: count,
  });

  res.json({ id: question.id });
});

router.delete("/quizzes/:id/questions/:questionId", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();
  const quiz = await Quiz.findById(req.params.id).lean();
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });

  const course = await Course.findOne({ _id: quiz.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  await QuizQuestion.findByIdAndDelete(req.params.questionId);
  res.json({ ok: true });
});

module.exports = router;
