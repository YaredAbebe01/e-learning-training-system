"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, PlusCircle, Edit2, Trash2, BookOpen, Video, Eye, EyeOff, Save, X, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

interface PageProps { params: Promise<{ id: string }> }

export default function CourseEditPage({ params }: PageProps) {
  const router = useRouter();
  const [courseId, setCourseId] = useState<string>("");
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCourse, setEditingCourse] = useState(false);
  const [courseForm, setCourseForm] = useState<any>({});
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [newLesson, setNewLesson] = useState<{ moduleId: string; title: string; video_url: string; description: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");

  useEffect(() => {
    params.then(p => setCourseId(p.id));
  }, [params]);

  useEffect(() => {
    if (courseId) fetchData();
  }, [courseId]);

  const fetchData = async () => {
    const response = await fetch(`/api/instructor/courses/${courseId}`);
    if (!response.ok) return;
    const payload = await response.json();
    const c = payload.course;
    const m = payload.modules || [];
    setCourse(c);
    setCourseForm(c || {});
    setModules(m.map((mod: any) => ({
      ...mod,
      lessons: (mod.lessons || []).sort((a: any, b: any) => a.order_index - b.order_index),
    })));
    setLoading(false);
  };

  const saveCourse = async () => {
    setSaving(true);
    await fetch(`/api/instructor/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: courseForm.title,
        description: courseForm.description,
        category: courseForm.category,
        level: courseForm.level,
        thumbnail_url: courseForm.thumbnail_url,
      }),
    });
    setEditingCourse(false);
    setSaving(false);
    fetchData();
  };

  const togglePublish = async () => {
    await fetch(`/api/instructor/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_published: !course.is_published }),
    });
    fetchData();
  };

  const addModule = async () => {
    if (!newModuleTitle.trim()) return;
    await fetch(`/api/instructor/courses/${courseId}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newModuleTitle }),
    });
    setNewModuleTitle("");
    fetchData();
  };

  const deleteModule = async (moduleId: string) => {
    if (!confirm("Delete this module and all its lessons?")) return;
    await fetch(`/api/instructor/courses/${courseId}/modules/${moduleId}`, {
      method: "DELETE",
    });
    fetchData();
  };

  const addLesson = async () => {
    if (!newLesson || !newLesson.title.trim()) return;
    await fetch(`/api/instructor/courses/${courseId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module_id: newLesson.moduleId,
        title: newLesson.title,
        video_url: newLesson.video_url,
        description: newLesson.description,
      }),
    });
    setNewLesson(null);
    fetchData();
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    const data = new FormData();
    data.append("image", file);

    const response = await fetch("/api/uploads/image", {
      method: "POST",
      body: data,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.url) {
      setUploadError(payload?.error || "Upload failed. Try again.");
      setUploading(false);
      return;
    }

    setCourseForm((prev: any) => ({ ...prev, thumbnail_url: payload.url }));
    setUploading(false);
  };

  const deleteLesson = async (lessonId: string) => {
    await fetch(`/api/instructor/courses/${courseId}/lessons/${lessonId}`, {
      method: "DELETE",
    });
    fetchData();
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;
  if (!course) return <div className="text-center py-20 text-gray-400">Course not found</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard/instructor/courses" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Back to courses
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={togglePublish}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              course.is_published
                ? "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                : "bg-green-50 text-green-700 hover:bg-green-100"
            }`}
          >
            {course.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {course.is_published ? "Unpublish" : "Publish"}
          </button>
          <Link href={`/dashboard/instructor/quizzes?courseId=${courseId}`} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 text-sm font-medium transition-colors">
            Add Quiz
          </Link>
        </div>
      </div>

      {/* Course Info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        {editingCourse ? (
          <div className="space-y-4">
            <input
              value={courseForm.title || ""}
              onChange={e => setCourseForm({ ...courseForm, title: e.target.value })}
              className="w-full text-xl font-bold border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <textarea
              value={courseForm.description || ""}
              onChange={e => setCourseForm({ ...courseForm, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 h-20 resize-none"
              placeholder="Description"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                value={courseForm.category || ""}
                onChange={e => setCourseForm({ ...courseForm, category: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Category"
              />
              <select
                value={courseForm.level || "beginner"}
                onChange={e => setCourseForm({ ...courseForm, level: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course Thumbnail (Image)</label>
              <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-700">Upload a course cover image.</p>
                    <p className="text-xs text-gray-500">PNG or JPG up to 5MB.</p>
                  </div>
                  <label className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 cursor-pointer transition-colors">
                    Choose Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedFileName(file.name);
                          uploadImage(file);
                        } else {
                          setSelectedFileName("");
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                {selectedFileName && (
                  <p className="text-xs text-gray-600 mt-2">Selected: {selectedFileName}</p>
                )}
                {uploading && <p className="text-xs text-purple-600 mt-2">Uploading image...</p>}
                {uploadError && <p className="text-xs text-red-500 mt-2">{uploadError}</p>}
              </div>
              {courseForm.thumbnail_url && (
                <div className="mt-3">
                  <img
                    src={courseForm.thumbnail_url}
                    alt="Course thumbnail"
                    className="h-32 w-full object-cover rounded-lg border border-gray-100"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={saveCourse} disabled={saving || uploading} className="flex items-center gap-1.5 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
                <Save className="w-4 h-4" /> {saving ? "Saving..." : uploading ? "Uploading..." : "Save"}
              </button>
              <button onClick={() => setEditingCourse(false)} className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                <X className="w-4 h-4" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{course.title}</h1>
                <p className="text-gray-500 text-sm mt-1">{course.description || "No description"}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span>{course.category || "Uncategorized"}</span>
                  <span>·</span>
                  <span className="capitalize">{course.level}</span>
                  <span>·</span>
                  <span className={course.is_published ? "text-green-600" : "text-yellow-600"}>{course.is_published ? "Published" : "Draft"}</span>
                </div>
              </div>
              <button onClick={() => setEditingCourse(true)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors shrink-0">
                <Edit2 className="w-4 h-4" /> Edit
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modules & Lessons */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-500" /> Course Content
          </h2>
          <span className="text-xs text-gray-400">{modules.length} modules · {modules.reduce((s, m) => s + (m.lessons?.length ?? 0), 0)} lessons</span>
        </div>

        {/* Add Module */}
        <div className="flex gap-2 mb-5">
          <input
            type="text"
            value={newModuleTitle}
            onChange={e => setNewModuleTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addModule()}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="New module title..."
          />
          <button onClick={addModule} className="flex items-center gap-1.5 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
            <PlusCircle className="w-4 h-4" /> Add Module
          </button>
        </div>

        <div className="space-y-3">
          {modules.map((mod, mIdx) => (
            <div key={mod.id} className="border border-gray-100 rounded-lg overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setExpandedModule(expandedModule === mod.id ? null : mod.id)}
              >
                <span className="text-xs font-bold text-gray-400 w-6">M{mIdx + 1}</span>
                <span className="flex-1 text-sm font-semibold text-gray-800">{mod.title}</span>
                <span className="text-xs text-gray-400">{mod.lessons?.length ?? 0} lessons</span>
                <button onClick={e => { e.stopPropagation(); deleteModule(mod.id); }} className="p-1 text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {expandedModule === mod.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>

              {expandedModule === mod.id && (
                <div className="px-4 py-3 space-y-2">
                  {mod.lessons?.map((lesson: any, lIdx: number) => (
                    <div key={lesson.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      <Video className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="text-xs text-gray-400 w-5">{lIdx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{lesson.title}</p>
                        {lesson.video_url && <p className="text-xs text-gray-400 truncate">{lesson.video_url}</p>}
                      </div>
                      <button onClick={() => deleteLesson(lesson.id)} className="p-1 text-red-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Add Lesson */}
                  {newLesson?.moduleId === mod.id ? (
                    <div className="mt-3 space-y-2 pt-2 border-t border-gray-100">
                      <input
                        type="text"
                        value={newLesson.title}
                        onChange={e => setNewLesson({ ...newLesson, title: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Lesson title"
                      />
                      <input
                        type="url"
                        value={newLesson.video_url}
                        onChange={e => setNewLesson({ ...newLesson, video_url: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Video URL (YouTube, Vimeo, etc.)"
                      />
                      <textarea
                        value={newLesson.description}
                        onChange={e => setNewLesson({ ...newLesson, description: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 h-16 resize-none"
                        placeholder="Lesson description (optional)"
                      />
                      <div className="flex gap-2">
                        <button onClick={addLesson} className="flex-1 bg-purple-600 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">Save Lesson</button>
                        <button onClick={() => setNewLesson(null)} className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setNewLesson({ moduleId: mod.id, title: "", video_url: "", description: "" })}
                      className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors mt-1"
                    >
                      <PlusCircle className="w-4 h-4" /> Add Lesson
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {modules.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-200" />
              <p className="text-sm">No modules yet. Add a module above to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
