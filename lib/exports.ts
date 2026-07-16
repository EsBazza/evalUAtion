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
    name: string;
  };
  academicYear: string;
  semester: string;
  elementId: string;
}

export async function exportFacultyPDF({
  professor,
  academicYear,
  semester,
  elementId,
}: ExportPDFProps) {
  const toastId = toast.loading("Generating PDF report...");
  try {
    const container = document.getElementById(elementId);
    if (!container) {
      toast.error("Target container not found.", undefined, { id: toastId });
      return;
    }

    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');
    const { getFadedImageDataUrl, drawBrandedLayout } = await import('./pdfUtils');

    // 1. Pre-process branding images
    const [watermarkUrl, logoUrl] = await Promise.all([
      getFadedImageDataUrl('/bg.jpg', 0.08),
      getFadedImageDataUrl('/ua-logo.png', 1.0)
    ]);

    // 2. Flatten page elements card by card to prevent cutoffs
    const elementsToCapture: HTMLElement[] = [];
    for (const child of Array.from(container.children)) {
      const htmlChild = child as HTMLElement;
      // If it contains the graphs layout rows, flatten them to individual charts/sections
      if (htmlChild.classList.contains('space-y-6') && htmlChild.querySelector('.grid')) {
        for (const subChild of Array.from(htmlChild.children)) {
          elementsToCapture.push(subChild as HTMLElement);
        }
      } else {
        elementsToCapture.push(htmlChild);
      }
    }

    // 3. Render elements to canvas screenshots
    const canvases = await Promise.all(
      elementsToCapture.map(el =>
        html2canvas(el, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        })
      )
    );

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    const generatedDate = new Date().toLocaleString();
    const title = `Faculty Evaluation Report - ${professor.name}`;

    // 4. Calculate layout packing (dry run)
    interface LayoutItem {
      canvas: HTMLCanvasElement;
      width: number;
      height: number;
    }

    const items: LayoutItem[] = canvases.map(canvas => {
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      return { canvas, width: imgWidth, height: imgHeight };
    });

    const pages: LayoutItem[][] = [[]];
    let currentY = 32; // position below header band
    const maxPageHeight = pageHeight - 20; // page margin buffer

    items.forEach(item => {
      if (currentY + item.height > maxPageHeight && pages[pages.length - 1].length > 0) {
        pages.push([item]);
        currentY = 32 + item.height;
      } else {
        pages[pages.length - 1].push(item);
        currentY += item.height + 4; // 4mm spacing
      }
    });

    const totalPages = pages.length;

    // 5. Draw PDF pages
    pages.forEach((pageItems, pageIdx) => {
      if (pageIdx > 0) {
        pdf.addPage();
      }

      drawBrandedLayout({
        doc: pdf,
        watermarkDataUrl: watermarkUrl || undefined,
        logoDataUrl: logoUrl || undefined,
        title,
        currentPage: pageIdx + 1,
        totalPages,
        generatedDate,
      });

      let itemY = 32;
      pageItems.forEach(item => {
        const imgData = item.canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', margin, itemY, item.width, item.height);
        itemY += item.height + 4; // 4mm spacing
      });
    });

    pdf.save(`faculty_report_${professor.name.toLowerCase().replace(/\s+/g, '_')}_${academicYear}_${semester}.pdf`);
    toast.success("PDF exported successfully!", undefined, { id: toastId });
  } catch (err) {
    console.error(err);
    toast.error("Failed to generate PDF.", undefined, { id: toastId });
  }
}
