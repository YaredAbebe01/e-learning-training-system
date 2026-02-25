import { apiFetch, requireRole } from "@/lib/auth-helpers";
import { BarChart3, CheckCircle, Clock, BookOpen } from "lucide-react";

export default async function LearnerProgressPage() {
  await requireRole("learner");

  const response = await apiFetch("/api/learner/progress");
  if (!response.ok) return null;
  const payload = await response.json();

  const enrollments = payload.enrollments || [];
  const lessonProgress = payload.lessonProgress || [];
  const attempts = payload.attempts || [];

  const completedByCourseid = lessonProgress?.reduce((acc, lp: any) => {
    if (lp.is_completed) {
      const key = String(lp.course_id);
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>) || {};

  const totalLessonsCompleted = lessonProgress?.filter(l => l.is_completed).length ?? 0;
  const completedCourses = enrollments?.filter(e => e.completed_at).length ?? 0;
  const scoredAttempts = attempts?.filter((a: any) => a.score !== null) || [];
  const avgQuizScore = scoredAttempts.length
    ? Math.round(scoredAttempts.reduce((s: number, a: any) => s + a.score, 0) / scoredAttempts.length)
    : 0;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Progress</h1>
        <p className="text-gray-500 mt-1">Track your learning achievements</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Courses Enrolled", value: enrollments?.length ?? 0, icon: <BookOpen className="w-5 h-5" />, color: "text-blue-600 bg-blue-50" },
          { label: "Courses Completed", value: completedCourses, icon: <CheckCircle className="w-5 h-5" />, color: "text-green-600 bg-green-50" },
          { label: "Lessons Completed", value: totalLessonsCompleted, icon: <Clock className="w-5 h-5" />, color: "text-purple-600 bg-purple-50" },
          { label: "Avg Quiz Score", value: `${avgQuizScore}%`, icon: <BarChart3 className="w-5 h-5" />, color: "text-orange-600 bg-orange-50" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className={`inline-flex p-2 rounded-lg ${s.color} mb-3`}>{s.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Per-course progress */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Course Progress</h2>
        <div className="space-y-4">
          {enrollments?.map((e: any) => {
            const total = e.course?.lessonCount ?? 0;
            const completed = completedByCourseid[String(e.course_id)] ?? 0;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
            return (
              <div key={e.id}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-gray-800 truncate flex-1 mr-4">{e.course?.title}</span>
                  <span className="text-gray-500 shrink-0">{completed}/{total} lessons · {pct}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${pct === 100 ? "bg-green-500" : "bg-blue-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {!enrollments?.length && <p className="text-sm text-gray-400 text-center py-4">No courses enrolled</p>}
        </div>
      </div>

      {/* Quiz attempts */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Quiz History</h2>
        <div className="space-y-2">
          {attempts?.map((a: any) => (
            <div key={a.id} className="flex items-center gap-4 py-2.5 border-b border-gray-50 last:border-0">
              <div className="flex-1 text-sm text-gray-800 font-medium">{a.quiz?.title}</div>
              <div className="flex items-center gap-2">
                {a.score !== null && <span className="text-sm font-bold text-gray-900">{a.score?.toFixed(0)}%</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  a.passed === true ? "bg-green-100 text-green-700" :
                  a.passed === false ? "bg-red-100 text-red-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {a.passed === true ? "Passed" : a.passed === false ? "Failed" : "In Progress"}
                </span>
              </div>
              <span className="text-xs text-gray-400 shrink-0">{new Date(a.started_at).toLocaleDateString()}</span>
            </div>
          ))}
          {!attempts?.length && <p className="text-sm text-gray-400 text-center py-4">No quiz attempts yet</p>}
        </div>
      </div>
    </div>
  );
}
