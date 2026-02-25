const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI in environment variables.");
  process.exit(1);
}

const profileSchema = new mongoose.Schema(
  {
    full_name: String,
    email: { type: String, unique: true },
    password_hash: String,
    role: { type: String, enum: ["admin", "instructor", "learner"] },
    avatar_url: { type: String, default: null },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const courseSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    instructor_id: { type: mongoose.Schema.Types.ObjectId, ref: "Profile" },
    category: String,
    level: { type: String, enum: ["beginner", "intermediate", "advanced"] },
    thumbnail_url: String,
    is_published: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const moduleSchema = new mongoose.Schema(
  {
    course_id: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
    title: String,
    description: String,
    order_index: Number,
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const lessonSchema = new mongoose.Schema(
  {
    module_id: { type: mongoose.Schema.Types.ObjectId, ref: "Module" },
    course_id: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
    title: String,
    description: String,
    video_url: String,
    order_index: Number,
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const quizSchema = new mongoose.Schema(
  {
    course_id: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
    title: String,
    description: String,
    passing_score: Number,
    time_limit_minutes: Number,
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const quizQuestionSchema = new mongoose.Schema(
  {
    quiz_id: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz" },
    question_text: String,
    question_type: String,
    options: [String],
    correct_answer: String,
    points: Number,
    order_index: Number,
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const Profile = mongoose.models.Profile || mongoose.model("Profile", profileSchema);
const Course = mongoose.models.Course || mongoose.model("Course", courseSchema);
const Module = mongoose.models.Module || mongoose.model("Module", moduleSchema);
const Lesson = mongoose.models.Lesson || mongoose.model("Lesson", lessonSchema);
const Quiz = mongoose.models.Quiz || mongoose.model("Quiz", quizSchema);
const QuizQuestion = mongoose.models.QuizQuestion || mongoose.model("QuizQuestion", quizQuestionSchema);

async function main() {
  await mongoose.connect(MONGODB_URI, { dbName: "learnhub" });

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@learnhub.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin123!";

  let admin = await Profile.findOne({ email: adminEmail });
  if (!admin) {
    admin = await Profile.create({
      full_name: "Admin User",
      email: adminEmail,
      password_hash: await bcrypt.hash(adminPassword, 10),
      role: "admin",
      is_active: true,
    });
    console.log(`Created admin user: ${adminEmail}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  let instructor = await Profile.findOne({ email: "instructor@learnhub.local" });
  if (!instructor) {
    instructor = await Profile.create({
      full_name: "Sample Instructor",
      email: "instructor@learnhub.local",
      password_hash: await bcrypt.hash("Instructor123!", 10),
      role: "instructor",
      is_active: true,
    });
    console.log("Created sample instructor.");
  }

  const course = await Course.findOne({ title: "Getting Started with LearnHub" });
  if (!course) {
    const newCourse = await Course.create({
      title: "Getting Started with LearnHub",
      description: "Learn how to use the platform as a learner and instructor.",
      instructor_id: instructor._id,
      category: "Onboarding",
      level: "beginner",
      is_published: true,
    });

    const module = await Module.create({
      course_id: newCourse._id,
      title: "Welcome",
      description: "Platform basics and navigation.",
      order_index: 0,
    });

    await Lesson.create({
      module_id: module._id,
      course_id: newCourse._id,
      title: "Intro to LearnHub",
      description: "Quick tour of the dashboard and features.",
      video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      order_index: 0,
    });

    const quiz = await Quiz.create({
      course_id: newCourse._id,
      title: "Welcome Quiz",
      description: "A short quiz to get started.",
      passing_score: 70,
      time_limit_minutes: 5,
    });

    await QuizQuestion.create({
      quiz_id: quiz._id,
      question_text: "LearnHub is designed for role-based learning.",
      question_type: "true_false",
      options: ["True", "False"],
      correct_answer: "True",
      points: 1,
      order_index: 0,
    });

    console.log("Seeded sample course content.");
  } else {
    console.log("Sample course already exists.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  if (err?.code === "ECONNREFUSED" && String(err?.hostname || "").includes("_mongodb._tcp")) {
    console.error("MongoDB SRV lookup failed. Your DNS/network may block SRV queries.");
    console.error("Try a non-SRV connection string from Atlas (mongodb://host1,host2,host3/...).");
  }
  console.error(err);
  process.exit(1);
});
