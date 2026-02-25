import { apiFetch, requireRole } from "@/lib/auth-helpers";
import { BookOpen, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";

export default async function MyLearningPage() {
  await requireRole("learner");

  const response = await apiFetch("/api/learner/my-learning");
  if (!response.ok) return null;
  const payload = await response.json();

  const enrollments = payload.enrollments || [];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Learning</h1>
        <p className="text-gray-500 mt-1">{enrollments?.length ?? 0} courses enrolled</p>
      </div>

      {!enrollments?.length ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <BookOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No courses enrolled</h3>
          <p className="text-gray-400 mb-6">Browse and enroll in courses to start learning</p>
          <Link href="/dashboard/learner/courses" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            Browse Courses
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {enrollments.map((e: any) => {
            const totalLessons = e.course?.lessonCount ?? 0;
            const completedLessons = e.completedLessons ?? 0;
            const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
            const isCompleted = !!e.completed_at;
            return (
              <div key={e.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                <div className="h-32 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center relative">
                  <BookOpen className="w-12 h-12 text-white/70" />
                  {isCompleted && (
                    <div className="absolute top-2 right-2 bg-green-400 text-white rounded-full p-1">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{e.course?.title}</h3>
                  <p className="text-xs text-gray-400 mb-3">By {e.course?.instructor?.full_name || "Instructor"}</p>
                  
                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{completedLessons}/{totalLessons} lessons</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${isCompleted ? "bg-green-500" : "bg-blue-500"}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                    <Clock className="w-3.5 h-3.5" />
                    Enrolled {new Date(e.enrolled_at).toLocaleDateString()}
                  </div>

                  <Link
                    href={`/learn/${e.course_id}`}
                    className={`mt-auto text-center py-2 rounded-lg text-sm font-medium transition-colors ${
                      isCompleted
                        ? "bg-green-50 text-green-700 hover:bg-green-100"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {isCompleted ? "Review Course" : progress > 0 ? "Continue" : "Start Learning"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
