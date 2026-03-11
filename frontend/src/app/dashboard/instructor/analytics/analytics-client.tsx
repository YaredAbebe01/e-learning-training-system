"use client";

import { useMemo, useState } from "react";
import { Award, BarChart3, BookOpen, Coins, Users } from "lucide-react";

type InitialData = {
  courses: Array<{ id: string; title: string; is_published: boolean }>;
  enrollments: Array<{ id: string; course_id: string; completed_at?: string | null; learner?: { id?: string; full_name?: string } | null }>;
  lessonProgress: Array<{ course_id: string; is_completed: boolean }>;
  topStudents: Array<{ rank: number; learner: { id: string; full_name: string; email: string }; totalPoints: number; lastAwardedAt?: string | null }>;
};

export default function AnalyticsClient({ initialData }: { initialData: InitialData }) {
  const [learnerId, setLearnerId] = useState("");
  const [courseId, setCourseId] = useState(initialData.courses[0]?.id || "");
  const [points, setPoints] = useState("5");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalEnrollments = initialData.enrollments?.length ?? 0;
  const completedCourses = initialData.enrollments?.filter((entry) => entry.completed_at).length ?? 0;
  const completedLessons = initialData.lessonProgress?.filter((entry) => entry.is_completed).length ?? 0;
  const bestStudent = initialData.topStudents?.[0] || null;

  const courseBreakdown = initialData.courses?.map((course) => {
    const enrolled = initialData.enrollments?.filter((entry) => String(entry.course_id?._id || entry.course_id) === String(course.id)).length ?? 0;
    const completed = initialData.enrollments?.filter((entry) => String(entry.course_id?._id || entry.course_id) === String(course.id) && entry.completed_at).length ?? 0;
    return { ...course, enrolled, completed };
  }) || [];

  const learnerOptions = useMemo(() => {
    const map = new Map<string, { id: string; full_name: string }>();
    for (const enrollment of initialData.enrollments || []) {
      if (enrollment.learner?.id) {
        map.set(enrollment.learner.id, {
          id: enrollment.learner.id,
          full_name: enrollment.learner.full_name || "Learner",
        });
      }
    }
    for (const student of initialData.topStudents || []) {
      map.set(student.learner.id, { id: student.learner.id, full_name: student.learner.full_name });
    }
    return [...map.values()];
  }, [initialData.enrollments, initialData.topStudents]);

  const submitAdjustment = async () => {
    if (!learnerId || !courseId || !points.trim()) {
      setError("Select a learner, course, and point value.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/instructor/points/adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learner_id: learnerId, course_id: courseId, points: Number(points), note }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error || "Unable to save point adjustment.");
      setSaving(false);
      return;
    }

    setMessage("Point adjustment saved. Refresh analytics to update rankings.");
    setSaving(false);
    setNote("");
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 mt-1">Performance overview and point leaderboard for your courses</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Enrollments", value: totalEnrollments, icon: <Users className="w-5 h-5" />, color: "bg-blue-500" },
          { label: "Completions", value: completedCourses, icon: <BookOpen className="w-5 h-5" />, color: "bg-green-500" },
          { label: "Best Student", value: bestStudent ? bestStudent.learner.full_name : "-", icon: <Award className="w-5 h-5" />, color: "bg-violet-500" },
          { label: "Lessons Completed", value: completedLessons, icon: <BarChart3 className="w-5 h-5" />, color: "bg-orange-500" },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className={`${item.color} p-2.5 rounded-xl text-white inline-flex mb-3`}>{item.icon}</div>
            <p className="text-2xl font-bold text-gray-900 break-words">{item.value}</p>
            <p className="text-xs text-gray-500 mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Top Students</h2>
            <div className="inline-flex items-center gap-2 text-sm font-medium text-violet-700">
              <Coins className="w-4 h-4" /> High to low
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {initialData.topStudents?.map((student) => (
              <div key={student.learner.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">#{student.rank} {student.learner.full_name}</p>
                  <p className="text-xs text-gray-500">{student.learner.email || "No email"}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-violet-700">{student.totalPoints}</p>
                  <p className="text-xs text-gray-500">{student.lastAwardedAt ? new Date(student.lastAwardedAt).toLocaleDateString() : "No recent awards"}</p>
                </div>
              </div>
            ))}
            {!initialData.topStudents?.length && <div className="px-6 py-10 text-sm text-gray-400 text-center">No student points yet.</div>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900">Manual Point Adjustment</h2>
          <p className="text-sm text-gray-500 mt-1">Give bonus points or deduct points manually for a learner in one of your courses.</p>
          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {message && <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Learner</span>
              <select value={learnerId} onChange={(event) => setLearnerId(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
                <option value="">Select learner</option>
                {learnerOptions.map((learner) => <option key={learner.id} value={learner.id}>{learner.full_name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Course</span>
              <select value={courseId} onChange={(event) => setCourseId(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
                {initialData.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Points</span>
              <input value={points} onChange={(event) => setPoints(event.target.value)} type="number" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" placeholder="Use negative numbers to deduct" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Reason</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" placeholder="Participation bonus, late deduction, excellent improvement..." />
            </label>
            <button onClick={submitAdjustment} disabled={saving} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60">
              {saving ? "Saving..." : "Save adjustment"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Course Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Course</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Enrolled</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Completed</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Completion Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {courseBreakdown.map((course) => {
                const rate = course.enrolled ? Math.round((course.completed / course.enrolled) * 100) : 0;
                return (
                  <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{course.title}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${course.is_published ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {course.is_published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{course.enrolled}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{course.completed}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-24">
                          <div className="h-2 bg-green-500 rounded-full" style={{ width: `${rate}%` }} />
                        </div>
                        <span className="text-sm text-gray-700 w-10">{rate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!courseBreakdown.length && <tr><td colSpan={5} className="text-center py-12 text-gray-400 text-sm">No courses yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}