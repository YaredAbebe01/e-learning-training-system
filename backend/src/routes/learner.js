const express = require("express");
const { isValidObjectId } = require("mongoose");
const { authMiddleware } = require("../auth");
const { ensureCourseCompletion, lessonTestPassed, milestonePassed } = require("../assessment-progress");
const { connectToDatabase } = require("../db");
const {
  Certificate,
  Course,
  Enrollment,
  Lesson,
  LessonProgress,
  Module,
  Profile,
  Quiz,
  QuizAttempt,
  QuizQuestion,
  LessonTest,
  LessonTestAttempt,
  LessonTestQuestion,
  LessonTestSubmission,
  Milestone,
  MilestoneAttempt,
  MilestoneQuestion,
  MilestoneSubmission,
} = require("../models");
const { awardMilestonePassPoints, awardPerfectLessonTestPoints, getLearnerPointSummary } = require("../points");

const router = express.Router();

function hasValidObjectId(value) {
  return typeof value === "string" && isValidObjectId(value);
}

function formatMilestoneSubmission(submission) {
  if (!submission) return null;
  return {
    ...submission,
    id: String(submission._id),
    milestone_id: String(submission.milestone_id),
    learner_id: String(submission.learner_id),
    graded_by: submission.graded_by ? String(submission.graded_by) : null,
  };
}

function buildPreferredAttemptMap(items, keyField) {
  const map = new Map();
  for (const item of items || []) {
    const key = String(item[keyField]);
    const current = map.get(key);
    if (!current || item.passed === true) {
      map.set(key, item);
      if (item.passed === true) continue;
    }
  }
  return map;
}

