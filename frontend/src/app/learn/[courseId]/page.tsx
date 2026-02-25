"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, CheckCircle, Circle, Play,
  BookOpen, ClipboardList, Menu, X, Award, Lock
} from "lucide-react";
import Link from "next/link";

interface PageProps { params: Promise<{ courseId: string }> }

export default function CourseViewerPage({ params }: PageProps) {
  const router = useRouter();
  const [courseId, setCourseId] = useState("");
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [currentLesson, setCurrentLesson] = useState<any>(null);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
      }));
      setModules(sortedModules);
      setQuizzes(payload.quizzes || []);

      const progressMap: Record<string, boolean> = {};
      (payload.lessonProgress || []).forEach((p: any) => { progressMap[p.lesson_id] = p.is_completed; });
      setProgress(progressMap);

      // Set first uncompleted lesson
      let firstLesson: any = null;
      for (const mod of sortedModules) {
        for (const lesson of (mod.lessons || [])) {
          if (!progressMap[lesson.id] && !firstLesson) firstLesson = lesson;
        }
      }
      if (!firstLesson && sortedModules[0]?.lessons?.[0]) {
        firstLesson = sortedModules[0].lessons[0];
      }
      setCurrentLesson(firstLesson);
      setLoading(false);
    };
    load();
  }, [courseId]);

  const markLessonComplete = async (lessonId: string) => {
    if (progress[lessonId]) return;
    await fetch("/api/learner/lesson-complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, lessonId }),
    });
    setProgress(prev => ({ ...prev, [lessonId]: true }));
  };

  const getAllLessons = () => modules.flatMap(m => m.lessons || []);

  const navigateLesson = (direction: "prev" | "next") => {
    const all = getAllLessons();
    const idx = all.findIndex(l => l.id === currentLesson?.id);
    if (direction === "prev" && idx > 0) setCurrentLesson(all[idx - 1]);
    if (direction === "next" && idx < all.length - 1) setCurrentLesson(all[idx + 1]);
  };

  const getVideoEmbed = (url: string) => {
    if (!url) return null;
    const youtube = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&\n?#]+)/);
    if (youtube) return `https://www.youtube.com/embed/${youtube[1]}?rel=0`;
    const vimeo = url.match(/vimeo\.com\/(\d+)/);
    if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
    return url;
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

  return (
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
          {currentLesson ? (
            <div className="max-w-4xl mx-auto p-4 lg:p-6">
              {/* Video Player */}
              {currentLesson.video_url ? (
                <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6 shadow-xl">
                  <iframe
                    src={getVideoEmbed(currentLesson.video_url) || ""}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-gray-800 rounded-xl flex items-center justify-center mb-6">
                  <div className="text-center text-gray-500">
                    <Play className="w-16 h-16 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No video for this lesson</p>
                  </div>
                </div>
              )}

              {/* Lesson info */}
              <div className="bg-gray-900 rounded-xl p-5 mb-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h2 className="text-xl font-bold text-white">{currentLesson.title}</h2>
                  <button
                    onClick={() => markLessonComplete(currentLesson.id)}
                    className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      progress[currentLesson.id]
                        ? "bg-green-500/20 text-green-400 cursor-default"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {progress[currentLesson.id] ? <><CheckCircle className="w-4 h-4" /> Completed</> : "Mark Complete"}
                  </button>
                </div>
                {currentLesson.description && (
                  <p className="text-gray-400 text-sm leading-relaxed">{currentLesson.description}</p>
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => navigateLesson("prev")}
                  disabled={currentIdx <= 0}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                {currentIdx < allLessons.length - 1 ? (
                  <button
                    onClick={() => navigateLesson("next")}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <Link href="/dashboard/learner/certificates" className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors">
                    <Award className="w-4 h-4" /> Get Certificate
                  </Link>
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
                {modules.map((mod, mIdx) => (
                  <div key={mod.id}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Module {mIdx + 1}: {mod.title}
                    </p>
                    <div className="space-y-1">
                      {mod.lessons?.map((lesson: any) => {
                        const isCompleted = progress[lesson.id];
                        const isCurrent = currentLesson?.id === lesson.id;
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => setCurrentLesson(lesson)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${
                              isCurrent
                                ? "bg-blue-600 text-white"
                                : "text-gray-300 hover:bg-gray-800"
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle className={`w-4 h-4 shrink-0 ${isCurrent ? "text-white" : "text-green-400"}`} />
                            ) : (
                              <Circle className={`w-4 h-4 shrink-0 ${isCurrent ? "text-white" : "text-gray-600"}`} />
                            )}
                            <span className="truncate">{lesson.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Quizzes */}
                {quizzes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quizzes</p>
                    <div className="space-y-1">
                      {quizzes.map((quiz: any) => (
                        <Link
                          key={quiz.id}
                          href={`/quiz/${quiz.id}`}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                        >
                          <ClipboardList className="w-4 h-4 shrink-0 text-purple-400" />
                          <span className="truncate">{quiz.title}</span>
                          <span className="text-xs text-gray-500 shrink-0">{quiz.quiz_questions?.[0]?.count ?? 0}q</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
