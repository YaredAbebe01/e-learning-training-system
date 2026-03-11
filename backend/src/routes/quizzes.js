const express = require("express");
const { authMiddleware } = require("../auth");
const { ensureCourseCompletion, getCourseAssessmentStatus } = require("../assessment-progress");
const { connectToDatabase } = require("../db");
const { Course, Enrollment, Quiz, QuizAttempt, QuizQuestion } = require("../models");

const router = express.Router();

router.get("/:quizId", authMiddleware(), async (req, res) => {
  await connectToDatabase();
  const quiz = await Quiz.findById(req.params.quizId).lean();
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });

  if (req.user?.role === "learner") {
    await ensureCourseCompletion(req.user.id, String(quiz.course_id));
  }

  const course = await Course.findById(quiz.course_id, "title").lean();
  const questions = await QuizQuestion.find({ quiz_id: req.params.quizId }).sort({ order_index: 1 }).lean();
  const latestAttempt = req.user?.role === "learner"
    ? await QuizAttempt.findOne({ quiz_id: req.params.quizId, learner_id: req.user.id }).sort({ created_at: -1 }).lean()
    : null;
  const resultAvailable = !quiz.is_final || !quiz.available_until || new Date() > new Date(quiz.available_until);
  const payloadQuestions = (questions || []).map((question) => ({
    ...question,
    id: String(question._id),
    quiz_id: String(question.quiz_id),
    correct_answer: quiz.is_final ? undefined : question.correct_answer,
  }));

  res.json({
    quiz: { ...quiz, id: String(quiz._id), course: course || null },
    questions: payloadQuestions,
    latest_attempt: latestAttempt
      ? {
          ...latestAttempt,
          score: resultAvailable ? latestAttempt.score : null,
          passed: resultAvailable ? latestAttempt.passed : null,
        }
      : null,
    result_available: resultAvailable,
  });
});

router.post("/:quizId/attempt", authMiddleware("learner"), async (req, res) => {
  await connectToDatabase();
  const quiz = await Quiz.findById(req.params.quizId).lean();
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });

  const enrollment = await Enrollment.findOne({ learner_id: req.user.id, course_id: quiz.course_id }).lean();
  if (!enrollment) return res.status(403).json({ error: "Enroll in the course to take this quiz." });

  if (quiz.is_final) {
    const status = await getCourseAssessmentStatus(req.user.id, String(quiz.course_id));
    if (!status.allModulesPassed) {
      return res.status(403).json({ error: "Finish all lessons, lesson tests, and module milestones before starting the final test." });
    }
  }

  const now = new Date();
  if (quiz.available_from && now < new Date(quiz.available_from)) {
    return res.status(403).json({ error: "Quiz is not open yet." });
  }
  if (quiz.available_until && now > new Date(quiz.available_until)) {
    return res.status(403).json({ error: "Quiz is closed." });
  }

  if (quiz.max_attempts) {
    const attemptsCount = await QuizAttempt.countDocuments({ quiz_id: quiz._id, learner_id: req.user.id });
    if (attemptsCount >= quiz.max_attempts) {
      return res.status(403).json({ error: "Maximum attempts reached." });
    }
  }

  const attempt = await QuizAttempt.create({
    quiz_id: req.params.quizId,
    learner_id: req.user.id,
    answers: {},
    started_at: new Date(),
  });

  res.json({ id: attempt.id });
});

router.put("/:quizId/attempt/:attemptId", authMiddleware("learner"), async (req, res) => {
  const body = req.body || {};
  await connectToDatabase();
  const quiz = await Quiz.findById(req.params.quizId).lean();
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });
  const attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, quiz_id: req.params.quizId, learner_id: req.user.id }).lean();
  if (!attempt) return res.status(404).json({ error: "Attempt not found." });

  const questions = await QuizQuestion.find({ quiz_id: req.params.quizId }).sort({ order_index: 1 }).lean();
  const answers = body.answers || {};
  let earned = 0;
  let total = 0;
  const gradedAnswers = {};

  for (const question of questions || []) {
    const questionId = String(question._id);
    total += Number(question.points) || 1;
    const userAnswer = answers[questionId] || "";
    let correct = false;
    if (question.question_type === "short_answer") {
      correct = userAnswer.toLowerCase().trim() === String(question.correct_answer || "").toLowerCase().trim();
    } else {
      correct = userAnswer === question.correct_answer;
    }
    if (correct) earned += Number(question.points) || 1;
    gradedAnswers[questionId] = {
      answer: userAnswer,
      correct,
      points: Number(question.points) || 1,
    };
  }

  const score = total > 0 ? Math.round((earned / total) * 100) : 0;
  const passed = score >= (quiz.passing_score || 70);

  await QuizAttempt.findByIdAndUpdate(req.params.attemptId, {
    answers,
    score,
    passed,
    completed_at: body.completed_at ? new Date(body.completed_at) : new Date(),
  });

  if (quiz.is_final && passed) {
    await ensureCourseCompletion(req.user.id, String(quiz.course_id));
  }

  const resultAvailable = !quiz.is_final || !quiz.available_until || new Date() > new Date(quiz.available_until);

  return res.json({
    ok: true,
    pending: !resultAvailable,
    result_available: resultAvailable,
    available_until: quiz.available_until || null,
    result: resultAvailable
      ? { score, passed, earned, total, gradedAnswers }
      : null,
  });
});

module.exports = router;
