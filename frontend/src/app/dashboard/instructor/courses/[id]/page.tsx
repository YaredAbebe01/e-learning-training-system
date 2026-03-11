"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, PlusCircle, Edit2, Trash2, BookOpen, Video, Eye, EyeOff, Save, X, ChevronDown, ChevronUp, Award, ClipboardList } from "lucide-react";
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
  const [newLesson, setNewLesson] = useState<{ moduleId: string; title: string; subtitle: string; video_url: string; description: string; pdf_url: string; resource_url: string; resource_name: string; resource_type: string } | null>(null);
  const [activeLessonTestId, setActiveLessonTestId] = useState<string | null>(null);
  const [lessonTestForm, setLessonTestForm] = useState<any>({
    title: "",
    description: "",
    test_type: "mcq",
    passing_score: 70,
    time_limit_minutes: "",
    project_prompt: "",
    project_link: "",
  });
  const [lessonTestQuestions, setLessonTestQuestions] = useState<any[]>([]);
  const [newLessonQuestion, setNewLessonQuestion] = useState<any>({
    question_text: "",
    options: ["", "", "", ""],
    correct_answer: "",
    points: 1,
  });
  const [activeMilestoneId, setActiveMilestoneId] = useState<string | null>(null);
  const [milestoneForm, setMilestoneForm] = useState<any>({
    title: "",
    description: "",
    milestone_type: "mcq",
    project_link: "",
  });
  const [milestoneQuestions, setMilestoneQuestions] = useState<any[]>([]);
  const [newMilestoneQuestion, setNewMilestoneQuestion] = useState<any>({
    question_text: "",
    options: ["", "", "", ""],
    correct_answer: "",
    points: 1,
  });
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
      milestones: (mod.milestones || []).sort((a: any, b: any) => a.order_index - b.order_index),
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
        credit_hours: Number(courseForm.credit_hours) || 1,
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
      body: JSON.stringify({
        title: newModuleTitle,
      }),
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
        subtitle: newLesson.subtitle,
        video_url: newLesson.video_url,
        description: newLesson.description,
        pdf_url: newLesson.pdf_url,
        resource_url: newLesson.resource_url,
        resource_name: newLesson.resource_name,
        resource_type: newLesson.resource_type,
      }),
    });
    setNewLesson(null);
    setSelectedFileName("");
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

  const openLessonTest = async (lesson: any) => {
    setActiveLessonTestId(lesson.id);
    const response = await fetch(`/api/instructor/lessons/${lesson.id}/test`);
    const payload = await response.json().catch(() => null);
    const test = payload?.test;
    setLessonTestForm({
      title: test?.title || `${lesson.title} Test`,
      description: test?.description || "",
      test_type: test?.test_type || "mcq",
      passing_score: test?.passing_score || 70,
      time_limit_minutes: test?.time_limit_minutes ? String(test.time_limit_minutes) : "",
      project_prompt: test?.project_prompt || "",
      project_link: test?.project_link || "",
    });
    setLessonTestQuestions(payload?.questions || []);
    setNewLessonQuestion({ question_text: "", options: ["", "", "", ""], correct_answer: "", points: 1 });
  };

  const saveLessonTest = async () => {
    if (!activeLessonTestId || !lessonTestForm.title.trim()) return;
    await fetch(`/api/instructor/lessons/${activeLessonTestId}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...lessonTestForm,
        time_limit_minutes: lessonTestForm.time_limit_minutes ? Number(lessonTestForm.time_limit_minutes) : null,
      }),
    });
    await fetchData();
    await openLessonTest({ id: activeLessonTestId, title: lessonTestForm.title });
  };

  const deleteLessonTest = async (lessonId: string) => {
    await fetch(`/api/instructor/lessons/${lessonId}/test`, { method: "DELETE" });
    if (activeLessonTestId === lessonId) {
      setLessonTestQuestions([]);
      setActiveLessonTestId(null);
    }
    fetchData();
  };

  const addLessonTestQuestion = async () => {
    if (!activeLessonTestId || !newLessonQuestion.question_text.trim()) return;
    const options = newLessonQuestion.options.filter((option: string) => option.trim());
    if (options.length < 2) return;
    await fetch(`/api/instructor/lessons/${activeLessonTestId}/test/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_text: newLessonQuestion.question_text,
        options,
        correct_answer: newLessonQuestion.correct_answer,
        points: newLessonQuestion.points,
      }),
    });
    await openLessonTest({ id: activeLessonTestId, title: lessonTestForm.title });
  };

  const deleteLessonTestQuestion = async (questionId: string) => {
    if (!activeLessonTestId) return;
    await fetch(`/api/instructor/lessons/${activeLessonTestId}/test/questions/${questionId}`, { method: "DELETE" });
    await openLessonTest({ id: activeLessonTestId, title: lessonTestForm.title });
  };

  const openMilestone = async (milestone?: any) => {
    if (!milestone?.id) {
      setActiveMilestoneId("new");
      setMilestoneForm({ title: "", description: "", milestone_type: "mcq", project_link: "" });
      setMilestoneQuestions([]);
      return;
    }
    setActiveMilestoneId(milestone.id);
    const response = await fetch(`/api/instructor/milestones/${milestone.id}/questions`);
    const payload = await response.json().catch(() => null);
    setMilestoneForm({
      title: payload?.milestone?.title || "",
      description: payload?.milestone?.description || "",
      milestone_type: payload?.milestone?.milestone_type || "mcq",
      project_link: payload?.milestone?.project_link || "",
    });
    setMilestoneQuestions(payload?.questions || []);
    setNewMilestoneQuestion({ question_text: "", options: ["", "", "", ""], correct_answer: "", points: 1 });
  };

  const saveMilestone = async (moduleId: string) => {
    if (!milestoneForm.title.trim()) return;
    if (!activeMilestoneId || activeMilestoneId === "new") {
      await fetch(`/api/instructor/modules/${moduleId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(milestoneForm),
      });
    } else {
      await fetch(`/api/instructor/modules/${moduleId}/milestones/${activeMilestoneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(milestoneForm),
      });
    }
    fetchData();
  };

  const deleteMilestone = async (moduleId: string, milestoneId: string) => {
    await fetch(`/api/instructor/modules/${moduleId}/milestones/${milestoneId}`, { method: "DELETE" });
    if (activeMilestoneId === milestoneId) {
      setMilestoneQuestions([]);
      setActiveMilestoneId(null);
    }
    fetchData();
  };

  const addMilestoneQuestion = async () => {
    if (!activeMilestoneId || activeMilestoneId === "new" || !newMilestoneQuestion.question_text.trim()) return;
    const options = newMilestoneQuestion.options.filter((option: string) => option.trim());
    if (options.length < 2) return;
    await fetch(`/api/instructor/milestones/${activeMilestoneId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_text: newMilestoneQuestion.question_text,
        options,
        correct_answer: newMilestoneQuestion.correct_answer,
        points: newMilestoneQuestion.points,
      }),
    });
    await openMilestone({ id: activeMilestoneId });
  };

  const deleteMilestoneQuestion = async (questionId: string) => {
    if (!activeMilestoneId || activeMilestoneId === "new") return;
    await fetch(`/api/instructor/milestones/${activeMilestoneId}/questions/${questionId}`, { method: "DELETE" });
    await openMilestone({ id: activeMilestoneId });
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;
  if (!course) return <div className="text-center py-20 text-gray-400">Course not found</div>;

  const safeModules = (modules || []).filter(Boolean);
  const lessonCount = safeModules.reduce((sum, mod: any) => sum + ((mod?.lessons || []).length), 0);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard/instructor/courses" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Back to courses
        </Link>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
              <input
                type="number"
                min={1}
                value={courseForm.credit_hours || ""}
                onChange={e => setCourseForm({ ...courseForm, credit_hours: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Credit hours"
              />
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
                  <span>{course.credit_hours || 0} credit hours</span>
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
          <span className="text-xs text-gray-400">{safeModules.length} modules · {lessonCount} lessons</span>
        </div>

        {/* Add Module */}
        <div className="flex flex-col gap-2 mb-5">
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
          {safeModules.map((mod: any, mIdx: number) => (
            <div key={mod.id || `module-${mIdx}`} className="border border-gray-100 rounded-lg overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setExpandedModule(expandedModule === mod.id ? null : mod.id)}
              >
                <span className="text-xs font-bold text-gray-400 w-6">M{mIdx + 1}</span>
                <span className="flex-1 text-sm font-semibold text-gray-800">{mod.title}</span>
                <span className="text-xs text-gray-400">{mod.lessons?.length ?? 0} lessons</span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-400">{mod.milestones?.length ?? 0} milestones</span>
                <button onClick={e => { e.stopPropagation(); deleteModule(mod.id); }} className="p-1 text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {expandedModule === mod.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>

              {expandedModule === mod.id && (
                <div className="px-4 py-3 space-y-2">
                  <div className="flex justify-end">
                    <Link
                      href={`/dashboard/instructor/courses/${courseId}/modules/${mod.id}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800"
                    >
                      <BookOpen className="w-3.5 h-3.5" /> Open Module Studio
                    </Link>
                  </div>
                  {(mod.lessons || []).filter(Boolean).map((lesson: any, lIdx: number) => (
                    <div key={lesson.id || `${mod.id}-lesson-${lIdx}`} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      <Video className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="text-xs text-gray-400 w-5">{lIdx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{lesson.title}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {lesson.lesson_test
                            ? `${lesson.lesson_test.test_type.toUpperCase()} test attached`
                            : lesson.video_url || "No lesson test"}
                        </p>
                      </div>
                      <Link
                        href={`/dashboard/instructor/courses/${courseId}/lessons/${lesson.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </Link>
                      <button onClick={() => deleteLesson(lesson.id)} className="p-1 text-red-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  <Link
                    href={`/dashboard/instructor/courses/${courseId}/lessons/new?moduleId=${mod.id}`}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm text-purple-600 hover:bg-purple-50 transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" /> Add Lesson In Page
                  </Link>

                  <div className="pt-4 border-t border-gray-100 space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Lesson Tests</p>
                      </div>
                      <div className="space-y-3">
                        {(mod.lessons || []).filter(Boolean).map((lesson: any) => (
                          <div key={`${lesson.id}-test-editor`} className="rounded-xl border border-gray-100 overflow-hidden">
                            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{lesson.title}</p>
                                <p className="text-xs text-gray-400">
                                  {lesson.lesson_test
                                    ? `${lesson.lesson_test.test_type.toUpperCase()} test · ${lesson.lesson_test.question_count || 0} questions`
                                    : "No test yet"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {lesson.lesson_test && (
                                  <button
                                    onClick={() => deleteLessonTest(lesson.id)}
                                    className="text-xs text-red-500 hover:text-red-600"
                                  >
                                    Delete test
                                  </button>
                                )}
                                <button
                                  onClick={() => router.push(`/dashboard/instructor/courses/${courseId}/lessons/${lesson.id}/test`)}
                                  className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700"
                                >
                                  <ClipboardList className="w-4 h-4" /> Open Editor
                                </button>
                              </div>
                            </div>

                            {activeLessonTestId === lesson.id && (
                              <div className="px-4 py-4 space-y-3 bg-white">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <input
                                    type="text"
                                    value={lessonTestForm.title}
                                    onChange={(e) => setLessonTestForm({ ...lessonTestForm, title: e.target.value })}
                                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Test title"
                                  />
                                  <select
                                    value={lessonTestForm.test_type}
                                    onChange={(e) => setLessonTestForm({ ...lessonTestForm, test_type: e.target.value })}
                                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  >
                                    <option value="mcq">Multiple Choice</option>
                                    <option value="project">Project Submission</option>
                                  </select>
                                </div>
                                <textarea
                                  value={lessonTestForm.description}
                                  onChange={(e) => setLessonTestForm({ ...lessonTestForm, description: e.target.value })}
                                  rows={2}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                  placeholder="Test description"
                                />

                                {lessonTestForm.test_type === "mcq" ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input
                                      type="number"
                                      min={1}
                                      value={lessonTestForm.passing_score}
                                      onChange={(e) => setLessonTestForm({ ...lessonTestForm, passing_score: Number(e.target.value) || 70 })}
                                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                      placeholder="Passing score"
                                    />
                                    <input
                                      type="number"
                                      min={1}
                                      value={lessonTestForm.time_limit_minutes}
                                      onChange={(e) => setLessonTestForm({ ...lessonTestForm, time_limit_minutes: e.target.value })}
                                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                      placeholder="Time limit in minutes"
                                    />
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <textarea
                                      value={lessonTestForm.project_prompt}
                                      onChange={(e) => setLessonTestForm({ ...lessonTestForm, project_prompt: e.target.value })}
                                      rows={2}
                                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                      placeholder="Project prompt"
                                    />
                                    <input
                                      type="url"
                                      value={lessonTestForm.project_link}
                                      onChange={(e) => setLessonTestForm({ ...lessonTestForm, project_link: e.target.value })}
                                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                      placeholder="Project brief link"
                                    />
                                  </div>
                                )}

                                <button
                                  onClick={saveLessonTest}
                                  className="w-full bg-purple-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                                >
                                  Save Lesson Test
                                </button>

                                {lessonTestForm.test_type === "mcq" && (
                                  <div className="space-y-3 pt-2 border-t border-gray-100">
                                    <div className="space-y-2">
                                      {lessonTestQuestions.map((question: any, questionIndex: number) => (
                                        <div key={question.id} className="rounded-lg border border-gray-100 p-3">
                                          <div className="flex items-start justify-between gap-3">
                                            <div>
                                              <p className="text-xs text-gray-400">Q{questionIndex + 1}</p>
                                              <p className="text-sm font-medium text-gray-800">{question.question_text}</p>
                                            </div>
                                            <button
                                              onClick={() => deleteLessonTestQuestion(question.id)}
                                              className="text-xs text-red-500 hover:text-red-600"
                                            >
                                              Remove
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    <div className="rounded-lg border border-dashed border-gray-200 p-3 space-y-3">
                                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Add Question</p>
                                      <textarea
                                        value={newLessonQuestion.question_text}
                                        onChange={(e) => setNewLessonQuestion({ ...newLessonQuestion, question_text: e.target.value })}
                                        rows={2}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                        placeholder="Question text"
                                      />
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {newLessonQuestion.options.map((option: string, optionIndex: number) => (
                                          <input
                                            key={`${lesson.id}-option-${optionIndex}`}
                                            value={option}
                                            onChange={(e) => {
                                              const nextOptions = [...newLessonQuestion.options];
                                              nextOptions[optionIndex] = e.target.value;
                                              setNewLessonQuestion({ ...newLessonQuestion, options: nextOptions });
                                            }}
                                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            placeholder={`Option ${optionIndex + 1}`}
                                          />
                                        ))}
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <input
                                          type="text"
                                          value={newLessonQuestion.correct_answer}
                                          onChange={(e) => setNewLessonQuestion({ ...newLessonQuestion, correct_answer: e.target.value })}
                                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                          placeholder="Correct answer"
                                        />
                                        <input
                                          type="number"
                                          min={1}
                                          value={newLessonQuestion.points}
                                          onChange={(e) => setNewLessonQuestion({ ...newLessonQuestion, points: Number(e.target.value) || 1 })}
                                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                          placeholder="Points"
                                        />
                                      </div>
                                      <button
                                        onClick={addLessonTestQuestion}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800"
                                      >
                                        <PlusCircle className="w-3.5 h-3.5" /> Add Question
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Module Milestones</p>
                        <button
                          onClick={() => router.push(`/dashboard/instructor/courses/${courseId}/modules/${mod.id}/milestones/new`)}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700"
                        >
                          <PlusCircle className="w-4 h-4" /> Add in page
                        </button>
                      </div>

                      <div className="space-y-3">
                        {(mod.milestones || []).map((milestone: any) => (
                          <div key={milestone.id} className="rounded-xl border border-gray-100 overflow-hidden">
                            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{milestone.title}</p>
                                <p className="text-xs text-gray-400">{milestone.milestone_type.toUpperCase()} milestone · {milestone.question_count || 0} questions</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => deleteMilestone(mod.id, milestone.id)}
                                  className="text-xs text-red-500 hover:text-red-600"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => router.push(`/dashboard/instructor/courses/${courseId}/modules/${mod.id}/milestones/${milestone.id}`)}
                                  className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700"
                                >
                                  <Award className="w-4 h-4" /> Open Editor
                                </button>
                              </div>
                            </div>

                            {activeMilestoneId === milestone.id && (
                              <div className="px-4 py-4 space-y-3 bg-white">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <input
                                    type="text"
                                    value={milestoneForm.title}
                                    onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Milestone title"
                                  />
                                  <select
                                    value={milestoneForm.milestone_type}
                                    onChange={(e) => setMilestoneForm({ ...milestoneForm, milestone_type: e.target.value })}
                                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  >
                                    <option value="mcq">Multiple Choice</option>
                                    <option value="project">Project Submission</option>
                                  </select>
                                </div>
                                <textarea
                                  value={milestoneForm.description}
                                  onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
                                  rows={2}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                  placeholder="Milestone description"
                                />
                                {milestoneForm.milestone_type === "project" && (
                                  <input
                                    type="url"
                                    value={milestoneForm.project_link}
                                    onChange={(e) => setMilestoneForm({ ...milestoneForm, project_link: e.target.value })}
                                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Project brief link"
                                  />
                                )}
                                <button
                                  onClick={() => saveMilestone(mod.id)}
                                  className="w-full bg-purple-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                                >
                                  Save Milestone
                                </button>

                                {milestoneForm.milestone_type === "mcq" && (
                                  <div className="space-y-3 pt-2 border-t border-gray-100">
                                    <div className="space-y-2">
                                      {milestoneQuestions.map((question: any, questionIndex: number) => (
                                        <div key={question.id} className="rounded-lg border border-gray-100 p-3">
                                          <div className="flex items-start justify-between gap-3">
                                            <div>
                                              <p className="text-xs text-gray-400">Q{questionIndex + 1}</p>
                                              <p className="text-sm font-medium text-gray-800">{question.question_text}</p>
                                            </div>
                                            <button
                                              onClick={() => deleteMilestoneQuestion(question.id)}
                                              className="text-xs text-red-500 hover:text-red-600"
                                            >
                                              Remove
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    <div className="rounded-lg border border-dashed border-gray-200 p-3 space-y-3">
                                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Add Question</p>
                                      <textarea
                                        value={newMilestoneQuestion.question_text}
                                        onChange={(e) => setNewMilestoneQuestion({ ...newMilestoneQuestion, question_text: e.target.value })}
                                        rows={2}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                        placeholder="Question text"
                                      />
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {newMilestoneQuestion.options.map((option: string, optionIndex: number) => (
                                          <input
                                            key={`${milestone.id}-option-${optionIndex}`}
                                            value={option}
                                            onChange={(e) => {
                                              const nextOptions = [...newMilestoneQuestion.options];
                                              nextOptions[optionIndex] = e.target.value;
                                              setNewMilestoneQuestion({ ...newMilestoneQuestion, options: nextOptions });
                                            }}
                                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            placeholder={`Option ${optionIndex + 1}`}
                                          />
                                        ))}
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <input
                                          type="text"
                                          value={newMilestoneQuestion.correct_answer}
                                          onChange={(e) => setNewMilestoneQuestion({ ...newMilestoneQuestion, correct_answer: e.target.value })}
                                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                          placeholder="Correct answer"
                                        />
                                        <input
                                          type="number"
                                          min={1}
                                          value={newMilestoneQuestion.points}
                                          onChange={(e) => setNewMilestoneQuestion({ ...newMilestoneQuestion, points: Number(e.target.value) || 1 })}
                                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                          placeholder="Points"
                                        />
                                      </div>
                                      <button
                                        onClick={addMilestoneQuestion}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800"
                                      >
                                        <PlusCircle className="w-3.5 h-3.5" /> Add Question
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}

                        {activeMilestoneId === "new" && expandedModule === mod.id && (
                          <div className="rounded-xl border border-gray-100 p-4 space-y-3 bg-white">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={milestoneForm.title}
                                onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="Milestone title"
                              />
                              <select
                                value={milestoneForm.milestone_type}
                                onChange={(e) => setMilestoneForm({ ...milestoneForm, milestone_type: e.target.value })}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="mcq">Multiple Choice</option>
                                <option value="project">Project Submission</option>
                              </select>
                            </div>
                            <textarea
                              value={milestoneForm.description}
                              onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
                              rows={2}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                              placeholder="Milestone description"
                            />
                            {milestoneForm.milestone_type === "project" && (
                              <input
                                type="url"
                                value={milestoneForm.project_link}
                                onChange={(e) => setMilestoneForm({ ...milestoneForm, project_link: e.target.value })}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="Project brief link"
                              />
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveMilestone(mod.id)}
                                className="flex-1 bg-purple-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                              >
                                Create Milestone
                              </button>
                              <button
                                onClick={() => setActiveMilestoneId(null)}
                                className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {!(mod.milestones || []).length && activeMilestoneId !== "new" && (
                          <p className="text-sm text-gray-400">No milestones yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
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
