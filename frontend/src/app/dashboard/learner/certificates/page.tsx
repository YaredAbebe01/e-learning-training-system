import { apiFetch, requireRole } from "@/lib/auth-helpers";
import { Award, Download } from "lucide-react";
import Link from "next/link";

export default async function CertificatesPage() {
  await requireRole("learner");

  const response = await apiFetch("/api/learner/certificates");
  if (!response.ok) return null;
  const payload = await response.json();

  const certificates = payload.certificates || [];
  const profile = payload.profile || null;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Certificates</h1>
        <p className="text-gray-500 mt-1">{certificates?.length ?? 0} certificates earned</p>
      </div>

      {!certificates?.length ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <Award className="w-20 h-20 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No certificates yet</h3>
          <p className="text-gray-400 mb-6">Complete a course to earn your certificate</p>
          <Link href="/dashboard/learner/courses" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            Browse Courses
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {certificates.map((cert: any) => (
            <div key={cert.id} className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-2xl p-6 relative overflow-hidden">
              {/* Decorative */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-200/30 rounded-full -translate-y-16 translate-x-16" />
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-amber-200/30 rounded-full translate-y-10 -translate-x-10" />
              
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-yellow-400 p-3 rounded-xl">
                    <Award className="w-8 h-8 text-white" />
                  </div>
                  <span className="text-xs text-gray-500 bg-white/60 px-2 py-1 rounded-full">#{cert.certificate_number}</span>
                </div>

                <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wider mb-1">Certificate of Completion</p>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{cert.course?.title}</h3>
                <p className="text-sm text-gray-600 mb-3">Awarded to <span className="font-semibold">{profile?.full_name}</span></p>
                
                <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                  <span>Instructor: {cert.course?.instructor?.full_name || "—"}</span>
                  <span>·</span>
                  <span className="capitalize">{cert.course?.level}</span>
                </div>
                <p className="text-xs text-gray-500 mb-4">Issued: {new Date(cert.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

                <Link
                  href={`/certificate/${cert.id}`}
                  className="flex items-center justify-center gap-2 w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
                >
                  <Download className="w-4 h-4" /> View & Download
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
