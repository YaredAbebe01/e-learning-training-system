import { apiFetch, requireRole } from "@/lib/auth-helpers";
import { BookOpen, Users, ClipboardList, TrendingUp, PlusCircle } from "lucide-react";
import Link from "next/link";

export default async function InstructorDashboard() {
  const user = await requireRole("instructor");
  const response = await apiFetch("/api/instructor/dashboard");
  if (!response.ok) return null;
  const payload = await response.json();

  const courses = payload.courses || [];
  const enrollments = payload.enrollments || [];
  const totalEnrollments = payload.totalEnrollments ?? enrollments.length ?? 0;
  const quizzesCount = payload.quizzesCount ?? 0;
  const avgScore = payload.avgScore ?? 0;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user.name?.split(" ")[0] ?? "Instructor"}</h1>
        <p className="text-gray-500 mt-1">Manage your courses and track learner progress</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "My Courses", value: courses?.length ?? 0, icon: <BookOpen className="w-5 h-5" />, color: "bg-purple-600", link: "/dashboard/instructor/courses" },
          { label: "Total Learners", value: totalEnrollments, icon: <Users className="w-5 h-5" />, color: "bg-blue-600", link: "/dashboard/instructor/analytics" },
          { label: "Quizzes", value: quizzesCount, icon: <ClipboardList className="w-5 h-5" />, color: "bg-green-600", link: "/dashboard/instructor/quizzes" },
          { label: "Avg Quiz Score", value: `${avgScore}%`, icon: <TrendingUp className="w-5 h-5" />, color: "bg-orange-600", link: "/dashboard/instructor/analytics" },
        ].map((s) => (
          <Link key={s.label} href={s.link} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
              </div>
              <div className={`${s.color} p-2.5 rounded-xl text-white`}>{s.icon}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Courses */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">My Courses</h2>
            <Link href="/dashboard/instructor/courses/new" className="flex items-center gap-1.5 text-sm text-purple-600 hover:underline">
              <PlusCircle className="w-4 h-4" /> New Course
            </Link>
          </div>
          <div className="space-y-3">
            {courses?.slice(0, 5).map((c: any) => (
              <Link key={c.id} href={`/dashboard/instructor/courses/${c.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-500 rounded-lg flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                  <p className="text-xs text-gray-500">{c.enrollmentsCount ?? 0} learners enrolled</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${c.is_published ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                  {c.is_published ? "Published" : "Draft"}
                </span>
              </Link>
            ))}
            {!courses?.length && (
              <div className="text-center py-8">
                <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-3">No courses yet</p>
                <Link href="/dashboard/instructor/courses/new" className="text-sm bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
                  Create your first course
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Enrollments */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Recent Enrollments</h2>
          <div className="space-y-3">
            {enrollments?.slice(0, 6).map((e: any) => (
              <div key={e.id} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{e.course?.title}</p>
                  <p className="text-xs text-gray-400">{new Date(e.enrolled_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            {!enrollments?.length && <p className="text-sm text-gray-400 text-center py-4">No enrollments yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
