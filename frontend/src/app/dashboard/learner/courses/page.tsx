import { apiFetch, requireRole } from "@/lib/auth-helpers";
import { BookOpen, Search } from "lucide-react";
import EnrollButton from "./EnrollButton";

export default async function CourseCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; level?: string; category?: string }>;
}) {
  const sp = await searchParams;
  await requireRole("learner");

  const query = new URLSearchParams();
  if (sp.level && sp.level !== "all") query.set("level", sp.level);
  if (sp.category) query.set("category", sp.category);
  if (sp.q) query.set("q", sp.q);

  const queryString = query.toString();
  const response = await apiFetch(`/api/learner/courses${queryString ? `?${queryString}` : ""}`);
  if (!response.ok) return null;
  const payload = await response.json();

  const courses = payload.courses || [];
  const enrolledIds = new Set(payload.enrolledIds || []);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Browse Courses</h1>
        <p className="text-gray-500 mt-1">{courses?.length ?? 0} courses available</p>
      </div>

      {/* Filters - client-side form */}
      <form method="GET" className="bg-white rounded-xl border border-gray-100 p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={sp.q}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search courses..."
          />
        </div>
        <select name="level" defaultValue={sp.level || "all"} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Search</button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {courses?.map((course: any) => (
          <div key={course.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col">
            <div className="h-36 bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600 flex items-center justify-center">
              {course.thumbnail_url ? (
                <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
              ) : (
                <BookOpen className="w-14 h-14 text-white/70" />
              )}
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{course.title}</h3>
              <p className="text-xs text-gray-500 mb-1">By {course.instructor?.full_name || "Instructor"}</p>
              <p className="text-xs text-gray-400 mb-3 line-clamp-2 flex-1">{course.description || "No description available"}</p>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  course.level === 'beginner' ? 'bg-green-100 text-green-700' :
                  course.level === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>{course.level}</span>
                {course.category && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">{course.category}</span>}
              </div>
              <EnrollButton courseId={course.id} isEnrolled={enrolledIds.has(course.id)} />
            </div>
          </div>
        ))}
        {!courses?.length && (
          <div className="col-span-3 text-center py-20 bg-white rounded-xl border border-gray-100">
            <BookOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No courses found</h3>
            <p className="text-gray-400">Try a different search or filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
