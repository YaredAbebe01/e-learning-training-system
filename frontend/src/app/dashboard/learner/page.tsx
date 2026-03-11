import { apiFetch, requireRole } from "@/lib/auth-helpers";
import { BookOpen, GraduationCap, Award, Clock, Coins } from "lucide-react";
import Link from "next/link";

export default async function LearnerDashboard() {
  await requireRole("learner");
  const response = await apiFetch("/api/learner/dashboard");
  if (!response.ok) return null;
  const payload = await response.json();

  const profile = payload.profile;
  const enrollments = payload.enrollments || [];
  const certificates = payload.certificates || [];
  const lessonProgress = payload.lessonProgress || [];
  const points = payload.points || { total: 0, recent: [] };

  const activeEnrollments = enrollments?.filter(e => !e.completed_at) ?? [];
  const completedEnrollments = enrollments?.filter(e => e.completed_at) ?? [];
  const completedLessons = lessonProgress?.filter(l => l.is_completed).length ?? 0;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {profile?.full_name?.split(" ")[0] ?? "Learner"}</h1>
        <p className="text-gray-500 mt-1">Continue your learning journey</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Enrolled Courses", value: enrollments?.length ?? 0, icon: <BookOpen className="w-5 h-5" />, color: "bg-blue-600", link: "/dashboard/learner/my-learning" },
          { label: "In Progress", value: activeEnrollments.length, icon: <Clock className="w-5 h-5" />, color: "bg-orange-500", link: "/dashboard/learner/my-learning" },
          { label: "Completed", value: completedEnrollments.length, icon: <GraduationCap className="w-5 h-5" />, color: "bg-green-600", link: "/dashboard/learner/my-learning" },
          { label: "Certificates", value: certificates?.length ?? 0, icon: <Award className="w-5 h-5" />, color: "bg-yellow-500", link: "/dashboard/learner/certificates" },
          { label: "My Points", value: points.total ?? 0, icon: <Coins className="w-5 h-5" />, color: "bg-violet-600", link: "/dashboard/learner" },
        ].map(s => (
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
        {/* Continue Learning */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Continue Learning</h2>
            <Link href="/dashboard/learner/my-learning" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {activeEnrollments.slice(0, 4).map((e: any) => (
              <Link key={e.id} href={`/learn/${e.course_id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shrink-0">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700 transition-colors">{e.course?.title}</p>
                  <p className="text-xs text-gray-400">By {e.course?.instructor?.full_name || "Instructor"}</p>
                  <p className="text-xs text-gray-400 capitalize">{e.course?.level} · {e.course?.category || "General"}</p>
                </div>
                <span className="text-xs text-blue-600 font-medium shrink-0">Continue →</span>
              </Link>
            ))}
            {!activeEnrollments.length && (
              <div className="text-center py-8">
                <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-3">No active courses</p>
                <Link href="/dashboard/learner/courses" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                  Browse Courses
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Certificates */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Certificates</h2>
            <Link href="/dashboard/learner/certificates" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {certificates?.slice(0, 4).map((cert: any) => (
              <div key={cert.id} className="flex items-center gap-3">
                <div className="w-9 h-9 bg-yellow-100 rounded-full flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{cert.course?.title}</p>
                  <p className="text-xs text-gray-400">{new Date(cert.issued_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            {!certificates?.length && (
              <div className="text-center py-6">
                <Award className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Complete a course to earn certificates</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Point Activity</h2>
            <span className="text-sm font-medium text-violet-600">Total: {points.total ?? 0}</span>
          </div>
          <div className="space-y-3">
            {(points.recent || []).map((entry: any) => (
              <div key={entry.id} className="flex items-center justify-between gap-4 rounded-lg border border-gray-100 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{entry.note || "Point update"}</p>
                  <p className="text-xs text-gray-500">
                    {entry.course?.title ? `${entry.course.title} • ` : ""}
                    {new Date(entry.created_at).toLocaleString()}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${entry.points >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {entry.points >= 0 ? `+${entry.points}` : entry.points}
                </span>
              </div>
            ))}
            {!points.recent?.length && <p className="text-sm text-gray-400 text-center py-6">No points yet. Pass milestones and score 100% on lesson tests to earn points.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
