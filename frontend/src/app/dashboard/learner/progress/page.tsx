import { apiFetch, requireRole } from "@/lib/auth-helpers";
import { CheckCircle, Clock, BookOpen } from "lucide-react";

export default async function LearnerProgressPage() {
  await requireRole("learner");

  const response = await apiFetch("/api/learner/progress");
  if (!response.ok) return null;
  const payload = await response.json();

  const enrollments = payload.enrollments || [];
  const lessonProgress = payload.lessonProgress || [];
  const completedByCourseid = lessonProgress?.reduce((acc, lp: any) => {
    if (lp.is_completed) {
      const key = String(lp.course_id);
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>) || {};

  const totalLessonsCompleted = lessonProgress?.filter(l => l.is_completed).length ?? 0;
  const completedCourses = enrollments?.filter(e => e.completed_at).length ?? 0;

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

    </div>
  );
}
