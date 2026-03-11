"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, PencilLine, PlusCircle, Save, Trash2, X } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string; lessonId: string }>;
}

type TestForm = {
  title: string;
  description: string;
  test_type: "mcq" | "project";
  passing_score: number;
  time_limit_minutes: string;
  project_prompt: string;
  project_link: string;
};

type QuestionDraft = {
  question_text: string;
  options: string[];
  correct_answer: string;
  points: number;
};

const createOptionDraft = (count = 4, source: string[] = []) => {
  const size = Math.max(count, source.length, 2);
  const next = source.slice(0, size);
  while (next.length < size) next.push("");
  return next;
};

const emptyQuestion = (): QuestionDraft => ({
  question_text: "",
  options: createOptionDraft(),
  correct_answer: "",
  points: 1,
});

export default function LessonTestEditorPage({ params }: PageProps) {
  const router = useRouter();
  const [courseId, setCourseId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lesson, setLesson] = useState<any>(null);
  const [moduleData, setModuleData] = useState<any>(null);
  const [testExists, setTestExists] = useState(false);
  const [testForm, setTestForm] = useState<TestForm>({
    title: "",
    description: "",
    test_type: "mcq",
    passing_score: 70,
    time_limit_minutes: "",
    project_prompt: "",
    project_link: "",
  });
  const [questions, setQuestions] = useState<any[]>([]);
  const [draftQuestion, setDraftQuestion] = useState<QuestionDraft>(emptyQuestion());
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((resolved) => {
      setCourseId(resolved.id);
      setLessonId(resolved.lessonId);
    });
  }, [params]);

  useEffect(() => {
    if (!courseId || !lessonId) return;
    void loadPage();
  }, [courseId, lessonId]);

  const loadPage = async () => {
    setLoading(true);
    setError(null);

    const [courseResponse, testResponse] = await Promise.all([
      fetch(`/api/instructor/courses/${courseId}`),
      fetch(`/api/instructor/lessons/${lessonId}/test`),
    ]);

    if (!courseResponse.ok) {
      setError("Unable to load lesson details.");
      setLoading(false);
      return;
    }

    const coursePayload = await courseResponse.json();
    const modules = coursePayload.modules || [];
    let nextModule = null;
    let nextLesson = null;
    for (const moduleItem of modules) {
      const match = (moduleItem.lessons || []).find((lessonItem: any) => String(lessonItem.id) === String(lessonId));
      if (match) {
        nextModule = moduleItem;
        nextLesson = match;
        break;
      }
    }
    setModuleData(nextModule);
    setLesson(nextLesson);

    if (!testResponse.ok) {
      setTestExists(false);
      setQuestions([]);
      setTestForm({
        title: nextLesson?.title ? `${nextLesson.title} Test` : "Lesson Test",
        description: "",
        test_type: "mcq",
        passing_score: 70,
        time_limit_minutes: "",
        project_prompt: "",
        project_link: "",
      });
      setLoading(false);
      return;
    }

    const testPayload = await testResponse.json();
    const test = testPayload?.test;
    setTestExists(Boolean(test));
    setTestForm({
      title: test?.title || (nextLesson?.title ? `${nextLesson.title} Test` : "Lesson Test"),
      description: test?.description || "",
      test_type: test?.test_type || "mcq",
      passing_score: test?.passing_score || 70,
      time_limit_minutes: test?.time_limit_minutes ? String(test.time_limit_minutes) : "",
      project_prompt: test?.project_prompt || "",
      project_link: test?.project_link || "",
    });
    setQuestions((testPayload?.questions || []).map((question: any) => ({ ...question, id: String(question.id || question._id) })));
    setLoading(false);
  };

  const saveTest = async () => {
    if (!testForm.title.trim()) return;
    setSaving(true);
    setError(null);
    const response = await fetch(`/api/instructor/lessons/${lessonId}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...testForm,
        time_limit_minutes: testForm.time_limit_minutes ? Number(testForm.time_limit_minutes) : null,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error || "Unable to save lesson test.");
      setSaving(false);
      return;
    }
    setSaving(false);
    await loadPage();
  };

  const deleteTest = async () => {
    if (!confirm("Delete this lesson test?")) return;
    const response = await fetch(`/api/instructor/lessons/${lessonId}/test`, { method: "DELETE" });
    if (!response.ok) {
      setError("Unable to delete lesson test.");
      return;
    }
    router.push(`/dashboard/instructor/courses/${courseId}/modules/${moduleData?.id}`);
  };

  const startEditQuestion = (question: any) => {
    setEditingQuestionId(question.id);
    setDraftQuestion({
      question_text: question.question_text || "",
      options: createOptionDraft(4, question.options || []),
      correct_answer: question.correct_answer || "",
      points: Number(question.points) || 1,
    });
  };

  const updateOptionAt = (index: number, value: string) => {
    setDraftQuestion((prev) => {
      const nextOptions = [...prev.options];
      const previousValue = nextOptions[index];
      nextOptions[index] = value;
      return {
        ...prev,
        options: nextOptions,
        correct_answer: prev.correct_answer === previousValue ? value : prev.correct_answer,
      };
    });
  };

  const changeOptionCount = (delta: number) => {
    setDraftQuestion((prev) => {
      const nextCount = Math.max(2, prev.options.length + delta);
      if (nextCount === prev.options.length) return prev;
      const nextOptions = createOptionDraft(nextCount, prev.options).slice(0, nextCount);
      const nextCorrectAnswer = nextOptions.includes(prev.correct_answer) ? prev.correct_answer : "";
      return { ...prev, options: nextOptions, correct_answer: nextCorrectAnswer };
    });
  };

  const resetQuestionEditor = () => {
    setEditingQuestionId(null);
    setDraftQuestion(emptyQuestion());
  };

  const saveQuestion = async () => {
    if (!testExists) {
      setError("Save the lesson test first before adding questions.");
      return;
    }
    if (!draftQuestion.question_text.trim()) return;
    const options = draftQuestion.options.map((option) => option.trim()).filter(Boolean);
    if (options.length < 2) {
      setError("Add at least two options.");
      return;
    }
    if (!options.includes(draftQuestion.correct_answer.trim())) {
      setError("Select the correct answer with the radio button.");
      return;
    }

    setError(null);
    const endpoint = editingQuestionId
      ? `/api/instructor/lessons/${lessonId}/test/questions/${editingQuestionId}`
      : `/api/instructor/lessons/${lessonId}/test/questions`;
    const method = editingQuestionId ? "PATCH" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_text: draftQuestion.question_text,
        options,
        correct_answer: draftQuestion.correct_answer,
        points: draftQuestion.points,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error || "Unable to save question.");
      return;
    }

    resetQuestionEditor();
    await loadPage();
  };

  const deleteQuestion = async (questionId: string) => {
    const response = await fetch(`/api/instructor/lessons/${lessonId}/test/questions/${questionId}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Unable to delete question.");
      return;
    }
    if (editingQuestionId === questionId) resetQuestionEditor();
    await loadPage();
  };

  if (loading) {
    return <div className="py-16 text-center text-gray-400">Loading lesson test editor...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href={`/dashboard/instructor/courses/${courseId}/modules/${moduleData?.id || ""}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" /> Back to module studio
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Lesson Test Editor</h1>
          <p className="text-sm text-gray-500 mt-1">
            {moduleData?.title || "Module"} / {lesson?.title || "Lesson"}
          </p>
        </div>
        {testExists && (
          <button
            onClick={deleteTest}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
          >
            <Trash2 className="w-4 h-4" /> Delete Test
          </button>
        )}
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Test Setup</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                value={testForm.title}
                onChange={(event) => setTestForm((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Lesson test title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={testForm.test_type}
                onChange={(event) => setTestForm((prev) => ({ ...prev, test_type: event.target.value as "mcq" | "project" }))}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="mcq">Multiple choice</option>
                <option value="project">Project submission</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passing Score (%)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={testForm.passing_score}
                onChange={(event) => setTestForm((prev) => ({ ...prev, passing_score: Number(event.target.value) || 70 }))}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={testForm.description}
                onChange={(event) => setTestForm((prev) => ({ ...prev, description: event.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Explain what the learner should know before taking this test."
              />
            </div>

            {testForm.test_type === "mcq" ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time Limit (minutes)</label>
                <input
                  type="number"
                  min={1}
                  value={testForm.time_limit_minutes}
                  onChange={(event) => setTestForm((prev) => ({ ...prev, time_limit_minutes: event.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional"
                />
              </div>
            ) : (
              <>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Prompt</label>
                  <textarea
                    rows={4}
                    value={testForm.project_prompt}
                    onChange={(event) => setTestForm((prev) => ({ ...prev, project_prompt: event.target.value }))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Describe what learners must submit."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Brief Link</label>
                  <input
                    type="url"
                    value={testForm.project_link}
                    onChange={(event) => setTestForm((prev) => ({ ...prev, project_link: event.target.value }))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional"
                  />
                </div>
              </>
            )}
          </div>

          <button
            onClick={saveTest}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-70"
          >
            <Save className="w-4 h-4" /> {saving ? "Saving..." : testExists ? "Save Changes" : "Create Test"}
          </button>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Questions</h2>
              <p className="text-sm text-gray-500">You can review the saved correct answers and edit any question.</p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">{questions.length} saved</span>
          </div>

          {testForm.test_type === "project" ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-sm text-gray-500">
              Project-based tests do not use question items.
            </div>
          ) : (
            <>
              <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                {questions.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-sm text-gray-500">
                    No questions yet. Add the first one below.
                  </div>
                )}
                {questions.map((question, index) => (
                  <div key={question.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>Q{index + 1}</span>
                          <span>{question.points || 1} pt</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 break-words">{question.question_text}</p>
                        <div className="space-y-1">
                          {(question.options || []).map((option: string) => (
                            <div
                              key={`${question.id}-${option}`}
                              className={`rounded-lg px-3 py-2 text-xs ${option === question.correct_answer ? "bg-green-100 text-green-700 font-medium" : "bg-white text-gray-600 border border-gray-200"}`}
                            >
                              {option === question.correct_answer ? "Correct: " : "Option: "}
                              {option}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => startEditQuestion(question)} className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-white">
                          <PencilLine className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteQuestion(question.id)} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-gray-900">{editingQuestionId ? "Edit Question" : "Add Question"}</h3>
                  {editingQuestionId && (
                    <button onClick={resetQuestionEditor} className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-800">
                      <X className="w-3.5 h-3.5" /> Cancel edit
                    </button>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={draftQuestion.question_text}
                  onChange={(event) => setDraftQuestion((prev) => ({ ...prev, question_text: event.target.value }))}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Question text"
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2 flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Choices</p>
                      <p className="text-xs text-gray-500">Default is 4. Increase or decrease as needed.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => changeOptionCount(-1)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">-</button>
                      <span className="min-w-8 text-center text-sm font-medium text-gray-700">{draftQuestion.options.length}</span>
                      <button type="button" onClick={() => changeOptionCount(1)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">+</button>
                    </div>
                  </div>
                  {draftQuestion.options.map((option, index) => (
                    <label key={`draft-option-${index}`} className="md:col-span-2 flex items-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus-within:ring-2 focus-within:ring-blue-500">
                      <input
                        type="radio"
                        name="lesson-test-correct-answer"
                        checked={draftQuestion.correct_answer === option && option.trim() !== ""}
                        onChange={() => setDraftQuestion((prev) => ({ ...prev, correct_answer: option }))}
                        className="accent-blue-600"
                        disabled={!option.trim()}
                      />
                      <input
                        value={option}
                        onChange={(event) => updateOptionAt(index, event.target.value)}
                        className="w-full bg-transparent focus:outline-none"
                        placeholder={`Option ${index + 1}`}
                      />
                    </label>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Question points</label>
                    <input
                      type="number"
                      min={1}
                      value={draftQuestion.points}
                      onChange={(event) => setDraftQuestion((prev) => ({ ...prev, points: Number(event.target.value) || 1 }))}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Question points"
                    />
                  </div>
                </div>

                <button
                  onClick={saveQuestion}
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
                >
                  {editingQuestionId ? <Save className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                  {editingQuestionId ? "Update Question" : "Add Question"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}