import { apiFetch, requireRole } from "@/lib/auth-helpers";
import { BarChart3, Users, BookOpen, TrendingUp } from "lucide-react";

export default async function InstructorAnalyticsPage() {
  await requireRole("instructor");
  const response = await apiFetch("/api/instructor/analytics");
  if (!response.ok) return null;

  const payload = await response.json();
  const courses = payload.courses || [];
  const enrollments = payload.enrollments || [];
  const attempts = payload.attempts || [];
  const lessonProgress = payload.lessonProgress || [];

  const totalEnrollments = enrollments?.length ?? 0;
  const completedCourses = enrollments?.filter((e: any) => e.completed_at).length ?? 0;
  const scored = attempts?.filter((a: any) => a.score !== null) ?? [];
  const avgScore = scored.length
    ? Math.round(scored.reduce((s: number, a: any) => s + a.score, 0) / scored.length)
    : 0;
  const completedLessons = lessonProgress?.filter((l: any) => l.is_completed).length ?? 0;

  // Per-course breakdown
  const courseBreakdown = courses?.map((c: any) => {
    const courseId = String(c.id);
    const enrolled = enrollments?.filter((e: any) => String(e.course_id?._id || e.course_id) === courseId).length ?? 0;
    const completed = enrollments?.filter((e: any) => String(e.course_id?._id || e.course_id) === courseId && e.completed_at).length ?? 0;
    const lessonsCompleted = lessonProgress?.filter((l: any) => String(l.course_id) === courseId && l.is_completed).length ?? 0;
    return { ...c, enrolled, completed, lessonsCompleted };
  }) || [];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 mt-1">Performance overview for your courses</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Enrollments", value: totalEnrollments, icon: <Users className="w-5 h-5" />, color: "bg-blue-500" },
          { label: "Completions", value: completedCourses, icon: <BookOpen className="w-5 h-5" />, color: "bg-green-500" },
          { label: "Avg Quiz Score", value: `${avgScore}%`, icon: <TrendingUp className="w-5 h-5" />, color: "bg-purple-500" },
          { label: "Lessons Completed", value: completedLessons, icon: <BarChart3 className="w-5 h-5" />, color: "bg-orange-500" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className={`${s.color} p-2.5 rounded-xl text-white inline-flex mb-3`}>{s.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Per-course table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Course Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Course</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Enrolled</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Completed</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Completion Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {courseBreakdown.map(c => {
                const rate = c.enrolled ? Math.round((c.completed / c.enrolled) * 100) : 0;
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.title}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${c.is_published ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {c.is_published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{c.enrolled}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{c.completed}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-24">
                          <div className="h-2 bg-green-500 rounded-full" style={{ width: `${rate}%` }} />
                        </div>
                        <span className="text-sm text-gray-700 w-10">{rate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!courseBreakdown.length && (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400 text-sm">No courses yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Quiz Attempts */}
      {(attempts?.length ?? 0) > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Recent Quiz Attempts</h2>
          <div className="space-y-2">
            {attempts?.slice(0, 10).map((a: any) => (
              <div key={a.id} className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
                <div className="flex-1 text-sm text-gray-700">{a.quiz?.title}</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{a.score?.toFixed(0) ?? "—"}%</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {a.passed ? "Passed" : "Failed"}
                  </span>
                </div>
                <span className="text-xs text-gray-400">{a.completed_at ? new Date(a.completed_at).toLocaleDateString() : "In progress"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
