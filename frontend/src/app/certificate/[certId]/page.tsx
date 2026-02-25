"use client";

import { useEffect, useState } from "react";
import { Award, Download, ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";

interface PageProps { params: Promise<{ certId: string }> }

export default function CertificatePage({ params }: PageProps) {
  const [cert, setCert] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    params.then(async ({ certId }) => {
      const response = await fetch(`/api/certificates/${certId}`);
      if (!response.ok) return;
      const payload = await response.json();
      setCert(payload.cert);
      setProfile(payload.profile);
      setLoading(false);
    });
  }, [params]);

  const downloadPDF = async () => {
    if (!cert || !profile) return;
    setDownloading(true);

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();

    // Background
    doc.setFillColor(250, 248, 255);
    doc.rect(0, 0, w, h, "F");

    // Border
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(3);
    doc.rect(8, 8, w - 16, h - 16);
    doc.setDrawColor(167, 139, 250);
    doc.setLineWidth(1);
    doc.rect(12, 12, w - 24, h - 24);

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(36);
    doc.setTextColor(67, 56, 202);
    doc.text("Certificate of Completion", w / 2, 45, { align: "center" });

    // Subtitle
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(107, 114, 128);
    doc.text("This is to certify that", w / 2, 60, { align: "center" });

    // Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(32);
    doc.setTextColor(17, 24, 39);
    doc.text(profile.full_name || profile.email, w / 2, 80, { align: "center" });

    // Divider line under name
    doc.setDrawColor(167, 139, 250);
    doc.setLineWidth(0.5);
    const nameWidth = Math.min(doc.getTextWidth(profile.full_name || profile.email) + 20, w - 80);
    doc.line(w / 2 - nameWidth / 2, 84, w / 2 + nameWidth / 2, 84);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(107, 114, 128);
    doc.text("has successfully completed the course", w / 2, 96, { align: "center" });

    // Course name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(67, 56, 202);
    doc.text(cert.course?.title || "Course", w / 2, 113, { align: "center" });

    // Course details
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128);
    const details = [cert.course?.category, cert.course?.level].filter(Boolean).join(" · ");
    if (details) doc.text(details, w / 2, 123, { align: "center" });

    // Issued by
    doc.setFontSize(12);
    doc.text(`Instructor: ${cert.course?.instructor?.full_name || "LearnHub Instructor"}`, w / 2, 138, { align: "center" });

    // Date and cert number
    doc.setFontSize(10);
    doc.setTextColor(156, 163, 175);
    const dateStr = new Date(cert.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    doc.text(`Issued: ${dateStr}`, 30, h - 20);
    doc.text(`Certificate No: ${cert.certificate_number}`, w - 30, h - 20, { align: "right" });

    // LearnHub branding
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(99, 102, 241);
    doc.text("LearnHub", w / 2, h - 20, { align: "center" });

    doc.save(`certificate-${cert.certificate_number}.pdf`);
    setDownloading(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400">Loading certificate...</p>
    </div>
  );

  if (!cert) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-red-500">Certificate not found</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/dashboard/learner/certificates" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Certificates
        </Link>

        {/* Certificate Preview */}
        <div className="bg-white rounded-3xl shadow-2xl border-4 border-indigo-200 p-12 mb-6 relative overflow-hidden">
          {/* Decorative blobs */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-100 rounded-full opacity-40" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-100 rounded-full opacity-40" />

          <div className="relative text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-2xl">
                <Award className="w-12 h-12 text-white" />
              </div>
            </div>

            <p className="text-sm font-semibold text-indigo-500 uppercase tracking-widest mb-2">Certificate of Completion</p>
            <h1 className="text-4xl font-bold text-indigo-700 mb-4 font-serif">LearnHub</h1>

            <p className="text-gray-500 text-sm mb-2">This is to certify that</p>
            <h2 className="text-4xl font-bold text-gray-900 mb-1">{profile?.full_name}</h2>
            <div className="w-48 h-0.5 bg-indigo-300 mx-auto mb-4" />

            <p className="text-gray-500 mb-2">has successfully completed the course</p>
            <h3 className="text-2xl font-bold text-indigo-700 mb-2">{cert.course?.title}</h3>
            {cert.course?.category && (
              <p className="text-gray-400 text-sm mb-4">{cert.course.category} · <span className="capitalize">{cert.course.level}</span></p>
            )}
            <p className="text-gray-500 text-sm mb-1">Instructor: <span className="font-semibold text-gray-700">{cert.course?.instructor?.full_name || "—"}</span></p>
            <p className="text-gray-400 text-sm mb-6">
              Issued on {new Date(cert.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>

            <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-2 inline-flex mx-auto">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700 font-medium">Verified Certificate</span>
            </div>

            <p className="text-xs text-gray-300 mt-4">Certificate No: {cert.certificate_number}</p>
          </div>
        </div>

        <button
          onClick={downloadPDF}
          disabled={downloading}
          className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-4 rounded-2xl transition-colors text-lg"
        >
          <Download className="w-6 h-6" />
          {downloading ? "Generating PDF..." : "Download Certificate (PDF)"}
        </button>
      </div>
    </div>
  );
}
