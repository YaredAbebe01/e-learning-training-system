const express = require("express");
const { authMiddleware } = require("../auth");
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
  LessonTestQuestion,
  LessonTestAttempt,
  LessonTestSubmission,
  Milestone,
  MilestoneQuestion,
  MilestoneAttempt,
  MilestoneSubmission,
  PointTransaction,
} = require("../models");
const { ensureCourseCompletion } = require("../assessment-progress");
const { awardMilestonePassPoints, awardPoints } = require("../points");

const router = express.Router();

function asId(value) {
  if (!value) return null;
  return String(value._id || value);
}

function profileSummary(profile) {
  if (!profile) return null;
  if (profile._id) {
    return {
      id: String(profile._id),
      full_name: profile.full_name || "Learner",
      email: profile.email || "",
    };
  }
  return {
    id: String(profile),
    full_name: "Learner",
    email: "",
  };
}

function latestTimestamp(item, fields) {
  for (const field of fields) {
    const value = item?.[field];
    if (!value) continue;
    const date = new Date(value).getTime();
    if (!Number.isNaN(date)) return date;
  }
  return 0;
}

function pickLatestByAssessmentAndLearner(items, assessmentField, dateFields) {
  const map = new Map();
  for (const item of items || []) {
    const assessmentId = asId(item?.[assessmentField]);
    const learnerId = asId(item?.learner_id);
    if (!assessmentId || !learnerId) continue;
    const key = `${assessmentId}:${learnerId}`;
    const current = map.get(key);
    if (!current || latestTimestamp(item, dateFields) > latestTimestamp(current, dateFields)) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

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

  const [enrollmentsRaw, lessonProgress, pointTotals] = await Promise.all([
    Enrollment.find({ course_id: { $in: courseIds } })
      .populate("course_id", "title")
      .populate("learner_id", "full_name email")
      .lean(),
    LessonProgress.find({ course_id: { $in: courseIds } }, "is_completed course_id").lean(),
    PointTransaction.aggregate([
      { $match: { course_id: { $in: courseIds } } },
      {
        $group: {
          _id: "$learner_id",
          totalPoints: { $sum: "$points" },
          lastAwardedAt: { $max: "$created_at" },
        },
      },
      { $sort: { totalPoints: -1, lastAwardedAt: -1 } },
      { $limit: 10 },
    ]),
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
    learner_id: e.learner_id?._id ? String(e.learner_id._id) : String(e.learner_id),
    learner: e.learner_id?._id
      ? {
          id: String(e.learner_id._id),
          full_name: e.learner_id.full_name,
          email: e.learner_id.email || "",
        }
      : null,
  }));

  const topStudentIds = (pointTotals || []).map((entry) => entry._id);
  const topStudentProfiles = topStudentIds.length
    ? await Profile.find({ _id: { $in: topStudentIds } }, "full_name email").lean()
    : [];
  const topStudentProfileMap = new Map((topStudentProfiles || []).map((profile) => [String(profile._id), profile]));
  const topStudents = (pointTotals || []).map((entry, index) => {
    const profile = topStudentProfileMap.get(String(entry._id));
    return {
      rank: index + 1,
      learner: profile
        ? { id: String(profile._id), full_name: profile.full_name, email: profile.email }
        : { id: String(entry._id), full_name: "Learner", email: "" },
      totalPoints: entry.totalPoints || 0,
      lastAwardedAt: entry.lastAwardedAt || null,
    };
  });

  res.json({
    courses,
    enrollments,
    lessonProgress: lessonProgress || [],
    topStudents,
  });
});

