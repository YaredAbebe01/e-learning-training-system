"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft, ChevronRight, CheckCircle, Circle, Play,
  BookOpen, ClipboardList, Menu, X, Award, Lock
} from "lucide-react";
import Link from "next/link";

interface PageProps { params: Promise<{ courseId: string }> }

export default function CourseViewerPage({ params }: PageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [courseId, setCourseId] = useState("");
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [currentLesson, setCurrentLesson] = useState<any>(null);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [assessment, setAssessment] = useState<any>(null);
  const [assessmentPhase, setAssessmentPhase] = useState<"prompt" | "taking" | "project" | "result">("prompt");
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, string>>({});
  const [assessmentStep, setAssessmentStep] = useState(0);
  const [assessmentAttemptId, setAssessmentAttemptId] = useState<string>("");
  const [assessmentResult, setAssessmentResult] = useState<any>(null);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [projectSubmission, setProjectSubmission] = useState("");
  const requestedLessonId = searchParams.get("lessonId") || "";
  const requestedMilestoneId = searchParams.get("milestoneId") || "";
  const [selectedMilestone, setSelectedMilestone] = useState<any>(null);
  const [selectedMilestoneModule, setSelectedMilestoneModule] = useState<any>(null);
  const [milestoneQuestions, setMilestoneQuestions] = useState<any[]>([]);
  const [milestoneAttempt, setMilestoneAttempt] = useState<any>(null);
  const [milestoneSubmission, setMilestoneSubmission] = useState<any>(null);
  const [milestoneUnlocked, setMilestoneUnlocked] = useState(false);
  const [milestoneBlockedReason, setMilestoneBlockedReason] = useState<string | null>(null);
  const [milestoneAnswers, setMilestoneAnswers] = useState<Record<string, string>>({});
  const [milestoneAttemptId, setMilestoneAttemptId] = useState("");
  const [milestoneProjectLink, setMilestoneProjectLink] = useState("");
  const [milestoneError, setMilestoneError] = useState<string | null>(null);
  const [milestoneSubmitting, setMilestoneSubmitting] = useState(false);

  const isLessonTestCompletedLocal = (lesson: any) => {
    const test = lesson?.lesson_test;
    if (!test) return true;
    if (test.test_type === "project") return !!test.submission?.submission_url;
    return test.attempt?.passed === true;
  };

  const isMilestoneCompletedLocal = (milestone: any) => {
    if (!milestone) return false;
    if (milestone.milestone_type === "project") return milestone.submission?.review_status === "graded" && milestone.submission?.passed === true;
    return milestone.attempt?.passed === true;
  };

  useEffect(() => { params.then(p => setCourseId(p.courseId)); }, [params]);

  useEffect(() => {
    if (!courseId) return;
    const load = async () => {
      const response = await fetch(`/api/learner/course-viewer/${courseId}`);
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const payload = await response.json();

      setCourse(payload.course);
      const sortedModules = (payload.modules || []).map((mod: any) => ({
        ...mod,
        lessons: (mod.lessons || []).sort((a: any, b: any) => a.order_index - b.order_index),
        milestones: (mod.milestones || []).sort((a: any, b: any) => a.order_index - b.order_index),
      }));
      setModules(sortedModules);
      setQuizzes(payload.quizzes || []);

      const progressMap: Record<string, boolean> = {};
      (payload.lessonProgress || []).forEach((p: any) => { progressMap[p.lesson_id] = p.is_completed; });
      setProgress(progressMap);

      const isModulePassedLocal = (moduleData: any) => {
        const lessonsComplete = (moduleData.lessons || []).every((lesson: any) => progressMap[lesson.id]);
        const testsComplete = (moduleData.lessons || []).every((lesson: any) => isLessonTestCompletedLocal(lesson));
        const milestonesComplete = (moduleData.milestones || []).every((milestone: any) => isMilestoneCompletedLocal(milestone));
        return lessonsComplete && testsComplete && milestonesComplete;
      };

      const isLessonUnlockedLocal = (moduleIndex: number, lessonIndex: number) => {
        if (moduleIndex > 0 && !isModulePassedLocal(sortedModules[moduleIndex - 1])) return false;
        if (lessonIndex === 0) return true;
        const previousLesson = sortedModules[moduleIndex]?.lessons?.[lessonIndex - 1];
        return !!previousLesson && progressMap[previousLesson.id] && isLessonTestCompletedLocal(previousLesson);
      };

      let firstLesson: any = null;
      for (let moduleIndex = 0; moduleIndex < sortedModules.length; moduleIndex += 1) {
        const mod = sortedModules[moduleIndex];
        for (let lessonIndex = 0; lessonIndex < (mod.lessons || []).length; lessonIndex += 1) {
          const lesson = mod.lessons[lessonIndex];
          if (!isLessonUnlockedLocal(moduleIndex, lessonIndex)) continue;
          if (!progressMap[lesson.id] && !firstLesson) firstLesson = lesson;
        }
      }
      if (!firstLesson) {
        for (let moduleIndex = 0; moduleIndex < sortedModules.length; moduleIndex += 1) {
          const mod = sortedModules[moduleIndex];
          for (let lessonIndex = 0; lessonIndex < (mod.lessons || []).length; lessonIndex += 1) {
            const lesson = mod.lessons[lessonIndex];
            if (isLessonUnlockedLocal(moduleIndex, lessonIndex)) {
              firstLesson = lesson;
              break;
            }
          }
          if (firstLesson) break;
        }
      }
      if (!requestedMilestoneId && requestedLessonId) {
        for (let moduleIndex = 0; moduleIndex < sortedModules.length; moduleIndex += 1) {
          const lessonIndex = (sortedModules[moduleIndex]?.lessons || []).findIndex((lesson: any) => lesson.id === requestedLessonId);
          if (lessonIndex >= 0 && isLessonUnlockedLocal(moduleIndex, lessonIndex)) {
            firstLesson = sortedModules[moduleIndex].lessons[lessonIndex];
            break;
          }
        }
      }

      setCurrentLesson(firstLesson);
      setLoading(false);
    };
    load();
  }, [courseId, requestedLessonId, requestedMilestoneId]);

  useEffect(() => {
    if (!courseId || !requestedMilestoneId) {
      setSelectedMilestone(null);
      setSelectedMilestoneModule(null);
      setMilestoneQuestions([]);
      setMilestoneAttempt(null);
      setMilestoneSubmission(null);
      setMilestoneUnlocked(false);
      setMilestoneBlockedReason(null);
      setMilestoneAnswers({});
      setMilestoneAttemptId("");
      setMilestoneProjectLink("");
      setMilestoneError(null);
      return;
    }

    const loadMilestoneDetails = async () => {
      setMilestoneError(null);
      const response = await fetch(`/api/learner/milestones/${requestedMilestoneId}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setMilestoneError(payload?.error || "Unable to load milestone.");
        return;
      }

      let moduleMatch = null;
      let milestoneMatch = null;
      for (const moduleItem of modules) {
        const match = (moduleItem.milestones || []).find((item: any) => item.id === requestedMilestoneId);
        if (match) {
          moduleMatch = moduleItem;
          milestoneMatch = match;
          break;
        }
      }

      setSelectedMilestone({ ...(payload?.milestone || {}), ...(milestoneMatch || {}) });
      setSelectedMilestoneModule(moduleMatch);
      setMilestoneQuestions((payload?.questions || []).map((question: any) => ({ ...question, id: String(question.id || question._id) })));
      setMilestoneAttempt(payload?.attempt || null);
      setMilestoneSubmission(payload?.submission || null);
      setMilestoneUnlocked(Boolean(payload?.unlocked));
      setMilestoneBlockedReason(payload?.blocked_reason || null);
      setMilestoneAnswers(payload?.attempt?.answers || {});
      setMilestoneProjectLink(payload?.submission?.submission_url || "");
      setMilestoneAttemptId("");
    };

    void loadMilestoneDetails();
  }, [courseId, requestedMilestoneId, modules]);

  const markLessonComplete = async (lessonId: string) => {
    const nextValue = !progress[lessonId];
    const lesson = findLessonById(lessonId);

    if (nextValue && lesson?.lesson_test && !isLessonTestCompleted(lesson)) {
      await openAssessment("lesson", lesson);
      return;
    }

    await fetch("/api/learner/lesson-complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, lessonId, completed: nextValue }),
    });
    const nextProgress = { ...progress, [lessonId]: nextValue };
    setProgress(nextProgress);

    if (nextValue) {
      const moduleData = findModuleByLessonId(lessonId);
      await maybePromptMilestone(moduleData, nextProgress);
    }
  };

  const getAllLessons = () => modules.flatMap(m => m.lessons || []);

  const navigateLesson = (direction: "prev" | "next") => {
    const all = getAllLessons();
    const idx = all.findIndex(l => l.id === currentLesson?.id);
    if (direction === "prev" && idx > 0) {
      const previousLesson = all[idx - 1];
      router.push(`/learn/${courseId}?lessonId=${previousLesson.id}`);
      setCurrentLesson(previousLesson);
    }
    if (direction === "next" && idx < all.length - 1) {
      const nextLesson = all[idx + 1];
      if (isLessonAccessible(nextLesson.id)) {
        router.push(`/learn/${courseId}?lessonId=${nextLesson.id}`);
        setCurrentLesson(nextLesson);
      }
    }
  };

  const getVideoEmbed = (url: string) => {
    if (!url) return null;
    const youtube = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&\n?#]+)/);
    if (youtube) return `https://www.youtube.com/embed/${youtube[1]}?rel=0`;
    const vimeo = url.match(/vimeo\.com\/(\d+)/);
    if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
    return url;
  };

  const findLessonById = (lessonId: string) => {
    for (const mod of modules) {
      for (const lesson of mod.lessons || []) {
        if (lesson.id === lessonId) return lesson;
      }
    }
    return null;
  };

  const findModuleByLessonId = (lessonId: string) => {
    for (const mod of modules) {
      if ((mod.lessons || []).some((lesson: any) => lesson.id === lessonId)) return mod;
    }
    return null;
  };

  const isLessonTestCompleted = (lesson: any) => {
    return isLessonTestCompletedLocal(lesson);
  };

  const isMilestoneCompleted = (milestone: any) => {
    return isMilestoneCompletedLocal(milestone);
  };

  const isModulePassed = (moduleData: any, progressSource?: Record<string, boolean>) => {
    const source = progressSource || progress;
    const lessonsComplete = (moduleData?.lessons || []).every((lesson: any) => source[lesson.id]);
    const testsComplete = (moduleData?.lessons || []).every((lesson: any) => isLessonTestCompleted(lesson));
    const milestonesComplete = (moduleData?.milestones || []).every((milestone: any) => isMilestoneCompleted(milestone));
    return lessonsComplete && testsComplete && milestonesComplete;
  };

  const getLessonLocation = (lessonId: string) => {
    for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex += 1) {
      const lessonIndex = (modules[moduleIndex]?.lessons || []).findIndex((lesson: any) => lesson.id === lessonId);
      if (lessonIndex >= 0) return { moduleIndex, lessonIndex };
    }
    return null;
  };

  const isModuleUnlocked = (moduleIndex: number, progressSource?: Record<string, boolean>) => {
    if (moduleIndex === 0) return true;
    return isModulePassed(modules[moduleIndex - 1], progressSource);
  };

  const isLessonUnlocked = (moduleIndex: number, lessonIndex: number, progressSource?: Record<string, boolean>) => {
    const source = progressSource || progress;
    if (!isModuleUnlocked(moduleIndex, source)) return false;
    if (lessonIndex === 0) return true;
    const previousLesson = modules[moduleIndex]?.lessons?.[lessonIndex - 1];
    return !!previousLesson && source[previousLesson.id] && isLessonTestCompleted(previousLesson);
  };

  const isLessonAccessible = (lessonId: string, progressSource?: Record<string, boolean>) => {
    const location = getLessonLocation(lessonId);
    if (!location) return false;
    return isLessonUnlocked(location.moduleIndex, location.lessonIndex, progressSource);
  };

  const finalQuiz = quizzes.find((quiz: any) => quiz.is_final);
  const finalQuizUnlocked = modules.every((moduleData: any) => isModulePassed(moduleData));

  const applyLessonTestStatus = (testId: string, update: any) => {
    setModules((prev) => prev.map((mod) => ({
      ...mod,
      lessons: (mod.lessons || []).map((lesson: any) => {
        if (lesson.lesson_test?.id !== testId) return lesson;
        return { ...lesson, lesson_test: { ...lesson.lesson_test, ...update } };
      }),
    })));
    setCurrentLesson((prev: any) => {
      if (prev?.lesson_test?.id !== testId) return prev;
      return { ...prev, lesson_test: { ...prev.lesson_test, ...update } };
    });
  };

  const applyMilestoneStatus = (milestoneId: string, update: any) => {
    setModules((prev) => prev.map((mod) => ({
      ...mod,
      milestones: (mod.milestones || []).map((milestone: any) => {
        if (milestone.id !== milestoneId) return milestone;
        return { ...milestone, ...update };
      }),
    })));
  };

  const maybePromptMilestone = async (moduleData: any, nextProgress?: Record<string, boolean>) => {
    if (!moduleData?.milestones?.length) return;
    if (!isModulePassed({ ...moduleData, milestones: [] }, nextProgress)) return;
    const nextMilestone = (moduleData.milestones || []).find((milestone: any) => !isMilestoneCompleted(milestone));
    if (!nextMilestone) return;
    router.push(`/learn/${courseId}?milestoneId=${nextMilestone.id}`);
  };

  const startMilestoneAttempt = async () => {
    if (!requestedMilestoneId) return;
    setMilestoneSubmitting(true);
    setMilestoneError(null);
    const response = await fetch(`/api/learner/milestones/${requestedMilestoneId}/attempt`, { method: "POST" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setMilestoneError(payload?.error || "Unable to start milestone.");
      setMilestoneSubmitting(false);
      return;
    }
    setMilestoneAttemptId(payload?.id || "");
    setMilestoneAnswers({});
    setMilestoneAttempt(null);
    setMilestoneSubmitting(false);
  };

  const submitMilestoneAnswers = async () => {
    if (!requestedMilestoneId || !milestoneAttemptId || !selectedMilestone) return;
    setMilestoneSubmitting(true);
    setMilestoneError(null);

    let earned = 0;
    let total = 0;
    milestoneQuestions.forEach((question: any) => {
      total += question.points || 1;
      const selected = milestoneAnswers[question.id] || "";
      if (selected !== "" && selected === question.correct_answer) {
        earned += question.points || 1;
      }
    });

    const score = total > 0 ? Math.round((earned / total) * 100) : 0;
    const passingScore = selectedMilestone?.passing_score || 70;
    const passed = score >= passingScore;

    const response = await fetch(`/api/learner/milestones/${requestedMilestoneId}/attempt/${milestoneAttemptId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: milestoneAnswers,
        score,
        passed,
        completed_at: new Date().toISOString(),
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setMilestoneError(payload?.error || "Unable to submit milestone answers.");
      setMilestoneSubmitting(false);
      return;
    }

    setMilestoneAttempt({ answers: milestoneAnswers, score, passed, completed_at: new Date().toISOString() });
    applyMilestoneStatus(requestedMilestoneId, { attempt: { score, passed, completed_at: new Date().toISOString() } });
    setMilestoneSubmitting(false);
  };

  const submitMilestoneProject = async () => {
    if (!requestedMilestoneId || !milestoneProjectLink.trim()) return;
    setMilestoneSubmitting(true);
    setMilestoneError(null);
    const response = await fetch(`/api/learner/milestones/${requestedMilestoneId}/submit-project`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submission_url: milestoneProjectLink.trim() }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setMilestoneError(payload?.error || "Unable to submit project.");
      setMilestoneSubmitting(false);
      return;
    }

    const submission = {
      submission_url: milestoneProjectLink.trim(),
      review_status: "pending",
      submitted_at: new Date().toISOString(),
    };
    setMilestoneSubmission(submission);
    applyMilestoneStatus(requestedMilestoneId, { submission });
    setMilestoneSubmitting(false);
  };

  const openAssessment = async (kind: "lesson" | "milestone", item: any) => {
    setAssessmentError(null);
    setAssessmentAnswers({});
    setAssessmentStep(0);
    setAssessmentAttemptId("");
    setAssessmentResult(null);
    setProjectSubmission("");

    const endpoint = kind === "lesson"
      ? `/api/learner/lesson-tests/${item.lesson_test.id}`
      : `/api/learner/milestones/${item.id}`;
    const response = await fetch(endpoint);
    if (!response.ok) return;
    const payload = await response.json();
    const data = kind === "lesson" ? payload.test : payload.milestone;
    const questions = (payload.questions || []).map((question: any) => ({
      ...question,
      id: String(question.id || question._id),
    }));
    setAssessment({ kind, data, questions });
    setAssessmentPhase("prompt");
  };

  const startAssessment = async () => {
    if (!assessment) return;
    setAssessmentError(null);
    setAssessmentAnswers({});
    setAssessmentStep(0);
    setAssessmentResult(null);
    const data = assessment.data;
    if (data.test_type === "project" || data.milestone_type === "project") {
      setAssessmentPhase("project");
      return;
    }

    const endpoint = assessment.kind === "lesson"
      ? `/api/learner/lesson-tests/${data.id}/attempt`
      : `/api/learner/milestones/${data.id}/attempt`;
    const response = await fetch(endpoint, { method: "POST" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setAssessmentError(payload?.error || "Unable to start assessment.");
      return;
    }
    setAssessmentAttemptId(payload?.id || "");
    setAssessmentPhase("taking");
  };

  const submitAssessment = async () => {
    if (!assessment || !assessmentAttemptId) return;
    const questions = assessment.questions || [];
    let earned = 0;
    let total = 0;
    const questionResults = questions.map((q: any) => {
      total += q.points || 1;
      const userAnswer = assessmentAnswers[q.id] || "";
      const isCorrect = userAnswer !== "" && userAnswer === q.correct_answer;
      if (isCorrect) earned += q.points || 1;
      return {
        id: q.id,
        question_text: q.question_text,
        correct_answer: q.correct_answer,
        user_answer: userAnswer,
        is_correct: isCorrect,
        points: q.points || 1,
      };
    });
    const score = total > 0 ? Math.round((earned / total) * 100) : 0;
    const passingScore = assessment.data.passing_score || 70;
    const passed = score >= passingScore;

    const endpoint = assessment.kind === "lesson"
      ? `/api/learner/lesson-tests/${assessment.data.id}/attempt/${assessmentAttemptId}`
      : `/api/learner/milestones/${assessment.data.id}/attempt/${assessmentAttemptId}`;
    await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: assessmentAnswers,
        score,
        passed,
        completed_at: new Date().toISOString(),
      }),
    });

    if (assessment.kind === "lesson") {
      applyLessonTestStatus(assessment.data.id, { attempt: { score, passed, completed_at: new Date().toISOString() } });
    } else {
      applyMilestoneStatus(assessment.data.id, { attempt: { score, passed, completed_at: new Date().toISOString() } });
    }
    setAssessmentResult({ score, passed, total, earned, passingScore, questions: questionResults });
    setAssessmentPhase("result");

  };

  const submitProject = async () => {
    if (!assessment || !projectSubmission.trim()) return;
    const endpoint = assessment.kind === "lesson"
      ? `/api/learner/lesson-tests/${assessment.data.id}/submit-project`
      : `/api/learner/milestones/${assessment.data.id}/submit-project`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submission_url: projectSubmission }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setAssessmentError(payload?.error || "Unable to submit project.");
      return;
    }

    if (assessment.kind === "lesson") {
      applyLessonTestStatus(assessment.data.id, { submission: { submission_url: projectSubmission } });
    } else {
      applyMilestoneStatus(assessment.data.id, { submission: { submission_url: projectSubmission } });
    }
    setAssessmentResult({ score: null, passed: true, total: null });
    setAssessmentPhase("result");

  };

  const assessmentType = assessment?.data?.test_type || assessment?.data?.milestone_type;
  const assessmentTitle = assessment?.data?.title || "";
  const assessmentDescription = assessment?.data?.description || assessment?.data?.project_prompt || "";

  const renderAssessmentModal = () => {
    if (!assessment) return null;

    return (
      <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
              {assessment.kind === "lesson" ? "Lesson Test" : "Module Milestone"}
            </p>
            <h3 className="text-xl font-semibold text-white mt-1">{assessmentTitle}</h3>
            {assessmentDescription && <p className="text-sm text-gray-400 mt-2">{assessmentDescription}</p>}
          </div>

          <div className="px-5 py-4 space-y-4">
            {assessmentError && <p className="text-sm text-red-400">{assessmentError}</p>}

            {assessmentPhase === "prompt" && (
              <div className="space-y-4">
                <p className="text-sm text-gray-300">
                  {assessment.kind === "lesson"
                    ? "You finished this lesson. Do you want to take the lesson test now?"
                    : "You completed the module lessons. Do you want to take the milestone now?"}
                </p>
                <div className="rounded-xl bg-gray-950 border border-gray-800 p-4 text-sm text-gray-400">
                  {assessmentType === "project"
                    ? "Submit a project link to complete this requirement."
                    : `Questions will appear one by one after you start. You need ${assessment.data.passing_score || 70}% to pass.`}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={startAssessment}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    Start now
                  </button>
                  <button
                    onClick={() => setAssessment(null)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    Later
                  </button>
                </div>
              </div>
            )}

            {assessmentPhase === "taking" && assessment.questions?.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Question {assessmentStep + 1} of {assessment.questions.length}</span>
                  <span>{Object.keys(assessmentAnswers).length} answered</span>
                </div>
                <div className="rounded-xl bg-gray-950 border border-gray-800 p-4">
                  <p className="text-sm text-gray-300 mb-3">
                    {assessment.questions[assessmentStep].question_text}
                  </p>
                  <div className="space-y-2">
                    {(assessment.questions[assessmentStep].options || []).map((option: string) => (
                      <label
                        key={option}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                          assessmentAnswers[assessment.questions[assessmentStep].id] === option
                            ? "border-blue-500 bg-blue-500/10 text-white"
                            : "border-gray-800 bg-gray-900 text-gray-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name={assessment.questions[assessmentStep].id}
                          checked={assessmentAnswers[assessment.questions[assessmentStep].id] === option}
                          onChange={() => setAssessmentAnswers((prev) => ({
                            ...prev,
                            [assessment.questions[assessmentStep].id]: option,
                          }))}
                          className="accent-blue-500"
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => setAssessmentStep((step) => Math.max(step - 1, 0))}
                    disabled={assessmentStep === 0}
                    className="px-4 py-2 rounded-lg bg-gray-800 text-gray-200 text-sm disabled:opacity-40"
                  >
                    Previous
                  </button>
                  {assessmentStep < assessment.questions.length - 1 ? (
                    <button
                      onClick={() => setAssessmentStep((step) => Math.min(step + 1, assessment.questions.length - 1))}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={submitAssessment}
                      className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700"
                    >
                      Submit
                    </button>
                  )}
                </div>
              </div>
            )}

            {assessmentPhase === "taking" && assessment.questions?.length === 0 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-300">No questions are configured for this assessment yet.</p>
                <button
                  onClick={() => setAssessment(null)}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-gray-200 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            )}

            {assessmentPhase === "project" && (
              <div className="space-y-4">
                <input
                  type="url"
                  value={projectSubmission}
                  onChange={(e) => setProjectSubmission(e.target.value)}
                  className="w-full border border-gray-700 bg-gray-950 text-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Paste your project link"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={submitProject}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    Submit project
                  </button>
                  <button
                    onClick={() => setAssessment(null)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {assessmentPhase === "result" && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-gray-950 border border-gray-800 p-6 text-center">
                  <p className="text-sm text-gray-400">
                    {assessmentType === "project"
                      ? "Your submission has been recorded."
                      : assessmentResult?.passed
                        ? `You passed with ${assessmentResult.score}%.`
                        : `You scored ${assessmentResult?.score}%. You need ${assessmentResult?.passingScore}% to pass.`}
                  </p>
                  {assessmentType !== "project" && (
                    <p className="mt-2 text-xs text-gray-500">
                      {assessmentResult?.earned}/{assessmentResult?.total} points earned
                    </p>
                  )}
                </div>

                {assessmentType !== "project" && assessmentResult?.questions?.length > 0 && (
                  <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                    {assessmentResult.questions.map((question: any, index: number) => (
                      <div key={question.id} className={`rounded-xl border p-4 ${question.is_correct ? "border-green-700 bg-green-500/10" : "border-red-800 bg-red-500/10"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-white">Q{index + 1}. {question.question_text}</p>
                          <span className={`text-xs font-semibold ${question.is_correct ? "text-green-300" : "text-red-300"}`}>
                            {question.is_correct ? "Correct" : "Wrong"}
                          </span>
                        </div>
                        <div className="mt-3 space-y-1 text-xs">
                          <p className="text-gray-400">Your answer: <span className="text-white">{question.user_answer || "No answer"}</span></p>
                          {!question.is_correct && <p className="text-gray-400">Correct answer: <span className="text-green-300">{question.correct_answer}</span></p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  {!assessmentResult?.passed && assessmentType !== "project" && (
                    <button
                      onClick={startAssessment}
                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      Try Again
                    </button>
                  )}

                  {assessmentResult?.passed && assessment.kind === "lesson" && !progress[assessment.data.lesson_id] && (
                    <button
                      onClick={async () => {
                        const lessonId = assessment.data.lesson_id;
                        setAssessment(null);
                        await markLessonComplete(lessonId);
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      Complete Lesson Now
                    </button>
                  )}

                  <button
                    onClick={async () => {
                      const activeAssessment = assessment;
                      setAssessment(null);
                      if (assessmentResult?.passed && activeAssessment?.kind === "lesson" && progress[activeAssessment.data.lesson_id]) {
                        const moduleData = modules.find((mod: any) => mod.id === activeAssessment.data.module_id);
                        await maybePromptMilestone(moduleData);
                      }
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    {assessmentResult?.passed && assessment.kind === "lesson" && !progress[assessment.data.lesson_id] ? "Later" : "Close"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };


  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-white text-center">
        <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-gray-400">Loading course...</p>
      </div>
    </div>
  );

  const allLessons = getAllLessons();
  const completedCount = allLessons.filter(l => progress[l.id]).length;
  const overallProgress = allLessons.length > 0 ? Math.round((completedCount / allLessons.length) * 100) : 0;
  const currentIdx = allLessons.findIndex(l => l.id === currentLesson?.id);
  const nextLesson = currentIdx >= 0 ? allLessons[currentIdx + 1] : null;
  const nextLessonUnlocked = nextLesson ? isLessonAccessible(nextLesson.id) : false;
  const showMilestoneView = Boolean(requestedMilestoneId && selectedMilestone);
  const hasVideo = Boolean(currentLesson?.video_url);
  const hasDescription = Boolean(currentLesson?.description?.trim() || currentLesson?.details?.trim());
  const hasResource = Boolean(currentLesson?.resource_url || currentLesson?.pdf_url);
  const hasRichContent = hasVideo && hasDescription;
  const milestoneResult = selectedMilestone?.milestone_type === "mcq" && milestoneAttempt?.completed_at
    ? {
        score: milestoneAttempt.score,
        passed: milestoneAttempt.passed,
        questions: milestoneQuestions.map((question: any) => {
          const userAnswer = milestoneAttempt?.answers?.[question.id] || milestoneAttempt?.answers?.[question._id] || "";
          return {
            id: question.id,
            question_text: question.question_text,
            user_answer: userAnswer,
            correct_answer: question.correct_answer,
            is_correct: userAnswer !== "" && userAnswer === question.correct_answer,
            points: question.points || 1,
          };
        }),
        earned: milestoneQuestions.reduce((sum: number, question: any) => {
          const userAnswer = milestoneAttempt?.answers?.[question.id] || milestoneAttempt?.answers?.[question._id] || "";
          return sum + (userAnswer !== "" && userAnswer === question.correct_answer ? question.points || 1 : 0);
        }, 0),
        total: milestoneQuestions.reduce((sum: number, question: any) => sum + (question.points || 1), 0),
        passingScore: selectedMilestone?.passing_score || 70,
      }
    : null;

  return (
    <>
      <div className="min-h-screen bg-gray-950 flex flex-col">
        {/* Top bar */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
        <Link href="/dashboard/learner/my-learning" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
          <ChevronLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-white truncate">{course?.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-24 bg-gray-700 rounded-full h-1.5">
              <div className="h-1.5 bg-blue-500 rounded-full transition-all" style={{ width: `${overallProgress}%` }} />
            </div>
            <span className="text-xs text-gray-400">{overallProgress}%</span>
          </div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Main content */}
          <main className={`flex-1 overflow-y-auto transition-all ${sidebarOpen ? "lg:mr-80" : ""}`}>
          {showMilestoneView ? (
            <div className="max-w-5xl mx-auto p-4 lg:p-6">
              <div className="rounded-[28px] border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] mb-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-amber-400">Module milestone</p>
                    <h2 className="mt-3 text-3xl font-bold text-white">{selectedMilestone?.title}</h2>
                    <p className="mt-2 text-sm text-slate-400">{selectedMilestoneModule?.title || "Module"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-right text-sm text-slate-300">
                    <div className="font-medium text-white">{selectedMilestone?.milestone_type === "project" ? "Project submission" : "Multiple choice"}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {selectedMilestone?.milestone_type === "project"
                        ? milestoneSubmission?.review_status === "graded"
                          ? milestoneSubmission?.passed ? "Passed" : "Needs another submission"
                          : milestoneSubmission?.submission_url ? "Pending teacher review" : "Not submitted"
                        : milestoneResult
                          ? milestoneResult.passed ? `Passed with ${milestoneResult.score}%` : `Scored ${milestoneResult.score}%`
                          : `${milestoneQuestions.length} questions`}
                    </div>
                  </div>
                </div>

                {selectedMilestone?.description && (
                  <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 text-sm leading-7 text-slate-300 whitespace-pre-wrap">
                    {selectedMilestone.description}
                  </div>
                )}
              </div>

              {milestoneError && (
                <div className="mb-6 rounded-2xl border border-red-900/60 bg-red-950/50 px-4 py-3 text-sm text-red-200">
                  {milestoneError}
                </div>
              )}

              {!milestoneUnlocked && (
                <div className="mb-6 rounded-2xl border border-amber-900/40 bg-amber-950/40 p-5">
                  <div className="flex items-start gap-3">
                    <Lock className="mt-0.5 h-5 w-5 text-amber-300" />
                    <div>
                      <p className="text-sm font-medium text-white">This milestone is still locked.</p>
                      <p className="mt-1 text-sm text-amber-100/80">{milestoneBlockedReason || "Finish the required lessons and lesson tests first."}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedMilestone?.milestone_type === "project" && milestoneUnlocked && (
                <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                  <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                    <div className="flex items-center gap-3">
                      <Award className="h-5 w-5 text-amber-400" />
                      <h3 className="text-lg font-semibold text-white">Project Submission</h3>
                    </div>
                    <p className="mt-3 text-sm text-gray-400">Submit your file or portfolio link here. A teacher will review it manually before this milestone counts as passed.</p>
                    {selectedMilestone?.project_link && (
                      <a href={selectedMilestone.project_link} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800">
                        Open project brief
                      </a>
                    )}
                    <div className="mt-6 space-y-3">
                      <label className="block text-sm font-medium text-gray-200">Submission link</label>
                      <input
                        type="url"
                        value={milestoneProjectLink}
                        onChange={(event) => setMilestoneProjectLink(event.target.value)}
                        className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="Paste the file, repo, or portfolio URL"
                      />
                      <button
                        type="button"
                        onClick={submitMilestoneProject}
                        disabled={milestoneSubmitting || !milestoneProjectLink.trim()}
                        className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-medium text-black hover:bg-amber-400 disabled:opacity-60"
                      >
                        {milestoneSubmission?.submission_url ? "Update submission" : "Submit project"}
                      </button>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                    <h3 className="text-lg font-semibold text-white">Review Status</h3>
                    {!milestoneSubmission?.submission_url ? (
                      <p className="mt-4 text-sm text-gray-400">No project has been submitted yet.</p>
                    ) : (
                      <div className="mt-4 space-y-4 text-sm text-gray-300">
                        <a href={milestoneSubmission.submission_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-amber-300 hover:text-amber-200">
                          Open submitted link
                        </a>
                        {milestoneSubmission.review_status === "pending" && (
                          <div className="rounded-xl border border-amber-900/40 bg-amber-950/50 px-4 py-3 text-amber-100">
                            Your teacher needs to grade this submission manually before the milestone is marked as passed.
                          </div>
                        )}
                        {milestoneSubmission.review_status === "graded" && (
                          <div className={`rounded-xl border px-4 py-3 ${milestoneSubmission.passed ? "border-green-900/50 bg-green-950/40 text-green-100" : "border-red-900/50 bg-red-950/40 text-red-100"}`}>
                            <p>{milestoneSubmission.passed ? "This milestone has been passed." : "This submission was reviewed and needs another attempt."}</p>
                            {milestoneSubmission.score !== null && milestoneSubmission.score !== undefined && <p className="mt-2 text-sm">Score: {milestoneSubmission.score}%</p>}
                            {milestoneSubmission.feedback && <p className="mt-2 whitespace-pre-wrap text-sm">Feedback: {milestoneSubmission.feedback}</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {selectedMilestone?.milestone_type === "mcq" && milestoneUnlocked && (
                <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                  <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">Milestone Questions</h3>
                        <p className="mt-2 text-sm text-gray-400">You need {selectedMilestone?.passing_score || 70}% to pass this milestone.</p>
                      </div>
                      {!milestoneResult && !milestoneAttemptId && (
                        <button
                          type="button"
                          onClick={startMilestoneAttempt}
                          disabled={milestoneSubmitting || milestoneQuestions.length === 0}
                          className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-medium text-black hover:bg-amber-400 disabled:opacity-60"
                        >
                          Start milestone
                        </button>
                      )}
                    </div>

                    {milestoneQuestions.length === 0 ? (
                      <div className="mt-6 rounded-xl border border-dashed border-gray-700 bg-gray-950 px-4 py-6 text-sm text-gray-400">
                        No questions are configured for this milestone yet.
                      </div>
                    ) : milestoneResult ? (
                      <div className="mt-6 space-y-4">
                        {milestoneResult.questions.map((question: any, index: number) => (
                          <div key={question.id} className={`rounded-2xl border p-4 ${question.is_correct ? "border-green-900/60 bg-green-950/40" : "border-red-900/60 bg-red-950/40"}`}>
                            <div className="flex items-start justify-between gap-4">
                              <p className="text-sm font-medium text-white">Q{index + 1}. {question.question_text}</p>
                              <span className={`shrink-0 text-xs font-semibold ${question.is_correct ? "text-green-300" : "text-red-300"}`}>
                                {question.is_correct ? "Correct" : "Wrong"}
                              </span>
                            </div>
                            <div className="mt-3 space-y-1 text-xs text-gray-300">
                              <p>Your answer: <span className="text-white">{question.user_answer || "No answer"}</span></p>
                              {!question.is_correct && <p>Correct answer: <span className="text-green-300">{question.correct_answer}</span></p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : milestoneAttemptId ? (
                      <div className="mt-6 space-y-4">
                        {milestoneQuestions.map((question: any, index: number) => (
                          <div key={question.id} className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
                            <p className="text-sm font-medium text-white">Q{index + 1}. {question.question_text}</p>
                            <div className="mt-3 space-y-2">
                              {(question.options || []).map((option: string) => (
                                <label key={`${question.id}-${option}`} className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${milestoneAnswers[question.id] === option ? "border-amber-500 bg-amber-500/10 text-white" : "border-gray-800 bg-gray-900 text-gray-300"}`}>
                                  <input
                                    type="radio"
                                    name={question.id}
                                    checked={milestoneAnswers[question.id] === option}
                                    onChange={() => setMilestoneAnswers((prev) => ({ ...prev, [question.id]: option }))}
                                    className="accent-amber-500"
                                  />
                                  <span>{option}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={submitMilestoneAnswers}
                          disabled={milestoneSubmitting}
                          className="rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-60"
                        >
                          Submit answers
                        </button>
                      </div>
                    ) : (
                      <div className="mt-6 rounded-xl border border-gray-800 bg-gray-950 px-4 py-6 text-sm text-gray-400">
                        Start the milestone to answer the questions here.
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                    <h3 className="text-lg font-semibold text-white">Result</h3>
                    {!milestoneResult ? (
                      <p className="mt-4 text-sm text-gray-400">Your score will appear here after you submit the milestone.</p>
                    ) : (
                      <div className="mt-4 space-y-4 text-sm text-gray-300">
                        <div className={`rounded-2xl border px-4 py-4 ${milestoneResult.passed ? "border-green-900/60 bg-green-950/40" : "border-red-900/60 bg-red-950/40"}`}>
                          <p className="text-white">{milestoneResult.passed ? `You passed with ${milestoneResult.score}%.` : `You scored ${milestoneResult.score}%.`}</p>
                          <p className="mt-2 text-xs text-gray-300">{milestoneResult.earned}/{milestoneResult.total} points earned. Passing score: {milestoneResult.passingScore}%.</p>
                        </div>
                        {!milestoneResult.passed && (
                          <button
                            type="button"
                            onClick={startMilestoneAttempt}
                            disabled={milestoneSubmitting}
                            className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-medium text-black hover:bg-amber-400 disabled:opacity-60"
                          >
                            Try again
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </div>
          ) : currentLesson ? (
            <div className="max-w-4xl mx-auto p-4 lg:p-6">
              <div className="rounded-[28px] border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] mb-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <p className="text-xs uppercase tracking-[0.24em] text-blue-300/80">Current lesson</p>
                    <h2 className="mt-3 text-3xl font-bold text-white">{currentLesson.title}</h2>
                    {currentLesson.subtitle && (
                      <p className="mt-2 text-base text-slate-300">{currentLesson.subtitle}</p>
                    )}
                  </div>
                  {hasResource && (
                    <a
                      href={currentLesson.resource_url || currentLesson.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm text-slate-100 hover:bg-slate-700 transition-colors"
                    >
                      {currentLesson.resource_name || (currentLesson.resource_url ? "Open resource" : "View PDF")}
                    </a>
                  )}
                </div>

                {hasRichContent ? (
                  <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="overflow-hidden rounded-3xl border border-slate-800 bg-black shadow-2xl">
                      <div className="aspect-video">
                        <iframe
                          src={getVideoEmbed(currentLesson.video_url) || ""}
                          className="h-full w-full"
                          allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                      </div>
                    </div>
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Lesson overview</p>
                      {currentLesson.description && (
                        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-200">{currentLesson.description}</p>
                      )}
                      {currentLesson.details && (
                        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-400">{currentLesson.details}</p>
                      )}
                    </div>
                  </div>
                ) : hasVideo ? (
                  <div className="mt-6 overflow-hidden rounded-3xl border border-slate-800 bg-black shadow-2xl">
                    <div className="aspect-video">
                      <iframe
                        src={getVideoEmbed(currentLesson.video_url) || ""}
                        className="h-full w-full"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    </div>
                  </div>
                ) : hasDescription ? (
                  <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/80 p-8">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Read through this lesson</p>
                    {currentLesson.description && (
                      <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-slate-200">{currentLesson.description}</p>
                    )}
                    {currentLesson.details && (
                      <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-400">{currentLesson.details}</p>
                    )}
                  </div>
                ) : (
                  <div className="mt-6 rounded-3xl border border-dashed border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
                    This lesson does not include written content or a video yet.
                  </div>
                )}

                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={() => markLessonComplete(currentLesson.id)}
                    className={`h-9 w-9 rounded-full flex items-center justify-center border transition-colors ${
                      progress[currentLesson.id]
                        ? "border-green-400 text-green-400 bg-green-500/10"
                        : "border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-400"
                    }`}
                    aria-label={progress[currentLesson.id] ? "Lesson completed" : "Mark lesson complete"}
                  >
                    {progress[currentLesson.id] ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  </button>
                  <span className={`text-sm ${progress[currentLesson.id] ? "text-green-400" : "text-gray-400"}`}>
                    {progress[currentLesson.id] ? "Completed" : "Mark complete"}
                  </span>
                </div>
              </div>

              {hasDescription && hasVideo && (
                <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-sm text-slate-400">
                  Watch the lesson and use the text beside it as your study notes before moving to the lesson test.
                </div>
              )}

              {currentLesson.lesson_test && (
                <div className="bg-gray-900 rounded-xl p-5 mb-4">
                  <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Lesson test</p>
                        <p className="text-sm font-medium text-white mt-1">{currentLesson.lesson_test.title}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {currentLesson.lesson_test.test_type === "project"
                            ? "Project submission required"
                            : `${currentLesson.lesson_test.question_count || 0} questions`}
                        </p>
                      </div>
                      <button
                        onClick={() => openAssessment("lesson", currentLesson)}
                        className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        {isLessonTestCompleted(currentLesson) ? "Review" : "Take test"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => navigateLesson("prev")}
                  disabled={currentIdx <= 0}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                {currentIdx < allLessons.length - 1 && (
                  <button
                    onClick={() => navigateLesson("next")}
                    disabled={!nextLessonUnlocked}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500 p-8">
                <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Select a lesson to start learning</p>
              </div>
            </div>
          )}
          </main>

          {/* Sidebar */}
          {sidebarOpen && (
            <aside className="fixed right-0 top-14 bottom-0 w-80 bg-gray-900 border-l border-gray-800 overflow-y-auto z-20">
            <div className="p-4">
              {/* Progress */}
              <div className="mb-4 p-3 bg-gray-800 rounded-lg">
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>Overall Progress</span>
                  <span>{completedCount}/{allLessons.length} lessons</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="h-2 bg-blue-500 rounded-full transition-all" style={{ width: `${overallProgress}%` }} />
                </div>
              </div>

              {/* Modules & Lessons */}
              <div className="space-y-3">
                {modules.map((mod, mIdx) => {
                  const moduleCompleted = isModulePassed(mod);
                  const moduleUnlocked = isModuleUnlocked(mIdx);
                  return (
                    <div key={mod.id}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Module {mIdx + 1}: {mod.title}
                      </p>
                      <div className="space-y-1">
                        {mod.lessons?.map((lesson: any, lIdx: number) => {
                          const isCompleted = progress[lesson.id];
                          const isCurrent = !showMilestoneView && currentLesson?.id === lesson.id;
                          const lessonUnlocked = isLessonUnlocked(mIdx, lIdx);
                          return (
                            <button
                              key={lesson.id}
                              onClick={() => {
                                if (!lessonUnlocked) return;
                                router.push(`/learn/${courseId}?lessonId=${lesson.id}`);
                                setCurrentLesson(lesson);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${
                                !lessonUnlocked
                                  ? "bg-gray-900 text-gray-600 cursor-not-allowed"
                                  : isCurrent
                                  ? "bg-blue-600 text-white"
                                  : "text-gray-300 hover:bg-gray-800"
                              }`}
                              disabled={!lessonUnlocked}
                            >
                              {!lessonUnlocked ? (
                                <Lock className="w-4 h-4 shrink-0" />
                              ) : isCompleted ? (
                                <CheckCircle className={`w-4 h-4 shrink-0 ${isCurrent ? "text-white" : "text-green-400"}`} />
                              ) : (
                                <Circle className={`w-4 h-4 shrink-0 ${isCurrent ? "text-white" : "text-gray-600"}`} />
                              )}
                              <span className="truncate">{lesson.title}</span>
                            </button>
                          );
                        })}
                      </div>

                      {mod.milestones?.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Milestones</p>
                          {mod.milestones.map((milestone: any) => {
                            const isDone = isMilestoneCompleted(milestone);
                            const isLocked = !moduleUnlocked || !(mod.lessons || []).every((lesson: any) => progress[lesson.id]) || !(mod.lessons || []).every((lesson: any) => isLessonTestCompleted(lesson));
                            return (
                              <button
                                key={milestone.id}
                                    onClick={() => {
                                      if (isLocked) return;
                                      router.push(`/learn/${courseId}?milestoneId=${milestone.id}`);
                                    }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${
                                  isLocked
                                    ? "bg-gray-900 text-gray-600 cursor-not-allowed"
                                        : requestedMilestoneId === milestone.id
                                          ? "bg-blue-600 text-white"
                                        : milestone.submission?.review_status === "pending"
                                          ? "bg-amber-900/20 text-amber-200 hover:bg-amber-900/30"
                                          : isDone
                                      ? "bg-green-900/30 text-green-300"
                                      : "bg-gray-900 text-gray-300 hover:bg-gray-800"
                                }`}
                              >
                                {isLocked ? <Lock className="w-4 h-4 shrink-0" /> : <Award className="w-4 h-4 shrink-0" />}
                                <span className="truncate">{milestone.title}</span>
                                    {milestone.submission?.review_status === "pending" && (
                                      <span className="ml-auto shrink-0 text-[11px] text-amber-300">Pending</span>
                                    )}
                                    {milestone.submission?.review_status === "graded" && milestone.submission?.passed === false && (
                                      <span className="ml-auto shrink-0 text-[11px] text-red-300">Retry</span>
                                    )}
                              </button>
                            );
                          })}
                          <p className="text-[11px] text-gray-500">
                            {moduleCompleted ? "Module passed." : moduleUnlocked ? "Complete all lessons and lesson tests to unlock." : "Finish the previous module first."}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}

                {finalQuiz && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Final Test</p>
                    {finalQuizUnlocked ? (
                      <Link
                        key={finalQuiz.id}
                        href={`/quiz/${finalQuiz.id}`}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                      >
                        <ClipboardList className="w-4 h-4 shrink-0 text-amber-400" />
                        <span className="truncate">{finalQuiz.title}</span>
                        {finalQuiz.latest_attempt?.passed && <span className="text-[11px] text-green-400 shrink-0">Passed</span>}
                      </Link>
                    ) : (
                      <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm text-gray-600 bg-gray-900">
                        <Lock className="w-4 h-4 shrink-0" />
                        <span className="truncate">{finalQuiz.title}</span>
                      </div>
                    )}
                    <p className="text-[11px] text-gray-500 mt-2">
                      {finalQuizUnlocked ? "Final test unlocked." : "Finish all modules and milestones to unlock the final test."}
                    </p>
                  </div>
                )}
              </div>
            </div>
            </aside>
          )}
        </div>
      </div>
      {renderAssessmentModal()}
    </>
  );
}
