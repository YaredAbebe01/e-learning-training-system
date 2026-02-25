import { apiFetch, requireRole } from "@/lib/auth-helpers";
import { BarChart3, Users, BookOpen, GraduationCap, Award } from "lucide-react";

export default async function AdminReportsPage() {
  await requireRole("admin");
  const response = await apiFetch("/api/admin/reports");
  if (!response.ok) return null;

  const payload = await response.json();
  const users = payload.users || [];
  const courses = payload.courses || [];
  const enrollments = payload.enrollments || [];
  const certificates = payload.certificates || [];
  const attempts = payload.attempts || [];

  const totalUsers = users?.length ?? 0;
  const activeUsers = users?.filter(u => u.is_active).length ?? 0;
  const totalCourses = courses?.length ?? 0;
  const publishedCourses = courses?.filter(c => c.is_published).length ?? 0;
  const completedEnrollments = enrollments?.filter(e => e.completed_at).length ?? 0;
  const completionRate = enrollments?.length ? Math.round((completedEnrollments / enrollments.length) * 100) : 0;
  const passedAttempts = attempts?.filter(a => a.passed).length ?? 0;
  const quizPassRate = attempts?.length ? Math.round((passedAttempts / attempts.length) * 100) : 0;

  const roleBreakdown = users?.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryBreakdown = courses?.reduce((acc, c) => {
    const cat = c.category || "Uncategorized";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-500 mt-1">Platform-wide performance metrics</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Active Users", value: `${activeUsers}/${totalUsers}`, sub: "active users", icon: <Users className="w-5 h-5" />, color: "text-blue-600 bg-blue-50" },
          { label: "Published Courses", value: `${publishedCourses}/${totalCourses}`, sub: "published", icon: <BookOpen className="w-5 h-5" />, color: "text-purple-600 bg-purple-50" },
          { label: "Completion Rate", value: `${completionRate}%`, sub: `${completedEnrollments} completed`, icon: <GraduationCap className="w-5 h-5" />, color: "text-green-600 bg-green-50" },
          { label: "Quiz Pass Rate", value: `${quizPassRate}%`, sub: `${passedAttempts}/${attempts?.length ?? 0} passed`, icon: <Award className="w-5 h-5" />, color: "text-orange-600 bg-orange-50" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className={`inline-flex p-2 rounded-lg ${s.color} mb-3`}>{s.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            <p className="text-xs text-gray-400">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" /> User Role Breakdown
          </h2>
          <div className="space-y-3">
            {Object.entries(roleBreakdown || {}).map(([role, count]) => {
              const pct = totalUsers ? Math.round((count / totalUsers) * 100) : 0;
              return (
                <div key={role}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize font-medium text-gray-700">{role}</span>
                    <span className="text-gray-500">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${role === 'admin' ? 'bg-red-500' : role === 'instructor' ? 'bg-purple-500' : 'bg-blue-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {!Object.keys(roleBreakdown || {}).length && <p className="text-sm text-gray-400">No data available</p>}
          </div>
        </div>

        {/* Course Category Breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-500" /> Course Categories
          </h2>
          <div className="space-y-3">
            {Object.entries(categoryBreakdown || {}).map(([cat, count]) => {
              const pct = totalCourses ? Math.round((count / totalCourses) * 100) : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{cat}</span>
                    <span className="text-gray-500">{count} courses</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full bg-purple-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {!Object.keys(categoryBreakdown || {}).length && <p className="text-sm text-gray-400">No courses yet</p>}
          </div>
        </div>

        {/* Enrollments Over Time */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 lg:col-span-2">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-green-500" /> Enrollment Activity
          </h2>
          <div className="space-y-2">
            {enrollments?.slice(0, 8).map((e: any, i) => (
              <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <span className="text-sm text-gray-700 flex-1">
                  {e.course?.title || "Unknown Course"}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(e.enrolled_at).toLocaleDateString()}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${e.completed_at ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                  {e.completed_at ? "Completed" : "In Progress"}
                </span>
              </div>
            ))}
            {!enrollments?.length && <p className="text-sm text-gray-400 text-center py-4">No enrollment data yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
