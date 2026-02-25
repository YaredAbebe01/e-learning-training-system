const express = require("express");
const { authMiddleware } = require("../auth");
const { connectToDatabase } = require("../db");
const { Course, Quiz, QuizAttempt, QuizQuestion } = require("../models");

const router = express.Router();

router.get("/:quizId", authMiddleware(), async (req, res) => {
  await connectToDatabase();
  const quiz = await Quiz.findById(req.params.quizId).lean();
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });

  const course = await Course.findById(quiz.course_id, "title").lean();
  const questions = await QuizQuestion.find({ quiz_id: req.params.quizId }).sort({ order_index: 1 }).lean();

  res.json({ quiz: { ...quiz, course: course || null }, questions });
});

router.post("/:quizId/attempt", authMiddleware("learner"), async (req, res) => {
  await connectToDatabase();
  const quiz = await Quiz.findById(req.params.quizId).lean();
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });

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
  const attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, quiz_id: req.params.quizId, learner_id: req.user.id }).lean();
  if (!attempt) return res.status(404).json({ error: "Attempt not found." });

  await QuizAttempt.findByIdAndUpdate(req.params.attemptId, {
    answers: body.answers || {},
    score: body.score ?? null,
    passed: body.passed ?? null,
    completed_at: body.completed_at ? new Date(body.completed_at) : new Date(),
  });

  res.json({ ok: true });
});

module.exports = router;
