"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Award, ClipboardList, PencilLine, PlusCircle, Trash2 } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string; moduleId: string }>;
}

export default function ModuleBuilderPage({ params }: PageProps) {
  const [courseId, setCourseId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [course, setCourse] = useState<any>(null);
  const [moduleData, setModuleData] = useState<any>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    params.then((p) => {
      setCourseId(p.id);
      setModuleId(p.moduleId);
    });
  }, [params]);

  useEffect(() => {
    if (!courseId || !moduleId) return;
    const load = async () => {
      const response = await fetch(`/api/instructor/courses/${courseId}`);
      if (!response.ok) {
        setLoading(false);
        return;
      }
      const payload = await response.json();
      setCourse(payload.course || null);
      const modules = payload.modules || [];
      const mod = modules.find((m: any) => String(m.id) === String(moduleId)) || null;
      setModuleData(mod);
      setLessons((mod?.lessons || []).slice().sort((a: any, b: any) => a.order_index - b.order_index));
      setMilestones((mod?.milestones || []).slice().sort((a: any, b: any) => a.order_index - b.order_index));
      setLoading(false);
    };
    load();
  }, [courseId, moduleId]);

  const refreshModule = async () => {
    const response = await fetch(`/api/instructor/courses/${courseId}`);
    if (response.ok) {
      const payload = await response.json();
      const modules = payload.modules || [];
      const mod = modules.find((m: any) => String(m.id) === String(moduleId)) || null;
      setModuleData(mod);
      setLessons((mod?.lessons || []).slice().sort((a: any, b: any) => a.order_index - b.order_index));
      setMilestones((mod?.milestones || []).slice().sort((a: any, b: any) => a.order_index - b.order_index));
    }
  };

  const deleteLesson = async (lessonId: string) => {
    await fetch(`/api/instructor/courses/${courseId}/lessons/${lessonId}`, {
      method: "DELETE",
    });
    setLessons((prev) => prev.filter((lesson) => lesson.id !== lessonId));
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
    await refreshModule();
    await openLessonTest({ id: activeLessonTestId, title: lessonTestForm.title });
  };

  const deleteLessonTest = async () => {
    if (!activeLessonTestId) return;
    await fetch(`/api/instructor/lessons/${activeLessonTestId}/test`, { method: "DELETE" });
    setLessonTestQuestions([]);
    setLessonTestForm({
      title: "",
      description: "",
      test_type: "mcq",
      passing_score: 70,
      time_limit_minutes: "",
      project_prompt: "",
      project_link: "",
    });
    await refreshModule();
  };

  const addLessonTestQuestion = async () => {
    if (!activeLessonTestId || !newLessonQuestion.question_text.trim()) return;
    const options = newLessonQuestion.options.filter((o: string) => o.trim());
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

  const openMilestone = async (milestone: any) => {
    setActiveMilestoneId(milestone?.id || "new");
    if (!milestone?.id) {
      setMilestoneForm({ title: "", description: "", milestone_type: "mcq", project_link: "" });
      setMilestoneQuestions([]);
      return;
    }
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

  const saveMilestone = async () => {
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
    await refreshModule();
  };

  const deleteMilestone = async (milestoneId: string) => {
    await fetch(`/api/instructor/modules/${moduleId}/milestones/${milestoneId}`, { method: "DELETE" });
    setMilestoneQuestions([]);
    setActiveMilestoneId(null);
    await refreshModule();
  };

  const addMilestoneQuestion = async () => {
    if (!activeMilestoneId || activeMilestoneId === "new" || !newMilestoneQuestion.question_text.trim()) return;
    const options = newMilestoneQuestion.options.filter((o: string) => o.trim());
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

  if (loading) {
    return <div className="text-center py-16 text-gray-400">Loading module...</div>;
  }

  if (!moduleData) {
    return (
      <div className="max-w-4xl mx-auto py-10 text-center text-gray-500">
        <p>Module not found.</p>
        <Link href={`/dashboard/instructor/courses/${courseId}`} className="text-purple-600 hover:underline text-sm">
          Back to course
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <Link href={`/dashboard/instructor/courses/${courseId}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Back to course
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <h1 className="text-xl font-bold text-gray-900">{moduleData.title}</h1>
        {moduleData.description && (
          <p className="text-gray-500 text-sm mt-1">{moduleData.description}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-400">
          {moduleData.link_url && <span>Link: {moduleData.link_url}</span>}
          {moduleData.image_url && <span>Image: {moduleData.image_url}</span>}
        </div>
      </div>

      <div className="space-y-6">
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Build lessons</h2>
              <p className="text-xs text-gray-400 mt-1">Create and edit lessons in a dedicated page, the same way you open test creators.</p>
            </div>
            <Link
              href={`/dashboard/instructor/courses/${courseId}/lessons/new?moduleId=${moduleId}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add lesson
            </Link>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Lessons in this module</h3>
            <div className="space-y-2">
              {lessons.length === 0 && <p className="text-sm text-gray-400">No lessons yet.</p>}
              {lessons.map((lesson) => (
                <div key={lesson.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{lesson.title}</p>
                    <p className="text-xs text-gray-400 truncate">{lesson.subtitle || lesson.video_url || "No lesson subtitle yet"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/dashboard/instructor/courses/${courseId}/lessons/${lesson.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700"
                    >
                      <PencilLine className="w-3.5 h-3.5" /> Edit in page
                    </Link>
                    <button
                      onClick={() => deleteLesson(lesson.id)}
                      className="text-xs text-red-500 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Lesson tests</h3>
                <p className="text-xs text-gray-400 mt-1">Add and edit tests in a full-page editor.</p>
              </div>
            </div>
            <div className="space-y-3">
              {lessons.length === 0 && <p className="text-sm text-gray-400">Add lessons first to attach tests.</p>}
              {lessons.map((lesson) => (
                <div key={`${lesson.id}-test`} className="border border-gray-100 rounded-lg">
                  <div className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{lesson.title}</p>
                      <p className="text-xs text-gray-400">
                        {lesson.lesson_test ? `${lesson.lesson_test.test_type.toUpperCase()} test · ${lesson.lesson_test.question_count || 0} questions` : "No test yet"}
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/instructor/courses/${courseId}/lessons/${lesson.id}/test`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700"
                    >
                      <ClipboardList className="w-3.5 h-3.5" /> {lesson.lesson_test ? "Edit in page" : "Add in page"}
                    </Link>
                  </div>

                  {activeLessonTestId === lesson.id && (
                    <div className="border-t border-gray-100 px-3 py-3 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                        placeholder="Test description (optional)"
                      />
                      {lessonTestForm.test_type === "mcq" ? (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min={1}
                            value={lessonTestForm.passing_score}
                            onChange={(e) => setLessonTestForm({ ...lessonTestForm, passing_score: Number(e.target.value) || 0 })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Passing score"
                          />
                          <input
                            type="number"
                            min={1}
                            value={lessonTestForm.time_limit_minutes}
                            onChange={(e) => setLessonTestForm({ ...lessonTestForm, time_limit_minutes: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Time limit (minutes)"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <textarea
                            value={lessonTestForm.project_prompt}
                            onChange={(e) => setLessonTestForm({ ...lessonTestForm, project_prompt: e.target.value })}
                            rows={2}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                            placeholder="Project prompt (optional)"
                          />
                          <input
                            type="url"
                            value={lessonTestForm.project_link}
                            onChange={(e) => setLessonTestForm({ ...lessonTestForm, project_link: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Project brief link (optional)"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={saveLessonTest}
                          className="flex-1 bg-purple-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors"
                        >
                          Save Test
                        </button>
                        <button
                          onClick={deleteLessonTest}
                          className="flex items-center justify-center gap-1.5 bg-gray-100 text-gray-600 py-2 px-3 rounded-lg text-xs font-medium hover:bg-gray-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>

                      {lessonTestForm.test_type === "mcq" && (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            {lessonTestQuestions.map((q: any, idx: number) => (
                              <div key={q.id} className="border border-gray-100 rounded-lg p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-xs text-gray-400">Q{idx + 1}</p>
                                    <p className="text-sm text-gray-700 font-medium">{q.question_text}</p>
                                  </div>
                                  <button
                                    onClick={() => deleteLessonTestQuestion(q.id)}
                                    className="text-xs text-red-500 hover:text-red-600"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                            {!lessonTestQuestions.length && (
                              <p className="text-xs text-gray-400">No questions yet.</p>
                            )}
                          </div>

                          <div className="border border-dashed border-gray-200 rounded-lg p-3 space-y-2">
                            <p className="text-xs font-semibold text-gray-500">Add question</p>
                            <textarea
                              value={newLessonQuestion.question_text}
                              onChange={(e) => setNewLessonQuestion({ ...newLessonQuestion, question_text: e.target.value })}
                              rows={2}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                              placeholder="Question text"
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {newLessonQuestion.options.map((opt: string, i: number) => (
                                <input
                                  key={i}
                                  value={opt}
                                  onChange={(e) => {
                                    const next = [...newLessonQuestion.options];
                                    next[i] = e.target.value;
                                    setNewLessonQuestion({ ...newLessonQuestion, options: next });
                                  }}
                                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  placeholder={`Option ${i + 1}`}
                                />
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
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
                              className="inline-flex items-center gap-1.5 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-800"
                            >
                              <PlusCircle className="w-3.5 h-3.5" /> Add question
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

          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Module milestones</h3>
                <p className="text-xs text-gray-400 mt-1">Create and edit milestones in a full-page editor.</p>
              </div>
              <Link
                href={`/dashboard/instructor/courses/${courseId}/modules/${moduleId}/milestones/new`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Add milestone
              </Link>
            </div>
            <div className="space-y-3">
              {milestones.length === 0 && <p className="text-sm text-gray-400">No milestones yet.</p>}
              {milestones.map((milestone) => (
                <div key={milestone.id} className="border border-gray-100 rounded-lg">
                  <div className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{milestone.title}</p>
                      <p className="text-xs text-gray-400">
                        {milestone.milestone_type.toUpperCase()} milestone · {milestone.question_count || 0} questions
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/instructor/courses/${courseId}/modules/${moduleId}/milestones/${milestone.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700"
                      >
                        <Award className="w-3.5 h-3.5" /> Edit in page
                      </Link>
                      <button
                        onClick={() => deleteMilestone(milestone.id)}
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {activeMilestoneId === milestone.id && (
                    <div className="border-t border-gray-100 px-3 py-3 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Project brief link (optional)"
                        />
                      )}
                      <button
                        onClick={saveMilestone}
                        className="w-full bg-purple-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-purple-700"
                      >
                        Save milestone
                      </button>

                      {milestoneForm.milestone_type === "mcq" && (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            {milestoneQuestions.map((q: any, idx: number) => (
                              <div key={q.id} className="border border-gray-100 rounded-lg p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-xs text-gray-400">Q{idx + 1}</p>
                                    <p className="text-sm text-gray-700 font-medium">{q.question_text}</p>
                                  </div>
                                  <button
                                    onClick={() => deleteMilestoneQuestion(q.id)}
                                    className="text-xs text-red-500 hover:text-red-600"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                            {!milestoneQuestions.length && (
                              <p className="text-xs text-gray-400">No questions yet.</p>
                            )}
                          </div>

                          <div className="border border-dashed border-gray-200 rounded-lg p-3 space-y-2">
                            <p className="text-xs font-semibold text-gray-500">Add question</p>
                            <textarea
                              value={newMilestoneQuestion.question_text}
                              onChange={(e) => setNewMilestoneQuestion({ ...newMilestoneQuestion, question_text: e.target.value })}
                              rows={2}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                              placeholder="Question text"
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {newMilestoneQuestion.options.map((opt: string, i: number) => (
                                <input
                                  key={i}
                                  value={opt}
                                  onChange={(e) => {
                                    const next = [...newMilestoneQuestion.options];
                                    next[i] = e.target.value;
                                    setNewMilestoneQuestion({ ...newMilestoneQuestion, options: next });
                                  }}
                                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  placeholder={`Option ${i + 1}`}
                                />
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
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
                              className="inline-flex items-center gap-1.5 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-800"
                            >
                              <PlusCircle className="w-3.5 h-3.5" /> Add question
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {activeMilestoneId === "new" && (
                <div className="border border-gray-100 rounded-lg px-3 py-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Project brief link (optional)"
                    />
                  )}
                  <button
                    onClick={saveMilestone}
                    className="w-full bg-purple-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-purple-700"
                  >
                    Create milestone
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
