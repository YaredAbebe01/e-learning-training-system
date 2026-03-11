const { Types } = require("mongoose");
const { PointTransaction } = require("./models");

async function awardPoints({ learnerId, courseId = null, points, sourceType, reasonKey, relatedType = null, relatedId = null, note = null, createdBy = null }) {
  if (!learnerId || !Number.isFinite(Number(points)) || Number(points) === 0) return null;

  try {
    const transaction = await PointTransaction.create({
      learner_id: learnerId,
      course_id: courseId || null,
      points: Number(points),
      source_type: sourceType,
      reason_key: reasonKey,
      related_type: relatedType,
      related_id: relatedId || null,
      note: note || null,
      created_by: createdBy || null,
    });
    return transaction.toObject();
  } catch (error) {
    if (error?.code === 11000 && reasonKey) {
      return PointTransaction.findOne({ reason_key: reasonKey }).lean();
    }
    throw error;
  }
}

async function awardPerfectLessonTestPoints({ learnerId, courseId, lessonTestId }) {
  return awardPoints({
    learnerId,
    courseId,
    points: 2,
    sourceType: "perfect_test",
    reasonKey: `perfect-test:${lessonTestId}:${learnerId}`,
    relatedType: "lesson_test",
    relatedId: lessonTestId,
    note: "100% score on a lesson test.",
  });
}

async function awardMilestonePassPoints({ learnerId, courseId, milestoneId, createdBy = null }) {
  await awardPoints({
    learnerId,
    courseId,
    points: 5,
    sourceType: "milestone_pass",
    reasonKey: `milestone-pass:${milestoneId}:${learnerId}`,
    relatedType: "milestone",
    relatedId: milestoneId,
    note: "Passed a course milestone.",
    createdBy,
  });

  await awardPoints({
    learnerId,
    courseId,
    points: 5,
    sourceType: "milestone_first_pass_bonus",
    reasonKey: `milestone-first-pass:${milestoneId}`,
    relatedType: "milestone",
    relatedId: milestoneId,
    note: "First learner to pass this milestone.",
    createdBy,
  });
}

async function getLearnerPointSummary(learnerId) {
  const normalizedLearnerId = Types.ObjectId.isValid(String(learnerId))
    ? new Types.ObjectId(String(learnerId))
    : learnerId;

  const [totals, recentRaw] = await Promise.all([
    PointTransaction.aggregate([
      { $match: { learner_id: normalizedLearnerId } },
      { $group: { _id: null, total: { $sum: "$points" } } },
    ]),
    PointTransaction.find({ learner_id: learnerId })
      .populate("course_id", "title")
      .sort({ created_at: -1 })
      .limit(8)
      .lean(),
  ]);

  return {
    total: totals?.[0]?.total || 0,
    recent: (recentRaw || []).map((transaction) => ({
      ...transaction,
      id: String(transaction._id),
      learner_id: String(transaction.learner_id),
      course_id: transaction.course_id?._id ? String(transaction.course_id._id) : transaction.course_id ? String(transaction.course_id) : null,
      course: transaction.course_id?._id ? transaction.course_id : null,
      created_by: transaction.created_by ? String(transaction.created_by) : null,
    })),
  };
}

module.exports = {
  awardPoints,
  awardPerfectLessonTestPoints,
  awardMilestonePassPoints,
  getLearnerPointSummary,
};