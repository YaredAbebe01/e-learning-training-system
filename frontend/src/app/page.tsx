import Link from "next/link";
import { BookOpen, Users, Award, BarChart3, CheckCircle, GraduationCap, Shield, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 rounded-xl p-1.5">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">LearnHub</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Sign In</Link>
            <Link href="/register" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block bg-white/20 text-white text-sm font-medium px-4 py-1.5 rounded-full mb-6">E-Learning & Corporate Training Platform</span>
          <h1 className="text-5xl sm:text-6xl font-bold mb-6 leading-tight">
            Learn Smarter,<br />Grow Faster
          </h1>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            A complete LMS platform for schools, companies, and training centers. Deliver engaging courses, track progress, and issue verifiable certificates.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="bg-white text-blue-700 hover:bg-blue-50 font-semibold px-8 py-3.5 rounded-xl text-lg transition-colors shadow-lg">
              Start Learning Free
            </Link>
            <Link href="/login" className="bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-3.5 rounded-xl text-lg transition-colors border border-white/30">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gray-50 py-12 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: "3 Roles", label: "Admin, Instructor, Learner" },
            { value: "Video", label: "Course Streaming" },
            { value: "Auto", label: "Quiz Grading" },
            { value: "PDF", label: "Certificate Download" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-2xl font-bold text-blue-600 mb-1">{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything you need in one platform</h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">Built for schools, enterprises, and certification centers</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <Users className="w-6 h-6" />, title: "Role-Based Access", desc: "Separate portals for Admins, Instructors, and Learners with tailored dashboards.", color: "bg-blue-100 text-blue-600" },
              { icon: <BookOpen className="w-6 h-6" />, title: "Course Management", desc: "Create structured courses with modules, lessons, and embedded video content.", color: "bg-purple-100 text-purple-600" },
              { icon: <Zap className="w-6 h-6" />, title: "Smart Quizzes", desc: "MCQ, True/False, and short-answer questions with automatic grading and time limits.", color: "bg-yellow-100 text-yellow-600" },
              { icon: <BarChart3 className="w-6 h-6" />, title: "Progress Tracking", desc: "Real-time dashboards showing lesson completion, quiz scores, and course progress.", color: "bg-green-100 text-green-600" },
              { icon: <Award className="w-6 h-6" />, title: "Certificates", desc: "Auto-generate beautiful PDF certificates upon course completion.", color: "bg-orange-100 text-orange-600" },
              { icon: <Shield className="w-6 h-6" />, title: "Admin Control", desc: "Full user management, course oversight, and platform analytics for administrators.", color: "bg-red-100 text-red-600" },
            ].map(f => (
              <div key={f.title} className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className={`${f.color} w-12 h-12 rounded-xl flex items-center justify-center mb-4`}>{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2 text-lg">{f.title}</h3>
                <p className="text-gray-500 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who is it for */}
      <section className="bg-gray-50 py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Built for every learning environment</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { emoji: "🏫", title: "Schools & Universities", items: ["Student course enrollment", "Assignment tracking", "Grade analytics", "Completion certificates"] },
              { emoji: "🏢", title: "Corporate Training", items: ["Employee onboarding", "Compliance training", "Skill assessments", "Progress reports"] },
              { emoji: "📋", title: "Certification Centers", items: ["Exam management", "Automatic grading", "Certificate issuance", "Performance analytics"] },
            ].map(g => (
              <div key={g.title} className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                <div className="text-4xl mb-3">{g.emoji}</div>
                <h3 className="font-bold text-gray-900 text-lg mb-4">{g.title}</h3>
                <ul className="space-y-2">
                  {g.items.map(i => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> {i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <GraduationCap className="w-16 h-16 text-blue-600 mx-auto mb-6" />
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Ready to start learning?</h2>
          <p className="text-gray-500 text-lg mb-8">Join today as a learner or instructor and start building your knowledge.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors">
              Join as Learner
            </Link>
            <Link href="/register" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors">
              Join as Instructor
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 px-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <BookOpen className="w-5 h-5 text-blue-400" />
          <span className="font-bold text-white">LearnHub</span>
        </div>
        <p className="text-sm">E-Learning & Corporate Training Platform</p>
      </footer>
    </div>
  );
}