router.post("/points/adjustments", authMiddleware("instructor"), async (req, res) => {
  const body = req.body || {};
  const points = Number(body.points);
  if (!body.learner_id || !body.course_id || !Number.isFinite(points) || points === 0) {
    return res.status(400).json({ error: "Learner, course, and a non-zero point value are required." });
  }

  await connectToDatabase();
  const course = await Course.findOne({ _id: body.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  const enrollment = await Enrollment.findOne({ learner_id: body.learner_id, course_id: body.course_id }).lean();
  if (!enrollment) return res.status(404).json({ error: "Learner is not enrolled in this course." });

  const transaction = await awardPoints({
    learnerId: body.learner_id,
    courseId: body.course_id,
    points,
    sourceType: "manual_adjustment",
    note: body.note?.trim() || null,
    createdBy: req.user.id,
  });

  res.json({
    ok: true,
    transaction: transaction
      ? {
          ...transaction,
          id: String(transaction._id || transaction.id),
          learner_id: String(transaction.learner_id),
          course_id: transaction.course_id ? String(transaction.course_id) : null,
          created_by: transaction.created_by ? String(transaction.created_by) : null,
        }
      : null,
  });
});

router.get("/submissions", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();

  const coursesRaw = await Course.find({ instructor_id: req.user.id }, "title").sort({ title: 1 }).lean();
  const courseIds = coursesRaw.map((course) => course._id);

  if (!courseIds.length) {
    return res.json({
      courses: [],
      learners: [],
      records: [],
      summary: { total: 0, pending_review: 0, passed: 0, failed: 0, project_links: 0 },
    });
  }

  const [modulesRaw, lessonsRaw, lessonTestsRaw, milestonesRaw, enrollmentsRaw] = await Promise.all([
    Module.find({ course_id: { $in: courseIds } }, "title course_id").lean(),
    Lesson.find({ course_id: { $in: courseIds } }, "title module_id course_id").lean(),
    LessonTest.find({ course_id: { $in: courseIds } }).lean(),
    Milestone.find({ course_id: { $in: courseIds } }).lean(),
    Enrollment.find({ course_id: { $in: courseIds } })
      .populate("learner_id", "full_name email")
      .lean(),
  ]);

  const lessonTestIds = lessonTestsRaw.map((item) => item._id);
  const milestoneIds = milestonesRaw.map((item) => item._id);

  const [lessonTestAttemptsRaw, lessonTestSubmissionsRaw, milestoneAttemptsRaw, milestoneSubmissionsRaw] = await Promise.all([
    lessonTestIds.length
      ? LessonTestAttempt.find({ lesson_test_id: { $in: lessonTestIds } })
          .populate("learner_id", "full_name email")
          .lean()
      : [],
    lessonTestIds.length
      ? LessonTestSubmission.find({ lesson_test_id: { $in: lessonTestIds } })
          .populate("learner_id", "full_name email")
          .lean()
      : [],
    milestoneIds.length
      ? MilestoneAttempt.find({ milestone_id: { $in: milestoneIds } })
          .populate("learner_id", "full_name email")
          .lean()
      : [],
    milestoneIds.length
      ? MilestoneSubmission.find({ milestone_id: { $in: milestoneIds } })
          .populate("learner_id", "full_name email")
          .populate("graded_by", "full_name email")
          .lean()
      : [],
  ]);

  const courseMap = new Map(coursesRaw.map((item) => [String(item._id), item]));
  const moduleMap = new Map(modulesRaw.map((item) => [String(item._id), item]));
  const lessonMap = new Map(lessonsRaw.map((item) => [String(item._id), item]));
  const lessonTestMap = new Map(lessonTestsRaw.map((item) => [String(item._id), item]));
  const milestoneMap = new Map(milestonesRaw.map((item) => [String(item._id), item]));

  const latestLessonTestAttempts = pickLatestByAssessmentAndLearner(
    lessonTestAttemptsRaw,
    "lesson_test_id",
    ["completed_at", "started_at", "updated_at", "created_at"]
  );
  const latestLessonTestSubmissions = pickLatestByAssessmentAndLearner(
    lessonTestSubmissionsRaw,
    "lesson_test_id",
    ["submitted_at", "updated_at", "created_at"]
  );
  const latestMilestoneAttempts = pickLatestByAssessmentAndLearner(
    milestoneAttemptsRaw,
    "milestone_id",
    ["completed_at", "started_at", "updated_at", "created_at"]
  );
  const latestMilestoneSubmissions = pickLatestByAssessmentAndLearner(
    milestoneSubmissionsRaw,
    "milestone_id",
    ["submitted_at", "updated_at", "created_at"]
  );

  const records = [];

  for (const attempt of latestLessonTestAttempts) {
    const test = lessonTestMap.get(asId(attempt.lesson_test_id));
    if (!test || test.test_type !== "mcq") continue;
    const lesson = lessonMap.get(asId(test.lesson_id));
    const moduleData = moduleMap.get(asId(test.module_id));
    const course = courseMap.get(asId(test.course_id));
    const learner = profileSummary(attempt.learner_id);
    records.push({
      id: `lesson-test-attempt-${attempt._id}`,
      record_id: String(attempt._id),
      assessment_id: asId(test._id),
      assessment_type: "lesson_test",
      assessment_label: "Lesson Test",
      format: "mcq",
      title: test.title,
      course_id: asId(test.course_id),
      course_title: course?.title || "Course",
      module_id: asId(test.module_id),
      module_title: moduleData?.title || "Module",
      lesson_id: asId(test.lesson_id),
      lesson_title: lesson?.title || "Lesson",
      learner_id: learner?.id || null,
      learner,
      score: attempt.score,
      passed: attempt.passed,
      status: attempt.passed === true ? "passed" : attempt.passed === false ? "failed" : "in_progress",
      status_label: attempt.passed === true ? "Passed" : attempt.passed === false ? "Failed" : "In progress",
      started_at: attempt.started_at,
      completed_at: attempt.completed_at,
      activity_at: attempt.completed_at || attempt.started_at || attempt.created_at,
      submission_url: null,
      review_status: null,
      feedback: null,
      graded_at: null,
      graded_by: null,
      can_grade: false,
    });
  }

  for (const submission of latestLessonTestSubmissions) {
    const test = lessonTestMap.get(asId(submission.lesson_test_id));
    if (!test || test.test_type !== "project") continue;
    const lesson = lessonMap.get(asId(test.lesson_id));
    const moduleData = moduleMap.get(asId(test.module_id));
    const course = courseMap.get(asId(test.course_id));
    const learner = profileSummary(submission.learner_id);
    records.push({
      id: `lesson-test-submission-${submission._id}`,
      record_id: String(submission._id),
      assessment_id: asId(test._id),
      assessment_type: "lesson_test",
      assessment_label: "Lesson Test",
      format: "project",
      title: test.title,
      course_id: asId(test.course_id),
      course_title: course?.title || "Course",
      module_id: asId(test.module_id),
      module_title: moduleData?.title || "Module",
      lesson_id: asId(test.lesson_id),
      lesson_title: lesson?.title || "Lesson",
      learner_id: learner?.id || null,
      learner,
      score: null,
      passed: null,
      status: "submitted",
      status_label: "Submitted",
      started_at: null,
      completed_at: null,
      activity_at: submission.submitted_at || submission.created_at,
      submission_url: submission.submission_url,
      review_status: null,
      feedback: null,
      graded_at: null,
      graded_by: null,
      can_grade: false,
    });
  }

  for (const attempt of latestMilestoneAttempts) {
    const milestone = milestoneMap.get(asId(attempt.milestone_id));
    if (!milestone || milestone.milestone_type !== "mcq") continue;
    const moduleData = moduleMap.get(asId(milestone.module_id));
    const course = courseMap.get(asId(milestone.course_id));
    const learner = profileSummary(attempt.learner_id);
    records.push({
      id: `milestone-attempt-${attempt._id}`,
      record_id: String(attempt._id),
      assessment_id: asId(milestone._id),
      assessment_type: "milestone",
      assessment_label: "Milestone",
      format: "mcq",
      title: milestone.title,
      course_id: asId(milestone.course_id),
      course_title: course?.title || "Course",
      module_id: asId(milestone.module_id),
      module_title: moduleData?.title || "Module",
      lesson_id: null,
      lesson_title: null,
      learner_id: learner?.id || null,
      learner,
      score: attempt.score,
      passed: attempt.passed,
      status: attempt.passed === true ? "passed" : attempt.passed === false ? "failed" : "in_progress",
      status_label: attempt.passed === true ? "Passed" : attempt.passed === false ? "Failed" : "In progress",
      started_at: attempt.started_at,
      completed_at: attempt.completed_at,
      activity_at: attempt.completed_at || attempt.started_at || attempt.created_at,
      submission_url: null,
      review_status: null,
      feedback: null,
      graded_at: null,
      graded_by: null,
      can_grade: false,
    });
  }

  for (const submission of latestMilestoneSubmissions) {
    const milestone = milestoneMap.get(asId(submission.milestone_id));
    if (!milestone || milestone.milestone_type !== "project") continue;
    const moduleData = moduleMap.get(asId(milestone.module_id));
    const course = courseMap.get(asId(milestone.course_id));
    const learner = profileSummary(submission.learner_id);
    const gradedBy = profileSummary(submission.graded_by);
    const reviewStatus = submission.review_status || "pending";
    const status = reviewStatus === "pending"
      ? "pending_review"
      : submission.passed === true
        ? "passed"
        : submission.passed === false
          ? "failed"
          : "submitted";
    records.push({
      id: `milestone-submission-${submission._id}`,
      record_id: String(submission._id),
      assessment_id: asId(milestone._id),
      assessment_type: "milestone",
      assessment_label: "Milestone",
      format: "project",
      title: milestone.title,
      course_id: asId(milestone.course_id),
      course_title: course?.title || "Course",
      module_id: asId(milestone.module_id),
      module_title: moduleData?.title || "Module",
      lesson_id: null,
      lesson_title: null,
      learner_id: learner?.id || null,
      learner,
      score: submission.score,
      passed: submission.passed,
      status,
      status_label: status === "pending_review" ? "Pending review" : status === "passed" ? "Passed" : status === "failed" ? "Needs retry" : "Submitted",
      started_at: null,
      completed_at: null,
      activity_at: submission.submitted_at || submission.created_at,
      submission_url: submission.submission_url,
      review_status: reviewStatus,
      feedback: submission.feedback || null,
      graded_at: submission.graded_at,
      graded_by: gradedBy,
      can_grade: reviewStatus === "pending",
      milestone_id: asId(milestone._id),
    });
  }

  records.sort((left, right) => new Date(right.activity_at || 0).getTime() - new Date(left.activity_at || 0).getTime());

  const learnersMap = new Map();
  for (const enrollment of enrollmentsRaw || []) {
    const learner = profileSummary(enrollment.learner_id);
    if (learner?.id && !learnersMap.has(learner.id)) {
      learnersMap.set(learner.id, learner);
    }
  }
  for (const record of records) {
    if (record.learner?.id && !learnersMap.has(record.learner.id)) {
      learnersMap.set(record.learner.id, record.learner);
    }
  }

  res.json({
    courses: coursesRaw.map((course) => ({ id: String(course._id), title: course.title })),
    learners: [...learnersMap.values()].sort((left, right) => left.full_name.localeCompare(right.full_name)),
    records,
    summary: {
      total: records.length,
      pending_review: records.filter((record) => record.status === "pending_review").length,
      passed: records.filter((record) => record.status === "passed").length,
      failed: records.filter((record) => record.status === "failed").length,
      project_links: records.filter((record) => record.format === "project" && record.submission_url).length,
    },
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
  const { title, description, category, level, thumbnail_url, credit_hours } = req.body || {};
  if (!title) return res.status(400).json({ error: "Title is required." });
  const normalizedCreditHours = Number(credit_hours);
  if (!Number.isFinite(normalizedCreditHours) || normalizedCreditHours <= 0) {
    return res.status(400).json({ error: "Credit hours are required." });
  }

  await connectToDatabase();
  const course = await Course.create({
    title,
    description: description || null,
    category: category || null,
    level: level || "beginner",
    credit_hours: normalizedCreditHours,
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

  const [modules, lessons, lessonTests, milestones] = await Promise.all([
    Module.find({ course_id: req.params.id }).sort({ order_index: 1 }).lean(),
    Lesson.find({ course_id: req.params.id }).sort({ order_index: 1 }).lean(),
    LessonTest.find({ course_id: req.params.id }).lean(),
    Milestone.find({ course_id: req.params.id }).sort({ order_index: 1 }).lean(),
  ]);

  const lessonTestIds = lessonTests.map((t) => t._id);
  const lessonTestCounts = lessonTestIds.length
    ? await LessonTestQuestion.aggregate([
        { $match: { lesson_test_id: { $in: lessonTestIds } } },
        { $group: { _id: "$lesson_test_id", count: { $sum: 1 } } },
      ])
    : [];
  const lessonTestCountMap = new Map(lessonTestCounts.map((c) => [String(c._id), c.count]));
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
      },
    ])
  );

  const milestoneIds = milestones.map((m) => m._id);
  const milestoneCounts = milestoneIds.length
    ? await MilestoneQuestion.aggregate([
        { $match: { milestone_id: { $in: milestoneIds } } },
        { $group: { _id: "$milestone_id", count: { $sum: 1 } } },
      ])
    : [];
  const milestoneCountMap = new Map(milestoneCounts.map((c) => [String(c._id), c.count]));
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
  if (body.credit_hours !== undefined) {
    const normalizedCreditHours = Number(body.credit_hours);
    if (!Number.isFinite(normalizedCreditHours) || normalizedCreditHours <= 0) {
      return res.status(400).json({ error: "Credit hours must be greater than zero." });
    }
    update.credit_hours = normalizedCreditHours;
  }
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
  const lessonTests = await LessonTest.find({ course_id: req.params.id }, "_id").lean();
  const lessonTestIds = lessonTests.map((t) => t._id);
  const milestones = await Milestone.find({ course_id: req.params.id }, "_id").lean();
  const milestoneIds = milestones.map((m) => m._id);

  await Promise.all([
    Lesson.deleteMany({ course_id: req.params.id }),
    LessonProgress.deleteMany({ course_id: req.params.id }),
    LessonTestAttempt.deleteMany({ lesson_test_id: { $in: lessonTestIds } }),
    LessonTestQuestion.deleteMany({ lesson_test_id: { $in: lessonTestIds } }),
    LessonTestSubmission.deleteMany({ lesson_test_id: { $in: lessonTestIds } }),
    LessonTest.deleteMany({ course_id: req.params.id }),
    MilestoneAttempt.deleteMany({ milestone_id: { $in: milestoneIds } }),
    MilestoneQuestion.deleteMany({ milestone_id: { $in: milestoneIds } }),
    MilestoneSubmission.deleteMany({ milestone_id: { $in: milestoneIds } }),
    Milestone.deleteMany({ course_id: req.params.id }),
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
  const { title, description, link_url, image_url } = req.body || {};
  if (!title) return res.status(400).json({ error: "Module title is required." });

  await connectToDatabase();
  const course = await Course.findOne({ _id: req.params.id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(404).json({ error: "Course not found." });

  const count = await Module.countDocuments({ course_id: req.params.id });
  const moduleDoc = await Module.create({
    course_id: req.params.id,
    title,
    description: description || null,
    link_url: link_url || null,
    image_url: image_url || null,
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
  const { module_id, title, subtitle, description, video_url, pdf_url, resource_url, resource_name, resource_type } = req.body || {};
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
    subtitle: subtitle || null,
    description: description || null,
    video_url: video_url || null,
    pdf_url: pdf_url || null,
    resource_url: resource_url || null,
    resource_name: resource_name || null,
    resource_type: resource_type || null,
    order_index: count,
  });

  res.json({ id: lesson.id });
});

router.patch("/courses/:id/lessons/:lessonId", authMiddleware("instructor"), async (req, res) => {
  const body = req.body || {};

  await connectToDatabase();
  const course = await Course.findOne({ _id: req.params.id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(404).json({ error: "Course not found." });

  const lesson = await Lesson.findOne({ _id: req.params.lessonId, course_id: req.params.id }).lean();
  if (!lesson) return res.status(404).json({ error: "Lesson not found." });

  let nextModuleId = lesson.module_id;
  if (body.module_id && String(body.module_id) !== String(lesson.module_id)) {
    const moduleDoc = await Module.findOne({ _id: body.module_id, course_id: req.params.id }).lean();
    if (!moduleDoc) return res.status(404).json({ error: "Module not found." });
    nextModuleId = moduleDoc._id;
  }

  const title = Object.prototype.hasOwnProperty.call(body, "title") ? String(body.title || "").trim() : lesson.title;
  if (!title) return res.status(400).json({ error: "Lesson title is required." });

  const update = {
    module_id: nextModuleId,
    title,
    subtitle: Object.prototype.hasOwnProperty.call(body, "subtitle") ? body.subtitle || null : lesson.subtitle,
    description: Object.prototype.hasOwnProperty.call(body, "description") ? body.description || null : lesson.description,
    video_url: Object.prototype.hasOwnProperty.call(body, "video_url") ? body.video_url || null : lesson.video_url,
    pdf_url: Object.prototype.hasOwnProperty.call(body, "pdf_url") ? body.pdf_url || null : lesson.pdf_url,
    resource_url: Object.prototype.hasOwnProperty.call(body, "resource_url") ? body.resource_url || null : lesson.resource_url,
    resource_name: Object.prototype.hasOwnProperty.call(body, "resource_name") ? body.resource_name || null : lesson.resource_name,
    resource_type: Object.prototype.hasOwnProperty.call(body, "resource_type") ? body.resource_type || null : lesson.resource_type,
  };

  const updatedLesson = await Lesson.findByIdAndUpdate(req.params.lessonId, update, { new: true }).lean();
  res.json({ id: String(updatedLesson._id) });
});

router.delete("/courses/:id/lessons/:lessonId", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();
  const course = await Course.findOne({ _id: req.params.id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(404).json({ error: "Course not found." });

  await Lesson.findByIdAndDelete(req.params.lessonId);
  res.json({ ok: true });
});

router.get("/lessons/:lessonId/test", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();
  const lesson = await Lesson.findById(req.params.lessonId).lean();
  if (!lesson) return res.status(404).json({ error: "Lesson not found." });

  const course = await Course.findOne({ _id: lesson.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  const test = await LessonTest.findOne({ lesson_id: lesson._id }).lean();
  if (!test) return res.json({ test: null, questions: [] });

  const questions = await LessonTestQuestion.find({ lesson_test_id: test._id }).sort({ order_index: 1 }).lean();
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

router.post("/lessons/:lessonId/test", authMiddleware("instructor"), async (req, res) => {
  const body = req.body || {};
  if (!body.title) return res.status(400).json({ error: "Test title is required." });

  await connectToDatabase();
  const lesson = await Lesson.findById(req.params.lessonId).lean();
  if (!lesson) return res.status(404).json({ error: "Lesson not found." });

  const course = await Course.findOne({ _id: lesson.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  const update = {
    title: body.title,
    description: body.description || null,
    test_type: body.test_type === "project" ? "project" : "mcq",
    passing_score: Number(body.passing_score) || 70,
    time_limit_minutes: body.time_limit_minutes ? Number(body.time_limit_minutes) : null,
    project_prompt: body.project_prompt || null,
    project_link: body.project_link || null,
  };

  const test = await LessonTest.findOneAndUpdate(
    { lesson_id: lesson._id },
    {
      ...update,
      course_id: lesson.course_id,
      module_id: lesson.module_id,
      lesson_id: lesson._id,
    },
    { upsert: true, new: true }
  );

  res.json({ id: String(test._id) });
});

router.delete("/lessons/:lessonId/test", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();
  const lesson = await Lesson.findById(req.params.lessonId).lean();
  if (!lesson) return res.status(404).json({ error: "Lesson not found." });

  const course = await Course.findOne({ _id: lesson.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  const test = await LessonTest.findOne({ lesson_id: lesson._id }).lean();
  if (!test) return res.json({ ok: true });

  await Promise.all([
    LessonTestAttempt.deleteMany({ lesson_test_id: test._id }),
    LessonTestSubmission.deleteMany({ lesson_test_id: test._id }),
    LessonTestQuestion.deleteMany({ lesson_test_id: test._id }),
    LessonTest.findByIdAndDelete(test._id),
  ]);

  res.json({ ok: true });
});

router.post("/lessons/:lessonId/test/questions", authMiddleware("instructor"), async (req, res) => {
  const body = req.body || {};
  if (!body.question_text || !Array.isArray(body.options) || body.options.length < 2) {
    return res.status(400).json({ error: "Question text and at least two options are required." });
  }

  await connectToDatabase();
  const lesson = await Lesson.findById(req.params.lessonId).lean();
  if (!lesson) return res.status(404).json({ error: "Lesson not found." });

  const course = await Course.findOne({ _id: lesson.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  const test = await LessonTest.findOne({ lesson_id: lesson._id }).lean();
  if (!test) return res.status(404).json({ error: "Lesson test not found." });

  const count = await LessonTestQuestion.countDocuments({ lesson_test_id: test._id });
  const question = await LessonTestQuestion.create({
    lesson_test_id: test._id,
    question_text: body.question_text,
    options: body.options,
    correct_answer: body.correct_answer || null,
    points: Number(body.points) || 1,
    order_index: count,
  });

  res.json({ id: String(question._id) });
});

router.patch("/lessons/:lessonId/test/questions/:questionId", authMiddleware("instructor"), async (req, res) => {
  const body = req.body || {};
  if (!body.question_text || !Array.isArray(body.options) || body.options.length < 2) {
    return res.status(400).json({ error: "Question text and at least two options are required." });
  }

  await connectToDatabase();
  const lesson = await Lesson.findById(req.params.lessonId).lean();
  if (!lesson) return res.status(404).json({ error: "Lesson not found." });

  const course = await Course.findOne({ _id: lesson.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  const test = await LessonTest.findOne({ lesson_id: lesson._id }).lean();
  if (!test) return res.status(404).json({ error: "Lesson test not found." });

  const question = await LessonTestQuestion.findOneAndUpdate(
    { _id: req.params.questionId, lesson_test_id: test._id },
    {
      question_text: body.question_text,
      options: body.options,
      correct_answer: body.correct_answer || null,
      points: Number(body.points) || 1,
    },
    { new: true }
  ).lean();

  if (!question) return res.status(404).json({ error: "Question not found." });
  res.json({ ok: true, question: { ...question, id: String(question._id) } });
});

router.delete("/lessons/:lessonId/test/questions/:questionId", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();
  const lesson = await Lesson.findById(req.params.lessonId).lean();
  if (!lesson) return res.status(404).json({ error: "Lesson not found." });

  const course = await Course.findOne({ _id: lesson.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  await LessonTestQuestion.findByIdAndDelete(req.params.questionId);
  res.json({ ok: true });
});

router.get("/modules/:moduleId/milestones", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();
  const moduleDoc = await Module.findById(req.params.moduleId).lean();
  if (!moduleDoc) return res.status(404).json({ error: "Module not found." });

  const course = await Course.findOne({ _id: moduleDoc.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  const milestones = await Milestone.find({ module_id: moduleDoc._id }).sort({ order_index: 1 }).lean();
  const milestoneIds = milestones.map((m) => m._id);
  const counts = milestoneIds.length
    ? await MilestoneQuestion.aggregate([
        { $match: { milestone_id: { $in: milestoneIds } } },
        { $group: { _id: "$milestone_id", count: { $sum: 1 } } },
      ])
    : [];
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  const payload = (milestones || []).map((m) => ({
    ...m,
    id: String(m._id),
    course_id: String(m.course_id),
    module_id: String(m.module_id),
    question_count: countMap.get(String(m._id)) || 0,
  }));

  res.json({ milestones: payload });
});

router.post("/modules/:moduleId/milestones", authMiddleware("instructor"), async (req, res) => {
  const body = req.body || {};
  if (!body.title) return res.status(400).json({ error: "Milestone title is required." });

  await connectToDatabase();
  const moduleDoc = await Module.findById(req.params.moduleId).lean();
  if (!moduleDoc) return res.status(404).json({ error: "Module not found." });

  const course = await Course.findOne({ _id: moduleDoc.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  const count = await Milestone.countDocuments({ module_id: moduleDoc._id });
  const milestone = await Milestone.create({
    course_id: moduleDoc.course_id,
    module_id: moduleDoc._id,
    title: body.title,
    description: body.description || null,
    milestone_type: body.milestone_type === "project" ? "project" : "mcq",
    project_link: body.project_link || null,
    order_index: count,
  });

  res.json({ id: String(milestone._id) });
});

router.patch("/modules/:moduleId/milestones/:milestoneId", authMiddleware("instructor"), async (req, res) => {
  const body = req.body || {};
  await connectToDatabase();
  const moduleDoc = await Module.findById(req.params.moduleId).lean();
  if (!moduleDoc) return res.status(404).json({ error: "Module not found." });

  const course = await Course.findOne({ _id: moduleDoc.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  const update = {};
  if (body.title !== undefined) update.title = body.title;
  if (body.description !== undefined) update.description = body.description || null;
  if (body.milestone_type !== undefined) update.milestone_type = body.milestone_type === "project" ? "project" : "mcq";
  if (body.project_link !== undefined) update.project_link = body.project_link || null;

  await Milestone.findOneAndUpdate({ _id: req.params.milestoneId, module_id: moduleDoc._id }, update);
  res.json({ ok: true });
});

router.delete("/modules/:moduleId/milestones/:milestoneId", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();
  const moduleDoc = await Module.findById(req.params.moduleId).lean();
  if (!moduleDoc) return res.status(404).json({ error: "Module not found." });

  const course = await Course.findOne({ _id: moduleDoc.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  await Promise.all([
    MilestoneAttempt.deleteMany({ milestone_id: req.params.milestoneId }),
    MilestoneSubmission.deleteMany({ milestone_id: req.params.milestoneId }),
    MilestoneQuestion.deleteMany({ milestone_id: req.params.milestoneId }),
    Milestone.findByIdAndDelete(req.params.milestoneId),
  ]);

  res.json({ ok: true });
});

router.get("/milestones/:milestoneId/questions", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();
  const milestone = await Milestone.findById(req.params.milestoneId).lean();
  if (!milestone) return res.status(404).json({ error: "Milestone not found." });

  const course = await Course.findOne({ _id: milestone.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  const questions = await MilestoneQuestion.find({ milestone_id: milestone._id }).sort({ order_index: 1 }).lean();
  res.json({ milestone: { ...milestone, id: String(milestone._id) }, questions });
});

router.post("/milestones/:milestoneId/questions", authMiddleware("instructor"), async (req, res) => {
  const body = req.body || {};
  if (!body.question_text || !Array.isArray(body.options) || body.options.length < 2) {
    return res.status(400).json({ error: "Question text and at least two options are required." });
  }

  await connectToDatabase();
  const milestone = await Milestone.findById(req.params.milestoneId).lean();
  if (!milestone) return res.status(404).json({ error: "Milestone not found." });

  const course = await Course.findOne({ _id: milestone.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  const count = await MilestoneQuestion.countDocuments({ milestone_id: milestone._id });
  const question = await MilestoneQuestion.create({
    milestone_id: milestone._id,
    question_text: body.question_text,
    options: body.options,
    correct_answer: body.correct_answer || null,
    points: Number(body.points) || 1,
    order_index: count,
  });

  res.json({ id: String(question._id) });
});

router.patch("/milestones/:milestoneId/questions/:questionId", authMiddleware("instructor"), async (req, res) => {
  const body = req.body || {};
  if (!body.question_text || !Array.isArray(body.options) || body.options.length < 2) {
    return res.status(400).json({ error: "Question text and at least two options are required." });
  }

  await connectToDatabase();
  const milestone = await Milestone.findById(req.params.milestoneId).lean();
  if (!milestone) return res.status(404).json({ error: "Milestone not found." });

  const course = await Course.findOne({ _id: milestone.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  const question = await MilestoneQuestion.findOneAndUpdate(
    { _id: req.params.questionId, milestone_id: milestone._id },
    {
      question_text: body.question_text,
      options: body.options,
      correct_answer: body.correct_answer || null,
      points: Number(body.points) || 1,
    },
    { new: true }
  ).lean();

  if (!question) return res.status(404).json({ error: "Question not found." });
  res.json({ ok: true, question: { ...question, id: String(question._id) } });
});

router.delete("/milestones/:milestoneId/questions/:questionId", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();
  const milestone = await Milestone.findById(req.params.milestoneId).lean();
  if (!milestone) return res.status(404).json({ error: "Milestone not found." });

  const course = await Course.findOne({ _id: milestone.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  await MilestoneQuestion.findByIdAndDelete(req.params.questionId);
  res.json({ ok: true });
});

router.get("/milestones/:milestoneId/submissions", authMiddleware("instructor"), async (req, res) => {
  await connectToDatabase();
  const milestone = await Milestone.findById(req.params.milestoneId).lean();
  if (!milestone) return res.status(404).json({ error: "Milestone not found." });

  const course = await Course.findOne({ _id: milestone.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  const submissions = await MilestoneSubmission.find({ milestone_id: milestone._id })
    .populate("learner_id", "full_name email")
    .sort({ submitted_at: -1 })
    .lean();

  res.json({
    submissions: (submissions || []).map((submission) => ({
      ...submission,
      id: String(submission._id),
      milestone_id: String(submission.milestone_id),
      learner_id: submission.learner_id?._id ? String(submission.learner_id._id) : String(submission.learner_id),
      learner: submission.learner_id?._id
        ? {
            id: String(submission.learner_id._id),
            full_name: submission.learner_id.full_name,
            email: submission.learner_id.email,
          }
        : null,
      graded_by: submission.graded_by ? String(submission.graded_by) : null,
    })),
  });
});

router.patch("/milestones/:milestoneId/submissions/:submissionId/grade", authMiddleware("instructor"), async (req, res) => {
  const body = req.body || {};
  if (body.passed === undefined) {
    return res.status(400).json({ error: "Pass or fail is required." });
  }

  await connectToDatabase();
  const milestone = await Milestone.findById(req.params.milestoneId).lean();
  if (!milestone) return res.status(404).json({ error: "Milestone not found." });

  const course = await Course.findOne({ _id: milestone.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  const submission = await MilestoneSubmission.findOneAndUpdate(
    { _id: req.params.submissionId, milestone_id: milestone._id },
    {
      review_status: "graded",
      score: body.score ?? null,
      passed: body.passed === true,
      feedback: body.feedback?.trim() || null,
      graded_at: new Date(),
      graded_by: req.user.id,
    },
    { new: true }
  )
    .populate("learner_id", "full_name email")
    .lean();

  if (!submission) return res.status(404).json({ error: "Submission not found." });

  if (submission.passed === true) {
    await awardMilestonePassPoints({
      learnerId: String(submission.learner_id?._id || submission.learner_id),
      courseId: String(milestone.course_id),
      milestoneId: String(milestone._id),
      createdBy: req.user.id,
    });
  }

  await ensureCourseCompletion(String(submission.learner_id?._id || submission.learner_id), String(milestone.course_id));

  res.json({
    ok: true,
    submission: {
      ...submission,
      id: String(submission._id),
      milestone_id: String(submission.milestone_id),
      learner_id: submission.learner_id?._id ? String(submission.learner_id._id) : String(submission.learner_id),
      learner: submission.learner_id?._id
        ? {
            id: String(submission.learner_id._id),
            full_name: submission.learner_id.full_name,
            email: submission.learner_id.email,
          }
        : null,
      graded_by: submission.graded_by ? String(submission.graded_by) : null,
    },
  });
});

router.get("/quizzes", authMiddleware("instructor"), async (req, res) => {
  try {
    await connectToDatabase();
    const courses = await Course.find({ instructor_id: req.user.id }, "title").lean();
    const courseIds = courses.map((c) => c._id);

    const quizzes = await Quiz.find({ course_id: { $in: courseIds } })
      .sort({ created_at: -1 })
      .lean();

    const quizIds = quizzes.map((q) => q._id);
    const counts = quizIds.length
      ? await QuizQuestion.aggregate([
          { $match: { quiz_id: { $in: quizIds } } },
          { $group: { _id: "$quiz_id", count: { $sum: 1 } } },
        ])
      : [];
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

    const courseMap = new Map(courses.map((c) => [String(c._id), c]));
    const payload = quizzes.map((q) => ({
      ...q,
      course: courseMap.get(String(q.course_id)) || null,
      quiz_questions: [{ count: countMap.get(String(q._id)) || 0 }],
    }));

    return res.json({ courses, quizzes: payload });
  } catch (err) {
    const message = err && err.message ? err.message : "Failed to load quizzes.";
    return res.status(500).json({ error: message });
  }
});

router.post("/quizzes", authMiddleware("instructor"), async (req, res) => {
  const { title, description, course_id, passing_score, time_limit_minutes, available_from, available_until, max_attempts, is_final } = req.body || {};
  if (!title || !course_id) return res.status(400).json({ error: "Title and course are required." });

  const isFinalQuiz = Boolean(is_final);

  const fromDate = available_from ? new Date(available_from) : null;
  const untilDate = available_until ? new Date(available_until) : null;
  if (fromDate && Number.isNaN(fromDate.getTime())) {
    return res.status(400).json({ error: "Invalid available from date." });
  }
  if (untilDate && Number.isNaN(untilDate.getTime())) {
    return res.status(400).json({ error: "Invalid available until date." });
  }
  if (fromDate && untilDate && fromDate > untilDate) {
    return res.status(400).json({ error: "Available until must be after available from." });
  }

  const maxAttemptsValue = max_attempts ? Number(max_attempts) : null;
  if (maxAttemptsValue !== null && (!Number.isFinite(maxAttemptsValue) || maxAttemptsValue < 1)) {
    return res.status(400).json({ error: "Max attempts must be a positive number." });
  }

  try {
    await connectToDatabase();
    const course = await Course.findOne({ _id: course_id, instructor_id: req.user.id }).lean();
    if (!course) return res.status(404).json({ error: "Course not found." });

    if (isFinalQuiz) {
      const existingFinal = await Quiz.findOne({ course_id, is_final: true }).lean();
      if (existingFinal) {
        return res.status(400).json({ error: "This course already has a final test." });
      }
    }

    const quiz = await Quiz.create({
      title,
      description: description || null,
      course_id,
      is_final: isFinalQuiz,
      passing_score: Number(passing_score) || 70,
      time_limit_minutes: isFinalQuiz && time_limit_minutes ? Number(time_limit_minutes) : null,
      available_from: isFinalQuiz ? fromDate : null,
      available_until: isFinalQuiz ? untilDate : null,
      max_attempts: isFinalQuiz ? maxAttemptsValue : null,
    });

    return res.json({ id: quiz.id });
  } catch (err) {
    const message = err && err.message ? err.message : "Failed to create quiz.";
    return res.status(500).json({ error: message });
  }
});

router.patch("/quizzes/:id", authMiddleware("instructor"), async (req, res) => {
  const { title, description, passing_score, time_limit_minutes, available_from, available_until, max_attempts, is_final } = req.body || {};
  if (!title) return res.status(400).json({ error: "Title is required." });

  const isFinalQuiz = Boolean(is_final);
  const fromDate = available_from ? new Date(available_from) : null;
  const untilDate = available_until ? new Date(available_until) : null;
  if (fromDate && Number.isNaN(fromDate.getTime())) {
    return res.status(400).json({ error: "Invalid available from date." });
  }
  if (untilDate && Number.isNaN(untilDate.getTime())) {
    return res.status(400).json({ error: "Invalid available until date." });
  }
  if (fromDate && untilDate && fromDate > untilDate) {
    return res.status(400).json({ error: "Available until must be after available from." });
  }

  const maxAttemptsValue = max_attempts ? Number(max_attempts) : null;
  if (maxAttemptsValue !== null && (!Number.isFinite(maxAttemptsValue) || maxAttemptsValue < 1)) {
    return res.status(400).json({ error: "Max attempts must be a positive number." });
  }

  try {
    await connectToDatabase();
    const quiz = await Quiz.findById(req.params.id).lean();
    if (!quiz) return res.status(404).json({ error: "Quiz not found." });

    const course = await Course.findOne({ _id: quiz.course_id, instructor_id: req.user.id }).lean();
    if (!course) return res.status(403).json({ error: "Forbidden" });

    if (isFinalQuiz) {
      const existingFinal = await Quiz.findOne({ course_id: quiz.course_id, is_final: true, _id: { $ne: quiz._id } }).lean();
      if (existingFinal) {
        return res.status(400).json({ error: "This course already has a final test." });
      }
    }

    await Quiz.findByIdAndUpdate(req.params.id, {
      title,
      description: description || null,
      is_final: isFinalQuiz,
      passing_score: Number(passing_score) || 70,
      time_limit_minutes: isFinalQuiz && time_limit_minutes ? Number(time_limit_minutes) : null,
      available_from: isFinalQuiz ? fromDate : null,
      available_until: isFinalQuiz ? untilDate : null,
      max_attempts: isFinalQuiz ? maxAttemptsValue : null,
    });

    return res.json({ ok: true });
  } catch (err) {
    const message = err && err.message ? err.message : "Failed to update quiz.";
    return res.status(500).json({ error: message });
  }
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

router.patch("/quizzes/:id/questions/:questionId", authMiddleware("instructor"), async (req, res) => {
  const body = req.body || {};
  if (!body.question_text) return res.status(400).json({ error: "Question text is required." });

  await connectToDatabase();
  const quiz = await Quiz.findById(req.params.id).lean();
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });

  const course = await Course.findOne({ _id: quiz.course_id, instructor_id: req.user.id }).lean();
  if (!course) return res.status(403).json({ error: "Forbidden" });

  const question = await QuizQuestion.findOneAndUpdate(
    { _id: req.params.questionId, quiz_id: req.params.id },
    {
      question_text: body.question_text,
      question_type: body.question_type || "mcq",
      options: body.options?.length ? body.options : null,
      correct_answer: body.correct_answer || null,
      points: Number(body.points) || 1,
    },
    { new: true }
  ).lean();

  if (!question) return res.status(404).json({ error: "Question not found." });
  res.json({ ok: true, question: { ...question, id: String(question._id) } });
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
