"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Award, PencilLine, PlusCircle, Save, Trash2, X } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string; moduleId: string; milestoneId: string }>;
}

type MilestoneForm = {
  title: string;
  description: string;
  milestone_type: "mcq" | "project";
  project_link: string;
};

type QuestionDraft = {
  question_text: string;
  options: string[];
  correct_answer: string;
  points: number;
};

type SubmissionReview = {
  id: string;
  submission_url: string;
  submitted_at?: string;
  review_status?: "pending" | "graded";
  score?: number | null;
  passed?: boolean | null;
  feedback?: string | null;
  graded_at?: string | null;
  learner?: {
    id: string;
    full_name?: string;
    email?: string;
  } | null;
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

export default function MilestoneEditorPage({ params }: PageProps) {
  const router = useRouter();
  const [courseId, setCourseId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moduleData, setModuleData] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [milestoneForm, setMilestoneForm] = useState<MilestoneForm>({
    title: "",
    description: "",
    milestone_type: "mcq",
    project_link: "",
  });
  const [draftQuestion, setDraftQuestion] = useState<QuestionDraft>(emptyQuestion());
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionReview[]>([]);
  const [gradingState, setGradingState] = useState<Record<string, { passed: "pass" | "fail"; score: string; feedback: string }>>({});
  const [gradingId, setGradingId] = useState<string | null>(null);

  const isNewMilestone = milestoneId === "new";

  useEffect(() => {
    params.then((resolved) => {
      setCourseId(resolved.id);
      setModuleId(resolved.moduleId);
      setMilestoneId(resolved.milestoneId);
    });
  }, [params]);

  useEffect(() => {
    if (!courseId || !moduleId || !milestoneId) return;
    void loadPage();
  }, [courseId, moduleId, milestoneId]);

  const loadPage = async () => {
    setLoading(true);
    setError(null);

    const courseResponse = await fetch(`/api/instructor/courses/${courseId}`);
    if (!courseResponse.ok) {
      setError("Unable to load module details.");
      setLoading(false);
      return;
    }

    const coursePayload = await courseResponse.json();
    const moduleMatch = (coursePayload.modules || []).find((item: any) => String(item.id) === String(moduleId));
    setModuleData(moduleMatch || null);

    if (isNewMilestone) {
      setMilestoneForm({ title: "", description: "", milestone_type: "mcq", project_link: "" });
      setQuestions([]);
      setLoading(false);
      return;
    }

    const milestoneResponse = await fetch(`/api/instructor/milestones/${milestoneId}/questions`);
    const milestonePayload = await milestoneResponse.json().catch(() => null);
    if (!milestoneResponse.ok) {
      setError(milestonePayload?.error || "Unable to load milestone.");
      setLoading(false);
      return;
    }

    setMilestoneForm({
      title: milestonePayload?.milestone?.title || "",
      description: milestonePayload?.milestone?.description || "",
      milestone_type: milestonePayload?.milestone?.milestone_type || "mcq",
      project_link: milestonePayload?.milestone?.project_link || "",
    });
    setQuestions((milestonePayload?.questions || []).map((question: any) => ({ ...question, id: String(question.id || question._id) })));

    if ((milestonePayload?.milestone?.milestone_type || "mcq") === "project") {
      const submissionsResponse = await fetch(`/api/instructor/milestones/${milestoneId}/submissions`);
      const submissionsPayload = await submissionsResponse.json().catch(() => null);
      if (submissionsResponse.ok) {
        const nextSubmissions = submissionsPayload?.submissions || [];
        setSubmissions(nextSubmissions);
        setGradingState(
          Object.fromEntries(
            nextSubmissions.map((entry: SubmissionReview) => [
              entry.id,
              {
                passed: entry.passed === false ? "fail" : "pass",
                score: entry.score === null || entry.score === undefined ? "" : String(entry.score),
                feedback: entry.feedback || "",
              },
            ])
          )
        );
      } else {
        setSubmissions([]);
      }
    } else {
      setSubmissions([]);
      setGradingState({});
    }
    setLoading(false);
  };

  const saveMilestone = async () => {
    if (!milestoneForm.title.trim()) return;
    setSaving(true);
    setError(null);

    const endpoint = isNewMilestone
      ? `/api/instructor/modules/${moduleId}/milestones`
      : `/api/instructor/modules/${moduleId}/milestones/${milestoneId}`;
    const method = isNewMilestone ? "POST" : "PATCH";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(milestoneForm),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error || "Unable to save milestone.");
      setSaving(false);
      return;
    }

    setSaving(false);
    if (isNewMilestone && payload?.id) {
      router.replace(`/dashboard/instructor/courses/${courseId}/modules/${moduleId}/milestones/${payload.id}`);
      return;
    }
    await loadPage();
  };

  const deleteMilestone = async () => {
    if (isNewMilestone || !confirm("Delete this milestone?")) return;
    const response = await fetch(`/api/instructor/modules/${moduleId}/milestones/${milestoneId}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Unable to delete milestone.");
      return;
    }
    router.push(`/dashboard/instructor/courses/${courseId}/modules/${moduleId}`);
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
    if (isNewMilestone) {
      setError("Save the milestone first before adding questions.");
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

    const endpoint = editingQuestionId
      ? `/api/instructor/milestones/${milestoneId}/questions/${editingQuestionId}`
      : `/api/instructor/milestones/${milestoneId}/questions`;
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
    const response = await fetch(`/api/instructor/milestones/${milestoneId}/questions/${questionId}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Unable to delete question.");
      return;
    }
    if (editingQuestionId === questionId) resetQuestionEditor();
    await loadPage();
  };

  const updateGradingState = (submissionId: string, field: "passed" | "score" | "feedback", value: string) => {
    setGradingState((prev) => ({
      ...prev,
      [submissionId]: {
        passed: prev[submissionId]?.passed || "pass",
        score: prev[submissionId]?.score || "",
        feedback: prev[submissionId]?.feedback || "",
        [field]: value,
      },
    }));
  };

  const gradeSubmission = async (submissionId: string) => {
    const draft = gradingState[submissionId];
    if (!draft) return;
    setGradingId(submissionId);
    setError(null);

    const response = await fetch(`/api/instructor/milestones/${milestoneId}/submissions/${submissionId}/grade`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        passed: draft.passed === "pass",
        score: draft.score === "" ? null : Number(draft.score),
        feedback: draft.feedback,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error || "Unable to save grade.");
      setGradingId(null);
      return;
    }

    await loadPage();
    setGradingId(null);
  };

  if (loading) {
    return <div className="py-16 text-center text-gray-400">Loading milestone editor...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href={`/dashboard/instructor/courses/${courseId}/modules/${moduleId}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" /> Back to module studio
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Milestone Editor</h1>
          <p className="text-sm text-gray-500 mt-1">{moduleData?.title || "Module"}</p>
        </div>
        {!isNewMilestone && (
          <button
            onClick={deleteMilestone}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
          >
            <Trash2 className="w-4 h-4" /> Delete Milestone
          </button>
        )}
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-900">Milestone Setup</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                value={milestoneForm.title}
                onChange={(event) => setMilestoneForm((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Milestone title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={milestoneForm.milestone_type}
                onChange={(event) => setMilestoneForm((prev) => ({ ...prev, milestone_type: event.target.value as "mcq" | "project" }))}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="mcq">Multiple choice</option>
                <option value="project">Project submission</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={4}
                value={milestoneForm.description}
                onChange={(event) => setMilestoneForm((prev) => ({ ...prev, description: event.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                placeholder="Explain what this milestone validates."
              />
            </div>

            {milestoneForm.milestone_type === "project" && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Brief Link</label>
                <input
                  type="url"
                  value={milestoneForm.project_link}
                  onChange={(event) => setMilestoneForm((prev) => ({ ...prev, project_link: event.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Optional"
                />
              </div>
            )}
          </div>

          <button
            onClick={saveMilestone}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-70"
          >
            <Save className="w-4 h-4" /> {saving ? "Saving..." : isNewMilestone ? "Create Milestone" : "Save Changes"}
          </button>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Questions</h2>
              <p className="text-sm text-gray-500">Saved answers stay visible while you edit.</p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">{questions.length} saved</span>
          </div>

          {milestoneForm.milestone_type === "project" ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-sm text-gray-500">
              Project-based milestones do not use question items.
            </div>
          ) : (
            <>
              <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                {questions.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-sm text-gray-500">
                    No questions yet. Save the milestone and add the first question below.
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

              <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 space-y-4">
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
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  placeholder="Question text"
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2 flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-white px-4 py-3">
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
                    <label key={`milestone-draft-option-${index}`} className="md:col-span-2 flex items-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus-within:ring-2 focus-within:ring-amber-500">
                      <input
                        type="radio"
                        name="milestone-correct-answer"
                        checked={draftQuestion.correct_answer === option && option.trim() !== ""}
                        onChange={() => setDraftQuestion((prev) => ({ ...prev, correct_answer: option }))}
                        className="accent-amber-500"
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
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
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

      {!isNewMilestone && milestoneForm.milestone_type === "project" && (
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Project Reviews</h2>
              <p className="text-sm text-gray-500">Grade learner submissions manually before the milestone counts as passed.</p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">{submissions.length} submissions</span>
          </div>

          {submissions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-sm text-gray-500">
              No learner submissions yet.
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((entry) => {
                const draft = gradingState[entry.id] || { passed: "pass", score: "", feedback: "" };
                return (
                  <div key={entry.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{entry.learner?.full_name || entry.learner?.email || "Learner"}</p>
                        {entry.learner?.email && <p className="text-xs text-gray-500 mt-1">{entry.learner.email}</p>}
                        <p className="text-xs text-gray-500 mt-2">Submitted {entry.submitted_at ? new Date(entry.submitted_at).toLocaleString() : "recently"}</p>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-xs font-medium ${entry.review_status === "graded" ? entry.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {entry.review_status === "graded" ? entry.passed ? "Passed" : "Needs revision" : "Pending review"}
                      </div>
                    </div>

                    <a href={entry.submission_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800">
                      Open submission
                    </a>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Result</label>
                        <select
                          value={draft.passed}
                          onChange={(event) => updateGradingState(entry.id, "passed", event.target.value)}
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="pass">Pass</option>
                          <option value="fail">Needs revision</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Score</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={draft.score}
                          onChange={(event) => updateGradingState(entry.id, "score", event.target.value)}
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="Optional"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Feedback</label>
                      <textarea
                        rows={3}
                        value={draft.feedback}
                        onChange={(event) => updateGradingState(entry.id, "feedback", event.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                        placeholder="Optional review notes"
                      />
                    </div>

                    {entry.graded_at && (
                      <p className="text-xs text-gray-500">Last graded {new Date(entry.graded_at).toLocaleString()}</p>
                    )}

                    <button
                      type="button"
                      onClick={() => gradeSubmission(entry.id)}
                      disabled={gradingId === entry.id}
                      className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-70"
                    >
                      <Save className="w-4 h-4" /> {gradingId === entry.id ? "Saving..." : "Save grade"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}