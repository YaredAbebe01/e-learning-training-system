"use client";

import { useMemo, useState } from "react";
import { ExternalLink, FileCheck2, Filter, Search, Sparkles } from "lucide-react";

type Summary = {
  total: number;
  pending_review: number;
  passed: number;
  failed: number;
  project_links: number;
};

type Option = {
  id: string;
  title?: string;
  full_name?: string;
  email?: string;
};

type RecordItem = {
  id: string;
  record_id: string;
  assessment_id: string;
  assessment_type: "lesson_test" | "milestone";
  assessment_label: string;
  format: "mcq" | "project";
  title: string;
  course_id: string;
  course_title: string;
  module_title: string;
  lesson_title?: string | null;
  learner_id: string | null;
  learner?: { id: string; full_name: string; email: string } | null;
  score: number | null;
  passed: boolean | null;
  status: "pending_review" | "passed" | "failed" | "submitted" | "in_progress";
  status_label: string;
  activity_at?: string | null;
  completed_at?: string | null;
  submitted_at?: string | null;
  submission_url?: string | null;
  review_status?: string | null;
  feedback?: string | null;
  graded_at?: string | null;
  graded_by?: { id: string; full_name: string; email: string } | null;
  can_grade?: boolean;
  milestone_id?: string;
};

type InitialData = {
  courses: Option[];
  learners: Option[];
  records: RecordItem[];
  summary: Summary;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function statusClasses(status: RecordItem["status"]) {
  if (status === "passed") return "bg-green-100 text-green-700";
  if (status === "failed") return "bg-red-100 text-red-700";
  if (status === "pending_review") return "bg-amber-100 text-amber-700";
  if (status === "submitted") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-600";
}

export default function SubmissionsClient({ initialData }: { initialData: InitialData }) {
  const [records, setRecords] = useState<RecordItem[]>(initialData.records || []);
  const [courseId, setCourseId] = useState("all");
  const [learnerId, setLearnerId] = useState("all");
  const [assessmentType, setAssessmentType] = useState("all");
  const [format, setFormat] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, { score: string; feedback: string }>>({});
  const [gradeLoadingId, setGradeLoadingId] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      if (courseId !== "all" && record.course_id !== courseId) return false;
      if (learnerId !== "all" && record.learner_id !== learnerId) return false;
      if (assessmentType !== "all" && record.assessment_type !== assessmentType) return false;
      if (format !== "all" && record.format !== format) return false;
      if (status !== "all" && record.status !== status) return false;
      if (!query) return true;
      const haystack = [
        record.title,
        record.course_title,
        record.module_title,
        record.lesson_title || "",
        record.learner?.full_name || "",
        record.learner?.email || "",
        record.assessment_label,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [assessmentType, courseId, format, learnerId, records, search, status]);

  const pendingRecords = filteredRecords.filter((record) => record.can_grade && record.status === "pending_review");
  const visibleSummary = useMemo(() => ({
    total: filteredRecords.length,
    pending_review: filteredRecords.filter((record) => record.status === "pending_review").length,
    passed: filteredRecords.filter((record) => record.status === "passed").length,
    failed: filteredRecords.filter((record) => record.status === "failed").length,
    project_links: filteredRecords.filter((record) => record.format === "project" && record.submission_url).length,
  }), [filteredRecords]);

  const activeSummary = filteredRecords.length === records.length ? initialData.summary : visibleSummary;

  const updateGradeDraft = (recordId: string, field: "score" | "feedback", value: string) => {
    setGradeDrafts((prev) => ({
      ...prev,
      [recordId]: {
        score: prev[recordId]?.score || "",
        feedback: prev[recordId]?.feedback || "",
        [field]: value,
      },
    }));
  };

  const submitGrade = async (record: RecordItem, passed: boolean) => {
    if (!record.milestone_id) return;
    setGradeLoadingId(record.id);
    setGradeError(null);
    const draft = gradeDrafts[record.id] || { score: "", feedback: "" };
    const normalizedScore = draft.score.trim() === "" ? null : Number(draft.score);

    const response = await fetch(`/api/instructor/milestones/${record.milestone_id}/submissions/${record.record_id}/grade`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: normalizedScore,
        passed,
        feedback: draft.feedback,
      }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setGradeError(payload?.error || "Unable to grade milestone submission.");
      setGradeLoadingId(null);
      return;
    }

    setRecords((prev) => prev.map((item) => {
      if (item.id !== record.id) return item;
      return {
        ...item,
        score: payload?.submission?.score ?? normalizedScore,
        passed: payload?.submission?.passed ?? passed,
        status: payload?.submission?.passed ? "passed" : "failed",
        status_label: payload?.submission?.passed ? "Passed" : "Needs retry",
        review_status: payload?.submission?.review_status || "graded",
        feedback: payload?.submission?.feedback || draft.feedback || null,
        graded_at: payload?.submission?.graded_at || new Date().toISOString(),
        graded_by: payload?.submission?.graded_by
          ? { id: payload.submission.graded_by, full_name: "Instructor", email: "" }
          : item.graded_by,
        can_grade: false,
      };
    }));
    setGradeLoadingId(null);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assessment Submissions</h1>
          <p className="mt-1 text-sm text-gray-500">Review learner lesson-test scores, milestone scores, and project links from your own courses.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700">
          <Sparkles className="h-4 w-4" /> Lecturer-owned grading only
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Visible records", value: activeSummary.total, tone: "text-slate-900 bg-white" },
          { label: "Pending review", value: activeSummary.pending_review, tone: "text-amber-700 bg-amber-50" },
          { label: "Passed", value: activeSummary.passed, tone: "text-green-700 bg-green-50" },
          { label: "Failed", value: activeSummary.failed, tone: "text-red-700 bg-red-50" },
          { label: "Project links", value: activeSummary.project_links, tone: "text-blue-700 bg-blue-50" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className={`inline-flex rounded-xl px-3 py-1 text-xs font-semibold ${card.tone}`}>{card.label}</div>
            <p className="mt-4 text-3xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-700">
          <Filter className="h-4 w-4" /> Advanced filtering
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="xl:col-span-2">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Search</span>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5">
              <Search className="h-4 w-4 text-gray-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Learner, course, lesson, milestone" className="w-full border-0 p-0 text-sm outline-none" />
            </div>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Course</span>
            <select value={courseId} onChange={(event) => setCourseId(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
              <option value="all">All courses</option>
              {initialData.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Learner</span>
            <select value={learnerId} onChange={(event) => setLearnerId(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
              <option value="all">All learners</option>
              {initialData.learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.full_name}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Assessment</span>
            <select value={assessmentType} onChange={(event) => setAssessmentType(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
              <option value="all">All types</option>
              <option value="lesson_test">Lesson tests</option>
              <option value="milestone">Milestones</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Format</span>
            <select value={format} onChange={(event) => setFormat(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
              <option value="all">All formats</option>
              <option value="mcq">MCQ</option>
              <option value="project">Project link</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
              <option value="all">All statuses</option>
              <option value="pending_review">Pending review</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="submitted">Submitted</option>
              <option value="in_progress">In progress</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Milestones Waiting for Grading</h2>
            <p className="mt-1 text-sm text-gray-500">These project milestones were submitted by learners in your courses and still need your review.</p>
          </div>
          <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{pendingRecords.length} pending</div>
        </div>

        {gradeError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{gradeError}</div>}

        {pendingRecords.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            No pending milestone submissions match the current filters.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {pendingRecords.map((record) => {
              const draft = gradeDrafts[record.id] || { score: "", feedback: "" };
              return (
                <div key={record.id} className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">{record.assessment_label}</p>
                      <h3 className="mt-2 text-lg font-semibold text-gray-900">{record.title}</h3>
                      <p className="mt-1 text-sm text-gray-600">{record.course_title} • {record.module_title}</p>
                      <p className="mt-2 text-sm text-gray-700">{record.learner?.full_name} {record.learner?.email ? `• ${record.learner.email}` : ""}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(record.status)}`}>{record.status_label}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                    <span>Submitted: {formatDate(record.activity_at)}</span>
                    {record.submission_url && (
                      <a href={record.submission_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-blue-700 hover:text-blue-900">
                        <ExternalLink className="h-4 w-4" /> Open submission
                      </a>
                    )}
                  </div>
                  <div className="mt-4 grid gap-3">
                    <label>
                      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Score</span>
                      <input type="number" min="0" max="100" value={draft.score} onChange={(event) => updateGradeDraft(record.id, "score", event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" placeholder="Optional score" />
                    </label>
                    <label>
                      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Feedback</span>
                      <textarea value={draft.feedback} onChange={(event) => updateGradeDraft(record.id, "feedback", event.target.value)} rows={4} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" placeholder="What should the learner improve or keep doing?" />
                    </label>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button type="button" onClick={() => submitGrade(record, true)} disabled={gradeLoadingId === record.id} className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">Mark passed</button>
                    <button type="button" onClick={() => submitGrade(record, false)} disabled={gradeLoadingId === record.id} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">Needs retry</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Assessment Records</h2>
          <p className="mt-1 text-sm text-gray-500">Classified scores and submission links for lesson tests and milestones in your courses.</p>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-500">No records found for the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3">Assessment</th>
                  <th className="px-5 py-3">Learner</th>
                  <th className="px-5 py-3">Course</th>
                  <th className="px-5 py-3">Classification</th>
                  <th className="px-5 py-3">Score</th>
                  <th className="px-5 py-3">Submission</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="align-top hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-900">{record.title}</div>
                      <div className="mt-1 text-xs text-gray-500">{record.assessment_label}{record.lesson_title ? ` • ${record.lesson_title}` : ""}</div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      <div>{record.learner?.full_name || "Learner"}</div>
                      {record.learner?.email && <div className="mt-1 text-xs text-gray-500">{record.learner.email}</div>}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      <div>{record.course_title}</div>
                      <div className="mt-1 text-xs text-gray-500">{record.module_title}</div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        <FileCheck2 className="h-3.5 w-3.5" /> {record.format === "mcq" ? "MCQ score" : "Project link"}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-900">{record.score === null || record.score === undefined ? "-" : `${record.score}%`}</td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {record.submission_url ? (
                        <a href={record.submission_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-900">
                          <ExternalLink className="h-4 w-4" /> Open link
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(record.status)}`}>{record.status_label}</div>
                      {record.feedback && <div className="mt-2 max-w-xs text-xs text-gray-500">{record.feedback}</div>}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">{formatDate(record.graded_at || record.completed_at || record.activity_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}