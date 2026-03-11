const mongoose = require("mongoose");

const toJsonOptions = {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    if (ret._id) ret.id = String(ret._id);
    delete ret._id;
  },
};

function applyBaseSchema(schema) {
  schema.set("toJSON", toJsonOptions);
  schema.set("toObject", toJsonOptions);
}

const profileSchema = new mongoose.Schema(
  {
    full_name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password_hash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "instructor", "learner"], default: "learner" },
    avatar_url: { type: String, default: null },
    bio: { type: String, default: null },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
applyBaseSchema(profileSchema);

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: null },
    thumbnail_url: { type: String, default: null },
    instructor_id: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    category: { type: String, default: null },
    level: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "beginner" },
    credit_hours: { type: Number, default: null },
    is_published: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
applyBaseSchema(courseSchema);

const moduleSchema = new mongoose.Schema(
  {
    course_id: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    link_url: { type: String, default: null },
    image_url: { type: String, default: null },
    order_index: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
applyBaseSchema(moduleSchema);

const lessonSchema = new mongoose.Schema(
  {
    module_id: { type: mongoose.Schema.Types.ObjectId, ref: "Module", required: true, index: true },
    course_id: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    title: { type: String, required: true },
    subtitle: { type: String, default: null },
    description: { type: String, default: null },
    video_url: { type: String, default: null },
    pdf_url: { type: String, default: null },
    resource_url: { type: String, default: null },
    resource_name: { type: String, default: null },
    resource_type: { type: String, default: null },
    duration_seconds: { type: Number, default: 0 },
    order_index: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
applyBaseSchema(lessonSchema);

const enrollmentSchema = new mongoose.Schema(
  {
    learner_id: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    course_id: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    enrolled_at: { type: Date, default: () => new Date() },
    completed_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
applyBaseSchema(enrollmentSchema);

enrollmentSchema.index({ learner_id: 1, course_id: 1 }, { unique: true });

const lessonProgressSchema = new mongoose.Schema(
  {
    learner_id: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    lesson_id: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", required: true, index: true },
    course_id: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    is_completed: { type: Boolean, default: false },
    completed_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
applyBaseSchema(lessonProgressSchema);

lessonProgressSchema.index({ learner_id: 1, lesson_id: 1 }, { unique: true });

const quizSchema = new mongoose.Schema(
  {
    course_id: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    module_id: { type: mongoose.Schema.Types.ObjectId, ref: "Module", default: null },
    is_final: { type: Boolean, default: false },
    title: { type: String, required: true },
    description: { type: String, default: null },
    passing_score: { type: Number, default: 70 },
    time_limit_minutes: { type: Number, default: null },
    available_from: { type: Date, default: null },
    available_until: { type: Date, default: null },
    max_attempts: { type: Number, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
applyBaseSchema(quizSchema);

const quizQuestionSchema = new mongoose.Schema(
  {
    quiz_id: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
    question_text: { type: String, required: true },
    question_type: { type: String, enum: ["mcq", "true_false", "short_answer"], required: true },
    options: { type: [String], default: null },
    correct_answer: { type: String, default: null },
    points: { type: Number, default: 1 },
    order_index: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
applyBaseSchema(quizQuestionSchema);

const quizAttemptSchema = new mongoose.Schema(
  {
    quiz_id: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
    learner_id: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
    score: { type: Number, default: null },
    passed: { type: Boolean, default: null },
    started_at: { type: Date, default: () => new Date() },
    completed_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
applyBaseSchema(quizAttemptSchema);

const lessonTestSchema = new mongoose.Schema(
  {
    course_id: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    module_id: { type: mongoose.Schema.Types.ObjectId, ref: "Module", required: true, index: true },
    lesson_id: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    test_type: { type: String, enum: ["mcq", "project"], default: "mcq" },
    passing_score: { type: Number, default: 70 },
    time_limit_minutes: { type: Number, default: null },
    project_prompt: { type: String, default: null },
    project_link: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
applyBaseSchema(lessonTestSchema);

const lessonTestQuestionSchema = new mongoose.Schema(
  {
    lesson_test_id: { type: mongoose.Schema.Types.ObjectId, ref: "LessonTest", required: true, index: true },
    question_text: { type: String, required: true },
    options: { type: [String], default: [] },
    correct_answer: { type: String, default: null },
    points: { type: Number, default: 1 },
    order_index: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
applyBaseSchema(lessonTestQuestionSchema);

const lessonTestAttemptSchema = new mongoose.Schema(
  {
    lesson_test_id: { type: mongoose.Schema.Types.ObjectId, ref: "LessonTest", required: true, index: true },
    learner_id: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
    score: { type: Number, default: null },
    passed: { type: Boolean, default: null },
    started_at: { type: Date, default: () => new Date() },
    completed_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
applyBaseSchema(lessonTestAttemptSchema);

const lessonTestSubmissionSchema = new mongoose.Schema(
  {
    lesson_test_id: { type: mongoose.Schema.Types.ObjectId, ref: "LessonTest", required: true, index: true },
    learner_id: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    submission_url: { type: String, required: true },
    submitted_at: { type: Date, default: () => new Date() },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
applyBaseSchema(lessonTestSubmissionSchema);

const milestoneSchema = new mongoose.Schema(
  {
    course_id: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    module_id: { type: mongoose.Schema.Types.ObjectId, ref: "Module", required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    milestone_type: { type: String, enum: ["mcq", "project"], default: "mcq" },
    project_link: { type: String, default: null },
    order_index: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
applyBaseSchema(milestoneSchema);

const milestoneQuestionSchema = new mongoose.Schema(
  {
    milestone_id: { type: mongoose.Schema.Types.ObjectId, ref: "Milestone", required: true, index: true },
    question_text: { type: String, required: true },
    options: { type: [String], default: [] },
    correct_answer: { type: String, default: null },
    points: { type: Number, default: 1 },
    order_index: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
applyBaseSchema(milestoneQuestionSchema);

const milestoneAttemptSchema = new mongoose.Schema(
  {
    milestone_id: { type: mongoose.Schema.Types.ObjectId, ref: "Milestone", required: true, index: true },
    learner_id: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
    score: { type: Number, default: null },
    passed: { type: Boolean, default: null },
    started_at: { type: Date, default: () => new Date() },
    completed_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
applyBaseSchema(milestoneAttemptSchema);

const milestoneSubmissionSchema = new mongoose.Schema(
  {
    milestone_id: { type: mongoose.Schema.Types.ObjectId, ref: "Milestone", required: true, index: true },
    learner_id: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    submission_url: { type: String, required: true },
    review_status: { type: String, enum: ["pending", "graded"], default: "pending" },
    score: { type: Number, default: null },
    passed: { type: Boolean, default: null },
    feedback: { type: String, default: null },
    graded_at: { type: Date, default: null },
    graded_by: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", default: null },
    submitted_at: { type: Date, default: () => new Date() },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
applyBaseSchema(milestoneSubmissionSchema);

const pointTransactionSchema = new mongoose.Schema(
  {
    learner_id: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    course_id: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null, index: true },
    points: { type: Number, required: true },
    source_type: {
      type: String,
      enum: ["milestone_pass", "milestone_first_pass_bonus", "perfect_test", "manual_adjustment"],
      required: true,
    },
    reason_key: { type: String, default: undefined, sparse: true, unique: true },
    related_type: { type: String, enum: ["lesson_test", "milestone", null], default: null },
    related_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    note: { type: String, default: null },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
applyBaseSchema(pointTransactionSchema);

const certificateSchema = new mongoose.Schema(
  {
    learner_id: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    course_id: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    issued_at: { type: Date, default: () => new Date() },
    certificate_number: { type: String, required: true, unique: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
applyBaseSchema(certificateSchema);

const models = mongoose.models || {};

module.exports = {
  Profile: models.Profile || mongoose.model("Profile", profileSchema),
  Course: models.Course || mongoose.model("Course", courseSchema),
  Module: models.Module || mongoose.model("Module", moduleSchema),
  Lesson: models.Lesson || mongoose.model("Lesson", lessonSchema),
  Enrollment: models.Enrollment || mongoose.model("Enrollment", enrollmentSchema),
  LessonProgress: models.LessonProgress || mongoose.model("LessonProgress", lessonProgressSchema),
  Quiz: models.Quiz || mongoose.model("Quiz", quizSchema),
  QuizQuestion: models.QuizQuestion || mongoose.model("QuizQuestion", quizQuestionSchema),
  QuizAttempt: models.QuizAttempt || mongoose.model("QuizAttempt", quizAttemptSchema),
  LessonTest: models.LessonTest || mongoose.model("LessonTest", lessonTestSchema),
  LessonTestQuestion: models.LessonTestQuestion || mongoose.model("LessonTestQuestion", lessonTestQuestionSchema),
  LessonTestAttempt: models.LessonTestAttempt || mongoose.model("LessonTestAttempt", lessonTestAttemptSchema),
  LessonTestSubmission: models.LessonTestSubmission || mongoose.model("LessonTestSubmission", lessonTestSubmissionSchema),
  Milestone: models.Milestone || mongoose.model("Milestone", milestoneSchema),
  MilestoneQuestion: models.MilestoneQuestion || mongoose.model("MilestoneQuestion", milestoneQuestionSchema),
  MilestoneAttempt: models.MilestoneAttempt || mongoose.model("MilestoneAttempt", milestoneAttemptSchema),
  MilestoneSubmission: models.MilestoneSubmission || mongoose.model("MilestoneSubmission", milestoneSubmissionSchema),
  PointTransaction: models.PointTransaction || mongoose.model("PointTransaction", pointTransactionSchema),
  Certificate: models.Certificate || mongoose.model("Certificate", certificateSchema),
};
