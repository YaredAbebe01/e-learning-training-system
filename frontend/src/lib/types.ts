export type UserRole = "admin" | "instructor" | "learner";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  bio: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  instructor_id: string | null;
  category: string | null;
  level: "beginner" | "intermediate" | "advanced";
  credit_hours: number | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  instructor?: Profile;
  modules?: Module[];
  enrollments?: Enrollment[];
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  order_index: number;
  created_at: string;
  lessons?: Lesson[];
}

export interface Lesson {
  id: string;
  module_id: string;
  course_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  duration_seconds: number;
  order_index: number;
  created_at: string;
}

export interface Enrollment {
  id: string;
  learner_id: string;
  course_id: string;
  enrolled_at: string;
  completed_at: string | null;
  course?: Course;
  learner?: Profile;
}

export interface LessonProgress {
  id: string;
  learner_id: string;
  lesson_id: string;
  course_id: string;
  is_completed: boolean;
  completed_at: string | null;
}

export interface Quiz {
  id: string;
  course_id: string;
  module_id: string | null;
  title: string;
  description: string | null;
  passing_score: number;
  time_limit_minutes: number | null;
  created_at: string;
  questions?: QuizQuestion[];
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: "mcq" | "true_false" | "short_answer";
  options: string[] | null;
  correct_answer: string | null;
  points: number;
  order_index: number;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  learner_id: string;
  answers: Record<string, string>;
  score: number | null;
  passed: boolean | null;
  started_at: string;
  completed_at: string | null;
  quiz?: Quiz;
}

export interface Certificate {
  id: string;
  learner_id: string;
  course_id: string;
  issued_at: string;
  certificate_number: string;
  course?: Course;
  learner?: Profile;
}