router.get("/dashboard", authMiddleware("learner"), async (req, res) => {
  await connectToDatabase();

  const [profile, enrollmentsRaw, certificatesRaw, lessonProgress, pointSummary] = await Promise.all([
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
    getLearnerPointSummary(req.user.id),
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
    points: pointSummary,
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
  if (!hasValidObjectId(courseId)) return res.status(400).json({ error: "Invalid course id." });

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
  if (!hasValidObjectId(req.params.courseId)) {
    return res.status(400).json({ error: "Invalid course id." });
  }

  await connectToDatabase();
  await ensureCourseCompletion(req.user.id, req.params.courseId);
  const course = await Course.findById(req.params.courseId)
    .populate("instructor_id", "full_name")
    .lean();

  if (!course) return res.status(404).json({ error: "Course not found." });

  let enrollment = await Enrollment.findOne({ learner_id: req.user.id, course_id: req.params.courseId }).lean();
  if (!enrollment) {
    enrollment = await Enrollment.create({ learner_id: req.user.id, course_id: req.params.courseId });
  }

  const [modules, lessons, quizzes, lessonProgress, lessonTests, milestones] = await Promise.all([
    Module.find({ course_id: req.params.courseId }).sort({ order_index: 1 }).lean(),
    Lesson.find({ course_id: req.params.courseId }).sort({ order_index: 1 }).lean(),
    Quiz.find({ course_id: req.params.courseId }).sort({ is_final: 1, created_at: -1 }).lean(),
    LessonProgress.find({ learner_id: req.user.id, course_id: req.params.courseId }).lean(),
    LessonTest.find({ course_id: req.params.courseId }).lean(),
    Milestone.find({ course_id: req.params.courseId }).sort({ order_index: 1 }).lean(),
  ]);

  const lessonTestIds = lessonTests.map((t) => t._id);
  const milestoneIds = milestones.map((m) => m._id);

  const [lessonTestAttempts, lessonTestSubmissions, milestoneAttempts, milestoneSubmissions] = await Promise.all([
    lessonTestIds.length
      ? LessonTestAttempt.find({ learner_id: req.user.id, lesson_test_id: { $in: lessonTestIds } }).sort({ created_at: -1 }).lean()
      : [],
    lessonTestIds.length
      ? LessonTestSubmission.find({ learner_id: req.user.id, lesson_test_id: { $in: lessonTestIds } }).lean()
      : [],
    milestoneIds.length
      ? MilestoneAttempt.find({ learner_id: req.user.id, milestone_id: { $in: milestoneIds } }).sort({ created_at: -1 }).lean()
      : [],
    milestoneIds.length
      ? MilestoneSubmission.find({ learner_id: req.user.id, milestone_id: { $in: milestoneIds } }).sort({ submitted_at: -1 }).lean()
      : [],
  ]);

  const lessonTestCounts = lessonTestIds.length
    ? await LessonTestQuestion.aggregate([
        { $match: { lesson_test_id: { $in: lessonTestIds } } },
        { $group: { _id: "$lesson_test_id", count: { $sum: 1 } } },
      ])
    : [];
  const lessonTestCountMap = new Map(lessonTestCounts.map((c) => [String(c._id), c.count]));
  const lessonTestAttemptMap = new Map();
  for (const attempt of lessonTestAttempts || []) {
    const key = String(attempt.lesson_test_id);
    const current = lessonTestAttemptMap.get(key);
    if (!current || attempt.passed === true) {
      lessonTestAttemptMap.set(key, attempt);
      if (attempt.passed === true) continue;
    }
  }
  const lessonTestSubmissionMap = new Map(
    (lessonTestSubmissions || []).map((s) => [String(s.lesson_test_id), s])
  );
  const lessonTestMap = new Map(
    (lessonTests || []).map((t) => [
      String(t.lesson_id),
      {
        ...t,
        id: String(t._id),
        course_id: String(t.course_id),
        module_id: String(t.module_id),
        lesson_id: String(t.lesson_id),
        question_count: lessonTestCountMap.get(String(t._id)) || 0,
        attempt: lessonTestAttemptMap.get(String(t._id)) || null,
        submission: lessonTestSubmissionMap.get(String(t._id)) || null,
      },
    ])
  );

  const milestoneCounts = milestoneIds.length
    ? await MilestoneQuestion.aggregate([
        { $match: { milestone_id: { $in: milestoneIds } } },
        { $group: { _id: "$milestone_id", count: { $sum: 1 } } },
      ])
    : [];
  const milestoneCountMap = new Map(milestoneCounts.map((c) => [String(c._id), c.count]));
  const milestoneAttemptMap = new Map();
  for (const attempt of milestoneAttempts || []) {
    const key = String(attempt.milestone_id);
    const current = milestoneAttemptMap.get(key);
    if (!current || attempt.passed === true) {
      milestoneAttemptMap.set(key, attempt);
      if (attempt.passed === true) continue;
    }
  }
  const milestoneSubmissionMap = new Map();
  for (const submission of milestoneSubmissions || []) {
    const key = String(submission.milestone_id);
    const current = milestoneSubmissionMap.get(key);
    if (!current || submission.passed === true || submission.review_status === "pending") {
      milestoneSubmissionMap.set(key, submission);
      if (submission.passed === true) continue;
    }
  }
  const milestonesByModule = new Map();
  for (const milestone of milestones || []) {
    const key = String(milestone.module_id);
    const list = milestonesByModule.get(key) || [];
    list.push({
      ...milestone,
      id: String(milestone._id),
      course_id: String(milestone.course_id),
      module_id: String(milestone.module_id),
      question_count: milestoneCountMap.get(String(milestone._id)) || 0,
      attempt: milestoneAttemptMap.get(String(milestone._id)) || null,
      submission: formatMilestoneSubmission(milestoneSubmissionMap.get(String(milestone._id)) || null),
    });
    milestonesByModule.set(key, list);
  }

  const normalizedLessons = (lessons || []).map((lesson) => ({
    ...lesson,
    id: String(lesson._id),
    module_id: String(lesson.module_id),
    course_id: String(lesson.course_id),
    lesson_test: lessonTestMap.get(String(lesson._id)) || null,
  }));

  const lessonsByModule = new Map();
  for (const lesson of normalizedLessons) {
    const key = String(lesson.module_id);
    const list = lessonsByModule.get(key) || [];
    list.push(lesson);
    lessonsByModule.set(key, list);
  }

  const payloadModules = (modules || []).map((mod) => ({
    ...mod,
    id: String(mod._id),
    course_id: String(mod.course_id),
    lessons: lessonsByModule.get(String(mod._id)) || [],
    milestones: milestonesByModule.get(String(mod._id)) || [],
  }));

  const quizIds = quizzes.map((q) => q._id);
  const [counts, quizAttempts] = await Promise.all([
    quizIds.length
      ? QuizQuestion.aggregate([
          { $match: { quiz_id: { $in: quizIds } } },
          { $group: { _id: "$quiz_id", count: { $sum: 1 } } },
        ])
      : [],
    quizIds.length
      ? QuizAttempt.find({ learner_id: req.user.id, quiz_id: { $in: quizIds } }).sort({ created_at: -1 }).lean()
      : [],
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  const latestAttemptMap = new Map();
  for (const attempt of quizAttempts || []) {
    const key = String(attempt.quiz_id);
    if (!latestAttemptMap.has(key)) latestAttemptMap.set(key, attempt);
  }

  const payloadQuizzes = (quizzes || []).map((q) => ({
    ...q,
    id: String(q._id),
    course_id: String(q.course_id),
    module_id: q.module_id ? String(q.module_id) : null,
    latest_attempt: latestAttemptMap.get(String(q._id)) || null,
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
  const { courseId, lessonId, completed } = req.body || {};
  if (!courseId || !lessonId) {
    return res.status(400).json({ error: "Missing course or lesson id." });
  }
  if (!hasValidObjectId(courseId) || !hasValidObjectId(lessonId)) {
    return res.status(400).json({ error: "Invalid course or lesson id." });
  }

  const isCompleted = completed !== undefined ? Boolean(completed) : true;

  await connectToDatabase();
  await LessonProgress.findOneAndUpdate(
    { learner_id: req.user.id, lesson_id: lessonId },
    {
      learner_id: req.user.id,
      lesson_id: lessonId,
      course_id: courseId,
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date() : null,
    },
    { upsert: true, new: true }
  );

  await ensureCourseCompletion(req.user.id, courseId);

  res.json({ ok: true, completed: isCompleted });
});

router.get("/lesson-tests/:testId", authMiddleware("learner"), async (req, res) => {
  await connectToDatabase();
  const test = await LessonTest.findById(req.params.testId).lean();
  if (!test) return res.status(404).json({ error: "Lesson test not found." });

  const enrollment = await Enrollment.findOne({ learner_id: req.user.id, course_id: test.course_id }).lean();
  if (!enrollment) return res.status(403).json({ error: "Enroll in the course to take this test." });

  const questions = test.test_type === "mcq"
    ? await LessonTestQuestion.find({ lesson_test_id: test._id }).sort({ order_index: 1 }).lean()
    : [];

  res.json({
    test: {
      ...test,
      id: String(test._id),
      course_id: String(test.course_id),
      module_id: String(test.module_id),
      lesson_id: String(test.lesson_id),
    },
    questions,
  });
});

router.post("/lesson-tests/:testId/attempt", authMiddleware("learner"), async (req, res) => {
  await connectToDatabase();
  const test = await LessonTest.findById(req.params.testId).lean();
  if (!test) return res.status(404).json({ error: "Lesson test not found." });
  if (test.test_type !== "mcq") return res.status(400).json({ error: "This lesson test does not use questions." });

  const enrollment = await Enrollment.findOne({ learner_id: req.user.id, course_id: test.course_id }).lean();
  if (!enrollment) return res.status(403).json({ error: "Enroll in the course to take this test." });

  const attempt = await LessonTestAttempt.create({
    lesson_test_id: test._id,
    learner_id: req.user.id,
    answers: {},
    started_at: new Date(),
  });

  res.json({ id: String(attempt._id) });
});

router.put("/lesson-tests/:testId/attempt/:attemptId", authMiddleware("learner"), async (req, res) => {
  const body = req.body || {};
  await connectToDatabase();
  const test = await LessonTest.findById(req.params.testId).lean();
  if (!test) return res.status(404).json({ error: "Lesson test not found." });

  const attempt = await LessonTestAttempt.findOne({ _id: req.params.attemptId, lesson_test_id: req.params.testId, learner_id: req.user.id }).lean();
  if (!attempt) return res.status(404).json({ error: "Attempt not found." });

  await LessonTestAttempt.findByIdAndUpdate(req.params.attemptId, {
    answers: body.answers || {},
    score: body.score ?? null,
    passed: body.passed ?? null,
    completed_at: body.completed_at ? new Date(body.completed_at) : new Date(),
  });

  if (Number(body.score) === 100) {
    await awardPerfectLessonTestPoints({
      learnerId: req.user.id,
      courseId: String(test.course_id),
      lessonTestId: String(test._id),
    });
  }

  await ensureCourseCompletion(req.user.id, String(test.course_id));

  res.json({ ok: true });
});

router.post("/lesson-tests/:testId/submit-project", authMiddleware("learner"), async (req, res) => {
  const { submission_url } = req.body || {};
  if (!submission_url) return res.status(400).json({ error: "Submission URL is required." });

  await connectToDatabase();
  const test = await LessonTest.findById(req.params.testId).lean();
  if (!test) return res.status(404).json({ error: "Lesson test not found." });
  if (test.test_type !== "project") return res.status(400).json({ error: "This lesson test is not project-based." });

  const enrollment = await Enrollment.findOne({ learner_id: req.user.id, course_id: test.course_id }).lean();
  if (!enrollment) return res.status(403).json({ error: "Enroll in the course to submit this project." });

  await LessonTestSubmission.findOneAndUpdate(
    { lesson_test_id: test._id, learner_id: req.user.id },
    { submission_url, submitted_at: new Date() },
    { upsert: true, new: true }
  );

  await ensureCourseCompletion(req.user.id, String(test.course_id));

  res.json({ ok: true });
});

router.get("/milestones/:milestoneId", authMiddleware("learner"), async (req, res) => {
  if (!hasValidObjectId(req.params.milestoneId)) {
    return res.status(400).json({ error: "Invalid milestone id." });
  }

  await connectToDatabase();
  const milestone = await Milestone.findById(req.params.milestoneId).lean();
  if (!milestone) return res.status(404).json({ error: "Milestone not found." });

  const enrollment = await Enrollment.findOne({ learner_id: req.user.id, course_id: milestone.course_id }).lean();
  if (!enrollment) return res.status(403).json({ error: "Enroll in the course to take this milestone." });

  const questions = milestone.milestone_type === "mcq"
    ? await MilestoneQuestion.find({ milestone_id: milestone._id }).sort({ order_index: 1 }).lean()
    : [];
  const [attempts, submission] = await Promise.all([
    milestone.milestone_type === "mcq"
      ? MilestoneAttempt.find({ milestone_id: milestone._id, learner_id: req.user.id }).sort({ created_at: -1 }).lean()
      : [],
    MilestoneSubmission.findOne({ milestone_id: milestone._id, learner_id: req.user.id }).sort({ submitted_at: -1 }).lean(),
  ]);

  let latestAttempt = null;
  for (const attempt of attempts || []) {
    if (!latestAttempt || attempt.passed === true) {
      latestAttempt = attempt;
      if (attempt.passed === true) break;
    }
  }

  const moduleLessons = await Lesson.find({ module_id: milestone.module_id }, "_id").lean();
  const moduleLessonIds = moduleLessons.map((lesson) => lesson._id);
  const moduleTests = await LessonTest.find({ module_id: milestone.module_id }).lean();
  const moduleTestIds = moduleTests.map((test) => test._id);
  const [totalLessons, completedLessons, moduleAttempts, moduleSubmissions] = await Promise.all([
    Lesson.countDocuments({ module_id: milestone.module_id }),
    LessonProgress.countDocuments({ learner_id: req.user.id, lesson_id: { $in: moduleLessonIds }, is_completed: true }),
    moduleTestIds.length
      ? LessonTestAttempt.find({ learner_id: req.user.id, lesson_test_id: { $in: moduleTestIds } }).sort({ created_at: -1 }).lean()
      : [],
    moduleTestIds.length
      ? LessonTestSubmission.find({ learner_id: req.user.id, lesson_test_id: { $in: moduleTestIds } }).lean()
      : [],
  ]);
  const attemptMap = buildPreferredAttemptMap(moduleAttempts, "lesson_test_id");
  const submissionMap = new Map((moduleSubmissions || []).map((submissionDoc) => [String(submissionDoc.lesson_test_id), submissionDoc]));
  const missingLessonTest = (moduleTests || []).find((test) =>
    !lessonTestPassed(test, attemptMap.get(String(test._id)), submissionMap.get(String(test._id)))
  );
  const lessonsComplete = totalLessons === 0 || completedLessons >= totalLessons;
  const unlocked = lessonsComplete && !missingLessonTest;
  const blockedReason = !lessonsComplete
    ? "Complete all lessons in the module before starting the milestone."
    : missingLessonTest
      ? "Pass all lesson tests in the module before starting the milestone."
      : null;
  const passed = milestonePassed(milestone, latestAttempt, submission);

  res.json({
    milestone: {
      ...milestone,
      id: String(milestone._id),
      course_id: String(milestone.course_id),
      module_id: String(milestone.module_id),
      passed,
    },
    questions,
    attempt: latestAttempt ? { ...latestAttempt, id: String(latestAttempt._id), milestone_id: String(latestAttempt.milestone_id), learner_id: String(latestAttempt.learner_id) } : null,
    submission: formatMilestoneSubmission(submission),
    unlocked,
    blocked_reason: blockedReason,
  });
});

router.post("/milestones/:milestoneId/attempt", authMiddleware("learner"), async (req, res) => {
  await connectToDatabase();
  const milestone = await Milestone.findById(req.params.milestoneId).lean();
  if (!milestone) return res.status(404).json({ error: "Milestone not found." });
  if (milestone.milestone_type !== "mcq") return res.status(400).json({ error: "This milestone does not use questions." });

  const enrollment = await Enrollment.findOne({ learner_id: req.user.id, course_id: milestone.course_id }).lean();
  if (!enrollment) return res.status(403).json({ error: "Enroll in the course to take this milestone." });

  const moduleLessons = await Lesson.find({ module_id: milestone.module_id }, "_id").lean();
  const moduleLessonIds = moduleLessons.map((l) => l._id);
  const moduleTests = await LessonTest.find({ module_id: milestone.module_id }).lean();
  const moduleTestIds = moduleTests.map((test) => test._id);
  const [totalLessons, completedLessons, moduleAttempts, moduleSubmissions] = await Promise.all([
    Lesson.countDocuments({ module_id: milestone.module_id }),
    LessonProgress.countDocuments({ learner_id: req.user.id, lesson_id: { $in: moduleLessonIds }, is_completed: true }),
    moduleTestIds.length
      ? LessonTestAttempt.find({ learner_id: req.user.id, lesson_test_id: { $in: moduleTestIds } }).lean()
      : [],
    moduleTestIds.length
      ? LessonTestSubmission.find({ learner_id: req.user.id, lesson_test_id: { $in: moduleTestIds } }).lean()
      : [],
  ]);
  if (totalLessons > 0 && completedLessons < totalLessons) {
    return res.status(403).json({ error: "Complete all lessons in the module before starting the milestone." });
  }

  const attemptMap = buildPreferredAttemptMap(moduleAttempts, "lesson_test_id");
  const submissionMap = new Map((moduleSubmissions || []).map((submission) => [String(submission.lesson_test_id), submission]));
  const missingLessonTest = (moduleTests || []).find((test) =>
    !lessonTestPassed(test, attemptMap.get(String(test._id)), submissionMap.get(String(test._id)))
  );
  if (missingLessonTest) {
    return res.status(403).json({ error: "Pass all lesson tests in the module before starting the milestone." });
  }

  const attempt = await MilestoneAttempt.create({
    milestone_id: milestone._id,
    learner_id: req.user.id,
    answers: {},
    started_at: new Date(),
  });

  res.json({ id: String(attempt._id) });
});

router.put("/milestones/:milestoneId/attempt/:attemptId", authMiddleware("learner"), async (req, res) => {
  const body = req.body || {};
  await connectToDatabase();
  const attempt = await MilestoneAttempt.findOne({ _id: req.params.attemptId, milestone_id: req.params.milestoneId, learner_id: req.user.id }).lean();
  if (!attempt) return res.status(404).json({ error: "Attempt not found." });

  await MilestoneAttempt.findByIdAndUpdate(req.params.attemptId, {
    answers: body.answers || {},
    score: body.score ?? null,
    passed: body.passed ?? null,
    completed_at: body.completed_at ? new Date(body.completed_at) : new Date(),
  });

  const milestone = await Milestone.findById(req.params.milestoneId).lean();
  if (milestone?.course_id) {
    if (body.passed === true) {
      await awardMilestonePassPoints({
        learnerId: req.user.id,
        courseId: String(milestone.course_id),
        milestoneId: String(milestone._id),
      });
    }
    await ensureCourseCompletion(req.user.id, String(milestone.course_id));
  }

  res.json({ ok: true });
});

router.post("/milestones/:milestoneId/submit-project", authMiddleware("learner"), async (req, res) => {
  const { submission_url } = req.body || {};
  if (!submission_url) return res.status(400).json({ error: "Submission URL is required." });

  await connectToDatabase();
  const milestone = await Milestone.findById(req.params.milestoneId).lean();
  if (!milestone) return res.status(404).json({ error: "Milestone not found." });
  if (milestone.milestone_type !== "project") return res.status(400).json({ error: "This milestone is not project-based." });

  const enrollment = await Enrollment.findOne({ learner_id: req.user.id, course_id: milestone.course_id }).lean();
  if (!enrollment) return res.status(403).json({ error: "Enroll in the course to submit this milestone." });

  const moduleLessons = await Lesson.find({ module_id: milestone.module_id }, "_id").lean();
  const moduleLessonIds = moduleLessons.map((l) => l._id);
  const [totalLessons, completedLessons] = await Promise.all([
    Lesson.countDocuments({ module_id: milestone.module_id }),
    LessonProgress.countDocuments({ learner_id: req.user.id, lesson_id: { $in: moduleLessonIds }, is_completed: true }),
  ]);
  if (totalLessons > 0 && completedLessons < totalLessons) {
    return res.status(403).json({ error: "Complete all lessons in the module before submitting the milestone." });
  }

  await MilestoneSubmission.findOneAndUpdate(
    { milestone_id: milestone._id, learner_id: req.user.id },
    {
      submission_url,
      submitted_at: new Date(),
      review_status: "pending",
      score: null,
      passed: null,
      feedback: null,
      graded_at: null,
      graded_by: null,
    },
    { upsert: true, new: true }
  );

  await ensureCourseCompletion(req.user.id, String(milestone.course_id));

  res.json({ ok: true });
});

module.exports = router;
