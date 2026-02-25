import { apiFetch, requireRole } from "@/lib/auth-helpers";
import { BookOpen, PlusCircle, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import DeleteCourseButton from "./DeleteCourseButton";

export default async function InstructorCoursesPage() {
  await requireRole("instructor");
  const response = await apiFetch("/api/instructor/courses");
  if (!response.ok) return null;
  const payload = await response.json();
  const courses = payload.courses || [];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Courses</h1>
          <p className="text-gray-500 mt-1">{courses?.length ?? 0} courses created</p>
        </div>
        <Link
          href="/dashboard/instructor/courses/new"
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <PlusCircle className="w-4 h-4" /> New Course
        </Link>
      </div>

      {!courses?.length ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <BookOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No courses yet</h3>
          <p className="text-gray-400 mb-6">Create your first course to get started</p>
          <Link href="/dashboard/instructor/courses/new" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors">
            Create Course
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {courses.map((course: any) => (
            <div key={course.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-36 bg-gradient-to-br from-purple-500 via-blue-600 to-indigo-700 flex items-center justify-center relative">
                <BookOpen className="w-14 h-14 text-white/70" />
                <span className={`absolute top-3 right-3 text-xs px-2.5 py-1 rounded-full font-medium ${
                  course.is_published ? "bg-green-400/90 text-white" : "bg-yellow-400/90 text-gray-800"
                }`}>{course.is_published ? "Published" : "Draft"}</span>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{course.title}</h3>
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{course.description || "No description"}</p>
                <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
                  <span>{course.modulesCount ?? 0} modules</span>
                  <span>·</span>
                  <span>{course.enrollmentsCount ?? 0} learners</span>
                  <span>·</span>
                  <span className="capitalize">{course.level}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/instructor/courses/${course.id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-medium transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" /> Manage
                  </Link>
                  <DeleteCourseButton courseId={course.id} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
