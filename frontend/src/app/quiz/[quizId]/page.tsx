"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, CheckCircle, XCircle, Clock, ArrowLeft, Trophy } from "lucide-react";
import Link from "next/link";

interface PageProps { params: Promise<{ quizId: string }> }

export default function QuizPage({ params }: PageProps) {
  const router = useRouter();
  const [quizId, setQuizId] = useState("");
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"intro" | "taking" | "result">("intro");
  const [result, setResult] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [attemptId, setAttemptId] = useState<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { params.then(p => setQuizId(p.quizId)); }, [params]);

  useEffect(() => {
    if (!quizId) return;
    const load = async () => {
      const response = await fetch(`/api/quizzes/${quizId}`);
      if (!response.ok) return;
      const payload = await response.json();
      setQuiz(payload.quiz);
      setQuestions(payload.questions || []);
      setLoading(false);
    };
    load();
  }, [quizId]);

  const startQuiz = async () => {
    const response = await fetch(`/api/quizzes/${quizId}/attempt`, { method: "POST" });
    const payload = await response.json().catch(() => null);
    if (response.ok && payload?.id) setAttemptId(payload.id);
    setPhase("taking");
    if (quiz.time_limit_minutes) {
      setTimeLeft(quiz.time_limit_minutes * 60);
    }
  };

  useEffect(() => {
    if (phase === "taking" && timeLeft !== null) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(timerRef.current!);
            submitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const submitQuiz = async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    let earned = 0;
    let total = 0;
    const gradedAnswers: Record<string, { answer: string; correct: boolean; points: number }> = {};

    questions.forEach(q => {
      total += q.points;
      const userAnswer = answers[q.id] || "";
      let correct = false;
      if (q.question_type === "short_answer") {
        correct = userAnswer.toLowerCase().trim() === (q.correct_answer || "").toLowerCase().trim();
      } else {
        correct = userAnswer === q.correct_answer;
      }
      if (correct) earned += q.points;
      gradedAnswers[q.id] = { answer: userAnswer, correct, points: q.points };
    });

    const score = total > 0 ? Math.round((earned / total) * 100) : 0;
    const passed = score >= quiz.passing_score;

    if (attemptId) {
      await fetch(`/api/quizzes/${quizId}/attempt/${attemptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          score,
          passed,
          completed_at: new Date().toISOString(),
        }),
      });
    }

    setResult({ score, passed, earned, total, gradedAnswers });
    setPhase("result");
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">Loading quiz...</p>
    </div>
  );

  if (!quiz) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-red-500">Quiz not found</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-purple-600" />
            <span className="font-semibold text-gray-900 text-sm">{quiz.title}</span>
          </div>
          {phase === "taking" && timeLeft !== null && (
            <div className={`flex items-center gap-1.5 text-sm font-mono font-bold px-3 py-1 rounded-full ${timeLeft < 60 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>
              <Clock className="w-4 h-4" />
              {formatTime(timeLeft)}
            </div>
          )}
          {phase !== "taking" && <div />}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* INTRO */}
        {phase === "intro" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-8 h-8 text-purple-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{quiz.title}</h1>
            {quiz.description && <p className="text-gray-500 mb-6">{quiz.description}</p>}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-gray-900">{questions.length}</p>
                <p className="text-xs text-gray-500 mt-1">Questions</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-gray-900">{quiz.passing_score}%</p>
                <p className="text-xs text-gray-500 mt-1">Passing Score</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-gray-900">{quiz.time_limit_minutes ? `${quiz.time_limit_minutes}m` : "∞"}</p>
                <p className="text-xs text-gray-500 mt-1">Time Limit</p>
              </div>
            </div>
            <button
              onClick={startQuiz}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Start Quiz
            </button>
          </div>
        )}

        {/* TAKING */}
        {phase === "taking" && (
          <div className="space-y-6">
            {/* Progress */}
            <div className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <span className="text-sm text-gray-500">{Object.keys(answers).length}/{questions.length} answered</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 bg-purple-500 rounded-full transition-all"
                  style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }}
                />
              </div>
            </div>

            {questions.map((q, i) => (
              <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-start gap-3 mb-4">
                  <span className="w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{q.question_type.replace("_", " ")}</span>
                      <span className="text-xs text-gray-400">{q.points} pt{q.points !== 1 ? "s" : ""}</span>
                    </div>
                    <p className="text-gray-900 font-medium">{q.question_text}</p>
                  </div>
                </div>

                {q.question_type === "mcq" && q.options && (
                  <div className="space-y-2 ml-11">
                    {q.options.map((opt: string, oi: number) => (
                      <label key={oi} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border-2 ${
                        answers[q.id] === opt ? "border-purple-500 bg-purple-50" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                      }`}>
                        <input
                          type="radio"
                          name={q.id}
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                          className="accent-purple-600"
                        />
                        <span className="text-sm text-gray-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}

                {q.question_type === "true_false" && (
                  <div className="flex gap-3 ml-11">
                    {["True", "False"].map(v => (
                      <label key={v} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg cursor-pointer transition-colors border-2 ${
                        answers[q.id] === v ? "border-purple-500 bg-purple-50" : "border-gray-100 hover:border-gray-200"
                      }`}>
                        <input
                          type="radio"
                          name={q.id}
                          value={v}
                          checked={answers[q.id] === v}
                          onChange={() => setAnswers(prev => ({ ...prev, [q.id]: v }))}
                          className="accent-purple-600"
                        />
                        <span className="text-sm font-medium text-gray-700">{v}</span>
                      </label>
                    ))}
                  </div>
                )}

                {q.question_type === "short_answer" && (
                  <div className="ml-11">
                    <input
                      type="text"
                      value={answers[q.id] || ""}
                      onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Type your answer..."
                    />
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={submitQuiz}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Submit Quiz
            </button>
          </div>
        )}

        {/* RESULT */}
        {phase === "result" && result && (
          <div className="space-y-6">
            {/* Score card */}
            <div className={`rounded-2xl p-8 text-center ${result.passed ? "bg-green-50 border-2 border-green-200" : "bg-red-50 border-2 border-red-200"}`}>
              {result.passed ? (
                <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              ) : (
                <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              )}
              <h2 className="text-3xl font-bold text-gray-900 mb-1">{result.score}%</h2>
              <p className={`text-lg font-semibold mb-2 ${result.passed ? "text-green-700" : "text-red-700"}`}>
                {result.passed ? "Congratulations! You passed!" : "You did not pass this time"}
              </p>
              <p className="text-gray-500 text-sm">
                {result.earned}/{result.total} points · Passing score: {quiz.passing_score}%
              </p>
            </div>

            {/* Answer review */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Answer Review</h3>
              <div className="space-y-4">
                {questions.map((q, i) => {
                  const graded = result.gradedAnswers[q.id];
                  return (
                    <div key={q.id} className={`p-4 rounded-lg border ${graded?.correct ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                      <div className="flex items-start gap-2 mb-2">
                        {graded?.correct ? <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                        <p className="text-sm font-medium text-gray-800">Q{i + 1}: {q.question_text}</p>
                      </div>
                      <div className="ml-6 space-y-1 text-xs">
                        <p className={graded?.correct ? "text-green-700" : "text-red-700"}>
                          Your answer: <span className="font-medium">{graded?.answer || "(no answer)"}</span>
                        </p>
                        {!graded?.correct && q.correct_answer && (
                          <p className="text-gray-600">Correct: <span className="font-medium text-green-700">{q.correct_answer}</span></p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setPhase("intro"); setAnswers({}); setResult(null); setTimeLeft(null); }}
                className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-sm"
              >
                Retake Quiz
              </button>
              <button onClick={() => router.back()} className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-colors text-sm">
                Back to Course
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
