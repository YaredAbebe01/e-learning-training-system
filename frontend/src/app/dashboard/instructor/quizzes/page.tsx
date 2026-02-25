"use client";

import { useEffect, useState } from "react";
import { PlusCircle, Trash2, ClipboardList, ArrowLeft, X } from "lucide-react";
import Link from "next/link";

export default function InstructorQuizzesPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const [quizForm, setQuizForm] = useState({ title: "", description: "", course_id: "", passing_score: 70, time_limit_minutes: "" });
  const [questions, setQuestions] = useState<any[]>([]);
  const [newQ, setNewQ] = useState({ question_text: "", question_type: "mcq", options: ["", "", "", ""], correct_answer: "", points: 1 });

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/instructor/quizzes");
      if (!response.ok) return;
      const payload = await response.json();
      setCourses(payload.courses || []);
      setQuizzes(payload.quizzes || []);
      setLoading(false);
    };
    load();
  }, []);

  const createQuiz = async () => {
    if (!quizForm.title || !quizForm.course_id) return;
    const response = await fetch("/api/instructor/quizzes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...quizForm,
        time_limit_minutes: quizForm.time_limit_minutes ? parseInt(quizForm.time_limit_minutes as string) : null,
      }),
    });
    if (response.ok) {
      setSelectedQuiz(null);
      setShowCreate(false);
      fetchQuizzes();
    }
  };

  const fetchQuizzes = async () => {
    const response = await fetch("/api/instructor/quizzes");
    if (!response.ok) return;
    const payload = await response.json();
    setCourses(payload.courses || []);
    setQuizzes(payload.quizzes || []);
  };

  const loadQuizQuestions = async (quizId: string) => {
    const response = await fetch(`/api/instructor/quizzes/${quizId}/questions`);
    if (!response.ok) return;
    const payload = await response.json();
    setQuestions(payload.questions || []);
  };

  const selectQuiz = async (quiz: any) => {
    setSelectedQuiz(quiz);
    await loadQuizQuestions(quiz.id);
  };

  const addQuestion = async () => {
    if (!newQ.question_text.trim() || !selectedQuiz) return;
    const opts = newQ.question_type === "true_false" ? ["True", "False"] : newQ.options.filter(o => o.trim());
    await fetch(`/api/instructor/quizzes/${selectedQuiz.id}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_text: newQ.question_text,
        question_type: newQ.question_type,
        options: opts.length > 0 ? opts : null,
        correct_answer: newQ.correct_answer,
        points: newQ.points,
      }),
    });
    setNewQ({ question_text: "", question_type: "mcq", options: ["", "", "", ""], correct_answer: "", points: 1 });
    await loadQuizQuestions(selectedQuiz.id);
    fetchQuizzes();
  };

  const deleteQuestion = async (id: string) => {
    if (!selectedQuiz) return;
    await fetch(`/api/instructor/quizzes/${selectedQuiz.id}/questions/${id}`, {
      method: "DELETE",
    });
    if (selectedQuiz) await loadQuizQuestions(selectedQuiz.id);
  };

  const deleteQuiz = async (id: string) => {
    if (!confirm("Delete this quiz?")) return;
    await fetch(`/api/instructor/quizzes/${id}`, { method: "DELETE" });
    if (selectedQuiz?.id === id) setSelectedQuiz(null);
    fetchQuizzes();
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quizzes & Exams</h1>
          <p className="text-gray-500 mt-1">Create and manage assessments for your courses</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <PlusCircle className="w-4 h-4" /> New Quiz
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quiz list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h2 className="font-semibold text-gray-700 mb-3 text-sm">All Quizzes ({quizzes.length})</h2>
          <div className="space-y-2">
            {quizzes.map(q => (
              <div
                key={q.id}
                onClick={() => selectQuiz(q)}
                className={`p-3 rounded-lg cursor-pointer transition-colors border ${selectedQuiz?.id === q.id ? "border-purple-200 bg-purple-50" : "border-transparent hover:bg-gray-50"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{q.title}</p>
                    <p className="text-xs text-gray-400 truncate">{q.course?.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{q.quiz_questions?.[0]?.count ?? 0} questions · Pass: {q.passing_score}%</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteQuiz(q.id); }} className="p-1 text-red-400 hover:text-red-600 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {!quizzes.length && (
              <div className="text-center py-6">
                <ClipboardList className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No quizzes yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Question editor */}
        <div className="lg:col-span-2">
          {selectedQuiz ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-5">
                <button onClick={() => setSelectedQuiz(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <ArrowLeft className="w-4 h-4 text-gray-500" />
                </button>
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedQuiz.title}</h2>
                  <p className="text-xs text-gray-400">Passing score: {selectedQuiz.passing_score}%</p>
                </div>
              </div>

              {/* Existing Questions */}
              <div className="space-y-3 mb-6">
                {questions.map((q, i) => (
                  <div key={q.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-gray-400">Q{i + 1}</span>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{q.question_type.replace("_", " ")}</span>
                          <span className="text-xs text-gray-400">{q.points} pt{q.points !== 1 ? "s" : ""}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800">{q.question_text}</p>
                        {q.options && (
                          <div className="mt-2 space-y-1">
                            {q.options.map((opt: string, oi: number) => (
                              <div key={oi} className={`text-xs px-3 py-1.5 rounded-lg ${opt === q.correct_answer ? "bg-green-100 text-green-700 font-medium" : "bg-gray-50 text-gray-600"}`}>
                                {opt === q.correct_answer && "✓ "}{opt}
                              </div>
                            ))}
                          </div>
                        )}
                        {q.question_type === "short_answer" && q.correct_answer && (
                          <p className="text-xs text-green-600 mt-1">Answer: {q.correct_answer}</p>
                        )}
                      </div>
                      <button onClick={() => deleteQuestion(q.id)} className="p-1 text-red-400 hover:text-red-600 shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {!questions.length && <p className="text-sm text-gray-400 text-center py-4">No questions yet. Add one below.</p>}
              </div>

              {/* Add Question */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="font-medium text-gray-800 mb-3 text-sm">Add Question</h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <select
                      value={newQ.question_type}
                      onChange={e => setNewQ({ ...newQ, question_type: e.target.value })}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="mcq">Multiple Choice</option>
                      <option value="true_false">True / False</option>
                      <option value="short_answer">Short Answer</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={newQ.points}
                      onChange={e => setNewQ({ ...newQ, points: parseInt(e.target.value) || 1 })}
                      className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="pts"
                    />
                  </div>
                  <textarea
                    value={newQ.question_text}
                    onChange={e => setNewQ({ ...newQ, question_text: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 h-16 resize-none"
                    placeholder="Question text..."
                  />
                  {newQ.question_type === "mcq" && (
                    <div className="space-y-2">
                      {newQ.options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-4">{String.fromCharCode(65 + i)}.</span>
                          <input
                            value={opt}
                            onChange={e => {
                              const opts = [...newQ.options];
                              opts[i] = e.target.value;
                              setNewQ({ ...newQ, options: opts });
                            }}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder={`Option ${String.fromCharCode(65 + i)}`}
                          />
                          <input
                            type="radio"
                            name="correct"
                            checked={newQ.correct_answer === opt && opt !== ""}
                            onChange={() => setNewQ({ ...newQ, correct_answer: opt })}
                            className="accent-purple-600"
                            title="Mark as correct"
                          />
                        </div>
                      ))}
                      <p className="text-xs text-gray-400">Select the radio button next to the correct answer</p>
                    </div>
                  )}
                  {newQ.question_type === "true_false" && (
                    <div className="flex gap-3">
                      {["True", "False"].map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setNewQ({ ...newQ, correct_answer: v })}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${newQ.correct_answer === v ? "border-purple-600 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                        >{v}</button>
                      ))}
                    </div>
                  )}
                  {newQ.question_type === "short_answer" && (
                    <input
                      value={newQ.correct_answer}
                      onChange={e => setNewQ({ ...newQ, correct_answer: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Expected answer (for auto-grading)"
                    />
                  )}
                  <button
                    onClick={addQuestion}
                    className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" /> Add Question
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
              <ClipboardList className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Select a quiz to manage its questions</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Quiz Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Create New Quiz</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quiz Title *</label>
                <input value={quizForm.title} onChange={e => setQuizForm({ ...quizForm, title: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="e.g. Module 1 Quiz" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course *</label>
                <select value={quizForm.course_id} onChange={e => setQuizForm({ ...quizForm, course_id: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="">Select course</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={quizForm.description} onChange={e => setQuizForm({ ...quizForm, description: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 h-16 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Passing Score (%)</label>
                  <input type="number" min={0} max={100} value={quizForm.passing_score} onChange={e => setQuizForm({ ...quizForm, passing_score: parseInt(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time Limit (min)</label>
                  <input type="number" min={0} value={quizForm.time_limit_minutes} onChange={e => setQuizForm({ ...quizForm, time_limit_minutes: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="No limit" />
                </div>
              </div>
              <button onClick={createQuiz} className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                <Save className="w-4 h-4" /> Create Quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
