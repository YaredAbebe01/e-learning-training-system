"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, PencilLine, PlusCircle, Save, Trash2 } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string; lessonId: string }>;
}

type LessonForm = {
  title: string;
  subtitle: string;
  video_url: string;
  description: string;
  resource_url: string;
  resource_name: string;
};

const emptyForm: LessonForm = {
  title: "",
  subtitle: "",
  video_url: "",
  description: "",
  resource_url: "",
  resource_name: "",
};

export default function LessonEditorPage({ params }: PageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [courseId, setCourseId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [moduleIdHint, setModuleIdHint] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<any>(null);
  const [moduleData, setModuleData] = useState<any>(null);
  const [lesson, setLesson] = useState<any>(null);
  const [lessonForm, setLessonForm] = useState<LessonForm>(emptyForm);

  const isNewLesson = lessonId === "new";

  useEffect(() => {
    params.then((resolved) => {
      setCourseId(resolved.id);
      setLessonId(resolved.lessonId);
    });
  }, [params]);

  useEffect(() => {
    setModuleIdHint(searchParams.get("moduleId") || "");
  }, [searchParams]);

  useEffect(() => {
    if (!courseId || !lessonId) return;
    void loadPage();
  }, [courseId, lessonId, moduleIdHint]);

  const loadPage = async () => {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/instructor/courses/${courseId}`);
    if (!response.ok) {
      setError("Unable to load course details.");
      setLoading(false);
      return;
    }

    const payload = await response.json();
    const nextCourse = payload.course || null;
    const modules = payload.modules || [];

    let nextModule = null;
    let nextLesson = null;

    if (isNewLesson) {
      nextModule = modules.find((moduleItem: any) => String(moduleItem.id) === String(moduleIdHint)) || null;
    } else {
      for (const moduleItem of modules) {
        const match = (moduleItem.lessons || []).find((lessonItem: any) => String(lessonItem.id) === String(lessonId));
        if (match) {
          nextModule = moduleItem;
          nextLesson = match;
          break;
        }
      }
    }

    setCourse(nextCourse);
    setModuleData(nextModule);
    setLesson(nextLesson);

    if (!nextModule) {
      setError(isNewLesson ? "Choose a module first before creating a lesson." : "Lesson not found.");
      setLoading(false);
      return;
    }

    setLessonForm(
      nextLesson
        ? {
            title: nextLesson.title || "",
            subtitle: nextLesson.subtitle || "",
            video_url: nextLesson.video_url || "",
            description: nextLesson.description || "",
            resource_url: nextLesson.resource_url || nextLesson.pdf_url || "",
            resource_name: nextLesson.resource_name || "",
          }
        : emptyForm
    );
    setLoading(false);
  };

  const saveLesson = async () => {
    if (!moduleData?.id || !lessonForm.title.trim()) {
      setError("Lesson title is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const endpoint = isNewLesson
      ? `/api/instructor/courses/${courseId}/lessons`
      : `/api/instructor/courses/${courseId}/lessons/${lessonId}`;
    const method = isNewLesson ? "POST" : "PATCH";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module_id: moduleData.id,
        title: lessonForm.title,
        subtitle: lessonForm.subtitle,
        video_url: lessonForm.video_url,
        description: lessonForm.description,
        resource_url: lessonForm.resource_url,
        resource_name: lessonForm.resource_name,
        resource_type: lessonForm.resource_url ? "link" : null,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error || "Unable to save lesson.");
      setSaving(false);
      return;
    }

    setSaving(false);

    if (isNewLesson && payload?.id) {
      router.replace(`/dashboard/instructor/courses/${courseId}/lessons/${payload.id}`);
      return;
    }

    await loadPage();
  };

  const deleteLesson = async () => {
    if (isNewLesson || !lessonId) return;
    if (!confirm("Delete this lesson?")) return;

    const response = await fetch(`/api/instructor/courses/${courseId}/lessons/${lessonId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("Unable to delete lesson.");
      return;
    }

    router.push(`/dashboard/instructor/courses/${courseId}/modules/${moduleData?.id}`);
  };

  if (loading) {
    return <div className="py-16 text-center text-gray-400">Loading lesson editor...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href={`/dashboard/instructor/courses/${courseId}/modules/${moduleData?.id || ""}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" /> Back to module studio
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">{isNewLesson ? "Lesson Creator" : "Lesson Editor"}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {course?.title || "Course"} / {moduleData?.title || "Module"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isNewLesson && (
            <Link
              href={`/dashboard/instructor/courses/${courseId}/lessons/${lessonId}/test`}
              className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
            >
              <ClipboardList className="w-4 h-4" /> Open Test Editor
            </Link>
          )}
          {!isNewLesson && (
            <button
              onClick={deleteLesson}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
            >
              <Trash2 className="w-4 h-4" /> Delete Lesson
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <PencilLine className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Lesson Details</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-gray-700">Lesson title</span>
              <input
                type="text"
                value={lessonForm.title}
                onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Introduction to the module"
              />
            </label>

            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-gray-700">Subtitle</span>
              <input
                type="text"
                value={lessonForm.subtitle}
                onChange={(e) => setLessonForm({ ...lessonForm, subtitle: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Short context learners see under the title"
              />
            </label>

            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-gray-700">Video link</span>
              <input
                type="url"
                value={lessonForm.video_url}
                onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="YouTube or Vimeo link"
              />
            </label>

            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-gray-700">Resource link</span>
              <input
                type="url"
                value={lessonForm.resource_url}
                onChange={(e) => setLessonForm({ ...lessonForm, resource_url: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Google Drive, Canva, Docs, Slides, PDF, or PPT link"
              />
            </label>

            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-gray-700">Resource label</span>
              <input
                type="text"
                value={lessonForm.resource_name}
                onChange={(e) => setLessonForm({ ...lessonForm, resource_name: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Workbook, slides, project brief, or another label"
              />
            </label>

            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-gray-700">Description</span>
              <textarea
                value={lessonForm.description}
                onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                rows={8}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
                placeholder="Explain what learners should do in this lesson."
              />
            </label>
          </div>

          <button
            onClick={saveLesson}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-70"
          >
            <Save className="w-4 h-4" /> {saving ? "Saving..." : isNewLesson ? "Create Lesson" : "Save Lesson"}
          </button>
        </section>

        <section className="rounded-2xl border border-gray-900 bg-gray-950 p-6 text-white shadow-sm space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Authoring</p>
            <h2 className="mt-2 text-xl font-semibold">Full-page lesson workflow</h2>
            <p className="mt-2 text-sm text-gray-400">Write the lesson here first, then attach the lesson test from the secondary editor once the lesson is saved.</p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Current module</p>
            <p className="mt-2 text-lg font-semibold text-white">{moduleData?.title || "Module"}</p>
            <p className="mt-2 text-sm text-gray-400">{moduleData?.description || "No module description yet."}</p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Next step</p>
              {!isNewLesson && (
                <Link
                  href={`/dashboard/instructor/courses/${courseId}/lessons/${lessonId}/test`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-300 hover:text-white"
                >
                  <ClipboardList className="w-3.5 h-3.5" /> Open test page
                </Link>
              )}
            </div>
            <p className="text-sm text-gray-300">
              {isNewLesson
                ? "Save the lesson once, then the test editor link becomes available."
                : "This lesson is ready for test authoring, milestone planning, and learner release."}
            </p>
            {isNewLesson && (
              <div className="inline-flex items-center gap-2 rounded-full border border-gray-800 bg-gray-950 px-3 py-1 text-xs text-gray-400">
                <PlusCircle className="w-3.5 h-3.5" /> New lesson draft
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}