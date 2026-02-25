import { apiFetch, requireRole } from "@/lib/auth-helpers";
import { Users, BookOpen, GraduationCap, Award, TrendingUp, UserCheck } from "lucide-react";
import Link from "next/link";

export default async function AdminDashboard() {
  await requireRole("admin");
  const response = await apiFetch("/api/admin/dashboard");
  if (!response.ok) return null;

  const payload = await response.json();
  const recentUsers = payload.recentUsers || [];
  const recentCourses = payload.recentCourses || [];

  const stats = [
    { label: "Total Users", value: payload.stats?.totalUsers ?? 0, icon: <Users className="w-6 h-6" />, color: "bg-blue-500", link: "/dashboard/admin/users" },
    { label: "Total Courses", value: payload.stats?.totalCourses ?? 0, icon: <BookOpen className="w-6 h-6" />, color: "bg-purple-500", link: "/dashboard/admin/courses" },
    { label: "Enrollments", value: payload.stats?.totalEnrollments ?? 0, icon: <GraduationCap className="w-6 h-6" />, color: "bg-green-500", link: "/dashboard/admin/reports" },
    { label: "Certificates", value: payload.stats?.totalCertificates ?? 0, icon: <Award className="w-6 h-6" />, color: "bg-orange-500", link: "/dashboard/admin/reports" },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Manage users, courses, and platform analytics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.link} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-xl text-white`}>
                {stat.icon}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-500" /> Recent Users
            </h2>
            <Link href="/dashboard/admin/users" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {recentUsers?.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold ${
                  u.role === 'admin' ? 'bg-red-500' : u.role === 'instructor' ? 'bg-purple-500' : 'bg-blue-500'
                }`}>
                  {u.full_name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{u.full_name || "—"}</p>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  u.role === 'admin' ? 'bg-red-100 text-red-700' :
                  u.role === 'instructor' ? 'bg-purple-100 text-purple-700' :
                  'bg-blue-100 text-blue-700'
                }`}>{u.role}</span>
              </div>
            ))}
            {!recentUsers?.length && <p className="text-sm text-gray-400 text-center py-4">No users yet</p>}
          </div>
        </div>

        {/* Recent Courses */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-500" /> Recent Courses
            </h2>
            <Link href="/dashboard/admin/courses" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {recentCourses?.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{c.title}</p>
                  <p className="text-xs text-gray-500">{c.instructor?.full_name || "Unknown"}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  c.is_published ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                }`}>{c.is_published ? "Published" : "Draft"}</span>
              </div>
            ))}
            {!recentCourses?.length && <p className="text-sm text-gray-400 text-center py-4">No courses yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
