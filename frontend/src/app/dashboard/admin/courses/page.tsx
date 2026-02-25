"use client";

import { useEffect, useState } from "react";
import { BookOpen, Search, Trash2, CheckCircle, XCircle } from "lucide-react";

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchCourses = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/courses");
    const payload = await response.json().catch(() => null);
    setCourses(payload?.courses || []);
    setLoading(false);
  };

  useEffect(() => { fetchCourses(); }, []);

  const togglePublish = async (course: any) => {
    await fetch("/api/admin/courses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: course.id, is_published: !course.is_published }),
    });
    fetchCourses();
  };

  const deleteCourse = async (id: string) => {
    if (!confirm("Delete this course?")) return;
    await fetch("/api/admin/courses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchCourses();
  };

  const filtered = courses.filter((c) =>
    c.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.instructor?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Course Management</h1>
        <p className="text-gray-500 mt-1">{courses.length} courses on the platform</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {loading ? (
          <p className="col-span-3 text-center py-12 text-gray-400">Loading courses...</p>
        ) : filtered.length === 0 ? (
          <p className="col-span-3 text-center py-12 text-gray-400">No courses found</p>
        ) : filtered.map((course) => (
          <div key={course.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-32 bg-gradient-to-br from-purple-400 via-blue-500 to-indigo-600 flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-white/80" />
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{course.title}</h3>
                <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${
                  course.is_published ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                }`}>{course.is_published ? "Published" : "Draft"}</span>
              </div>
              <p className="text-xs text-gray-500 mb-1">By {course.instructor?.full_name || "Unknown"}</p>
              <p className="text-xs text-gray-400 mb-4">
                {course.category || "Uncategorized"} · {course.level}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => togglePublish(course)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    course.is_published
                      ? "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                      : "bg-green-50 text-green-700 hover:bg-green-100"
                  }`}
                >
                  {course.is_published ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  {course.is_published ? "Unpublish" : "Publish"}
                </button>
                <button
                  onClick={() => deleteCourse(course.id)}
                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
