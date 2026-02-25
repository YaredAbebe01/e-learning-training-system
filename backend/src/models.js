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
    description: { type: String, default: null },
    video_url: { type: String, default: null },
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
    title: { type: String, required: true },
    description: { type: String, default: null },
    passing_score: { type: Number, default: 70 },
    time_limit_minutes: { type: Number, default: null },
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
  Certificate: models.Certificate || mongoose.model("Certificate", certificateSchema),
};
