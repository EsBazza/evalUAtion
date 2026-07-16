import { toast } from '@/components/ui-ua/toast';

interface ExportCSVProps {
  professor: {
    name: string;
    email: string;
    level: string;
    department: string;
  };
  academicYear: string;
  semester: string;
  scoreCache: any;
  clusterScores: any[];
  sectionScores: any[];
  commentsList: string[];
}

export function exportFacultyCSV({
  professor,
  academicYear,
  semester,
  scoreCache,
  clusterScores,
  sectionScores,
  commentsList,
}: ExportCSVProps) {
  try {
    const headers = ["Metric", "Value"];
    const rows = [
      ["Professor Name", professor.name],
      ["Email", professor.email],
      ["Level", professor.level],
      ["Department", professor.department],
      ["Academic Year", academicYear],
      ["Semester", semester],
      ["Composite Score", scoreCache?.compositeScore !== null && scoreCache?.compositeScore !== undefined ? `${scoreCache.compositeScore}%` : "N/A"],
      ["Scale Score", scoreCache?.scaleScore !== null && scoreCache?.scaleScore !== undefined ? `${scoreCache.scaleScore}%` : "N/A"],
      ["AI Sentiment Score", scoreCache?.aiQualityScore !== null && scoreCache?.aiQualityScore !== undefined ? `${scoreCache.aiQualityScore}%` : "N/A"],
    ];

    // Add cluster scores
    if (clusterScores && clusterScores.length > 0) {
      clusterScores.forEach((c: any) => {
        rows.push([`${c.title || c.subject} Avg`, c.score !== null ? `${c.score}%` : "N/A"]);
      });
    }

    // Add section scores
    if (sectionScores && sectionScores.length > 0) {
      sectionScores.forEach((s: any) => {
        rows.push([`Section ${s.sectionName || s.subject} Avg`, s.score !== null ? `${s.score}%` : "N/A"]);
      });
    }

    // Add raw comments
    if (commentsList && commentsList.length > 0) {
      commentsList.forEach((c: string, index: number) => {
        rows.push([`Comment ${index + 1}`, c]);
      });
    }

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(row => row.map(val => `"${(val || '').toString().replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `faculty_report_${professor.name.toLowerCase().replace(/\s+/g, '_')}_${academicYear}_${semester}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully!");
  } catch (err) {
    toast.error("Failed to export CSV.");
  }
}

interface ExportPDFProps {
  professor: {
    id: string;
    name: string;
  };
  academicYear: string;
  semester: string;
}

export async function exportFacultyPDF({
  professor,
  academicYear,
  semester,
}: ExportPDFProps) {
  const toastId = toast.loading("Generating vector PDF report...");
  try {
    const query = new URLSearchParams({
      academicYear,
      semester,
    }).toString();
    
    // Redirect browser to trigger headless-Chrome PDF download API endpoint
    window.location.href = `/api/faculty/${professor.id}/pdf?${query}`;
    
    toast.success("PDF export started!", undefined, { id: toastId });
  } catch (err) {
    console.error(err);
    toast.error("Failed to export PDF.", undefined, { id: toastId });
  }
}
