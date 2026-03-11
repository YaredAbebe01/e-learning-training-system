const {
  Certificate,
  Enrollment,
  Lesson,
  LessonProgress,
  LessonTest,
  LessonTestAttempt,
  LessonTestSubmission,
  Milestone,
  MilestoneAttempt,
  MilestoneSubmission,
  Module,
  Quiz,
  QuizAttempt,
} = require("./models");

function lessonTestPassed(test, attempt, submission) {
  if (!test) return true;
  if (test.test_type === "project") return !!submission?.submission_url;
  return attempt?.passed === true && !!attempt?.completed_at;
}

function milestonePassed(milestone, attempt, submission) {
  if (!milestone) return true;
  if (milestone.milestone_type === "project") {
    return submission?.review_status === "graded" && submission?.passed === true;
  }
  return attempt?.passed === true && !!attempt?.completed_at;
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

function buildPreferredMilestoneSubmissionMap(items) {
  const map = new Map();
  for (const item of items || []) {
    const key = String(item.milestone_id);
    const current = map.get(key);
    if (!current || item.passed === true || item.review_status === "pending") {
      map.set(key, item);
      if (item.passed === true) continue;
    }
  }
  return map;
}

async function getCourseAssessmentStatus(learnerId, courseId) {
  const [
    modules,
    lessons,
    lessonProgress,
    lessonTests,
    lessonTestAttempts,
    lessonTestSubmissions,
    milestones,
    milestoneAttempts,
    milestoneSubmissions,
    finalQuiz,
    finalQuizAttempts,
  ] = await Promise.all([
    Module.find({ course_id: courseId }).sort({ order_index: 1 }).lean(),
    Lesson.find({ course_id: courseId }).sort({ order_index: 1 }).lean(),
    LessonProgress.find({ learner_id: learnerId, course_id: courseId }).lean(),
    LessonTest.find({ course_id: courseId }).lean(),
    LessonTestAttempt.find({ learner_id: learnerId }).lean(),
    LessonTestSubmission.find({ learner_id: learnerId }).lean(),
    Milestone.find({ course_id: courseId }).sort({ order_index: 1 }).lean(),
    MilestoneAttempt.find({ learner_id: learnerId }).lean(),
    MilestoneSubmission.find({ learner_id: learnerId }).lean(),
    Quiz.findOne({ course_id: courseId, is_final: true }).lean(),
    QuizAttempt.find({ learner_id: learnerId }).sort({ created_at: -1 }).lean(),
  ]);

  const progressMap = new Map((lessonProgress || []).map((entry) => [String(entry.lesson_id), entry]));
  const lessonTestByLesson = new Map((lessonTests || []).map((test) => [String(test.lesson_id), test]));
  const lessonTestAttemptById = buildPreferredAttemptMap(lessonTestAttempts, "lesson_test_id");
  const lessonTestSubmissionById = new Map((lessonTestSubmissions || []).map((submission) => [String(submission.lesson_test_id), submission]));

  const milestonesByModule = new Map();
  for (const milestone of milestones || []) {
    const key = String(milestone.module_id);
    const list = milestonesByModule.get(key) || [];
    list.push(milestone);
    milestonesByModule.set(key, list);
  }

  const milestoneAttemptById = buildPreferredAttemptMap(milestoneAttempts, "milestone_id");
  const milestoneSubmissionById = buildPreferredMilestoneSubmissionMap(milestoneSubmissions);

  const lessonsByModule = new Map();
  for (const lesson of lessons || []) {
    const key = String(lesson.module_id);
    const list = lessonsByModule.get(key) || [];
    list.push(lesson);
    lessonsByModule.set(key, list);
  }

  const allLessonsCompleted = (lessons || []).every((lesson) => progressMap.get(String(lesson._id))?.is_completed === true);
  const allLessonTestsPassed = (lessons || []).every((lesson) => {
    const test = lessonTestByLesson.get(String(lesson._id));
    if (!test) return true;
    return lessonTestPassed(
      test,
      lessonTestAttemptById.get(String(test._id)),
      lessonTestSubmissionById.get(String(test._id))
    );
  });

  const moduleStatuses = (modules || []).map((moduleDoc) => {
    const moduleLessons = lessonsByModule.get(String(moduleDoc._id)) || [];
    const moduleMilestones = milestonesByModule.get(String(moduleDoc._id)) || [];

    const lessonsComplete = moduleLessons.every((lesson) => progressMap.get(String(lesson._id))?.is_completed === true);
    const lessonTestsComplete = moduleLessons.every((lesson) => {
      const test = lessonTestByLesson.get(String(lesson._id));
      if (!test) return true;
      return lessonTestPassed(
        test,
        lessonTestAttemptById.get(String(test._id)),
        lessonTestSubmissionById.get(String(test._id))
      );
    });
    const milestonesComplete = moduleMilestones.every((milestone) =>
      milestonePassed(
        milestone,
        milestoneAttemptById.get(String(milestone._id)),
        milestoneSubmissionById.get(String(milestone._id))
      )
    );

    return {
      moduleId: String(moduleDoc._id),
      lessonsComplete,
      lessonTestsComplete,
      milestonesComplete,
      passed: lessonsComplete && lessonTestsComplete && milestonesComplete,
    };
  });

  const latestFinalAttempt = finalQuiz
    ? (finalQuizAttempts || []).find((attempt) => String(attempt.quiz_id) === String(finalQuiz._id)) || null
    : null;
  const finalQuizResultReleased = !finalQuiz?.available_until || new Date() > new Date(finalQuiz.available_until);

  return {
    allLessonsCompleted,
    allLessonTestsPassed,
    allModulesPassed: moduleStatuses.every((status) => status.passed),
    moduleStatuses,
    finalQuiz,
    finalQuizPassed: latestFinalAttempt?.passed === true,
    finalQuizResultReleased,
    latestFinalAttempt,
  };
}

async function ensureCourseCompletion(learnerId, courseId) {
  const [status, enrollment] = await Promise.all([
    getCourseAssessmentStatus(learnerId, courseId),
    Enrollment.findOne({ learner_id: learnerId, course_id: courseId }).lean(),
  ]);

  const canComplete = status.allModulesPassed && (!status.finalQuiz || (status.finalQuizPassed && status.finalQuizResultReleased));
  if (!canComplete || !enrollment) return status;

  if (!enrollment.completed_at) {
    await Enrollment.findByIdAndUpdate(enrollment._id, { completed_at: new Date() });
  }

  const existingCert = await Certificate.findOne({ learner_id: learnerId, course_id: courseId }).lean();
  if (!existingCert) {
    const certNum = `CERT-${Date.now()}-${String(learnerId).slice(0, 8).toUpperCase()}`;
    await Certificate.create({
      learner_id: learnerId,
      course_id: courseId,
      certificate_number: certNum,
    });
  }

  return status;
}

module.exports = {
  ensureCourseCompletion,
  getCourseAssessmentStatus,
  lessonTestPassed,
  milestonePassed,
};