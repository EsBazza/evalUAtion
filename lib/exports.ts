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

function cleanColorString(val: string): string {
  if (typeof val !== 'string') return val;
  // Handle oklch(L C H) or oklch(L C H / alpha)
  const oklchMatch = val.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.%]+))?\)/);
  if (oklchMatch) {
    const l = parseFloat(oklchMatch[1]);
    const c = parseFloat(oklchMatch[2]);
    const h = parseFloat(oklchMatch[3]);
    const a = oklchMatch[4] ? oklchMatch[4] : '1';
    
    const saturation = Math.min(100, Math.round(c * 250));
    const lightness = Math.round(l * 100);
    const hue = Math.round(h);
    
    return `hsla(${hue}, ${saturation}%, ${lightness}%, ${a})`;
  }
  
  // Handle oklab(L a b)
  const oklabMatch = val.match(/oklab\(([\d.]+)\s+([-\d.]+)\s+([-\d.]+)(?:\s*\/\s*([\d.%]+))?\)/);
  if (oklabMatch) {
    const l = parseFloat(oklabMatch[1]);
    const aVal = parseFloat(oklabMatch[2]);
    const bVal = parseFloat(oklabMatch[3]);
    const alpha = oklabMatch[4] ? oklabMatch[4] : '1';
    
    const c = Math.sqrt(aVal * aVal + bVal * bVal);
    let h = Math.atan2(bVal, aVal) * 180 / Math.PI;
    if (h < 0) h += 360;
    
    const saturation = Math.min(100, Math.round(c * 250));
    const lightness = Math.round(l * 100);
    const hue = Math.round(h);
    
    return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
  }

  return val;
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
          backgroundColor: '#ffffff',
          onclone: (clonedDoc) => {
            const clonedWindow = clonedDoc.defaultView;
            if (clonedWindow) {
              const originalGetComputedStyle = clonedWindow.getComputedStyle;
              clonedWindow.getComputedStyle = function (elt, pseudoElt) {
                const style = originalGetComputedStyle.call(this, elt, pseudoElt);
                return new Proxy(style, {
                  get(target, prop) {
                    const value = target[prop as any];
                    if (typeof value === 'function') {
                      return function (...args: any[]) {
                        const res = (value as any).apply(target, args);
                        if (typeof res === 'string') {
                          return cleanColorString(res);
                        }
                        return res;
                      };
                    }
                    if (typeof value === 'string') {
                      return cleanColorString(value);
                    }
                    return value;
                  }
                });
              };
            }

            // 1. Inline all link stylesheets as cleaned style tags and remove link elements
            const linkSheets = Array.from(clonedDoc.querySelectorAll('link[rel="stylesheet"]'));
            linkSheets.forEach(link => {
              try {
                const sheet = (link as any).sheet as CSSStyleSheet;
                if (sheet && sheet.cssRules) {
                  let cssText = '';
                  for (let i = 0; i < sheet.cssRules.length; i++) {
                    cssText += sheet.cssRules[i].cssText + '\n';
                  }
                  
                  const cleanedCssText = cssText
                    .replace(/oklch\([^)]+\)/g, 'rgb(0,0,0)')
                    .replace(/oklab\([^)]+\)/g, 'rgb(0,0,0)');

                  const styleEl = clonedDoc.createElement('style');
                  styleEl.innerHTML = cleanedCssText;
                  clonedDoc.head.appendChild(styleEl);

                  // Remove the link element so html2canvas doesn't try to fetch it
                  link.parentNode?.removeChild(link);
                }
              } catch (e) {
                // Ignore CORS restriction warnings
              }
            });

            // 2. Clean up existing style elements
            const styleElements = Array.from(clonedDoc.querySelectorAll('style'));
            styleElements.forEach(style => {
              try {
                if (style.innerHTML) {
                  style.innerHTML = style.innerHTML
                    .replace(/oklch\([^)]+\)/g, 'rgb(0,0,0)')
                    .replace(/oklab\([^)]+\)/g, 'rgb(0,0,0)');
                }
              } catch (e) {
                console.error('Failed to clean style tag innerHTML', e);
              }
            });

            // 3. Clean up inline styles on elements
            const allElements = Array.from(clonedDoc.getElementsByTagName('*'));
            allElements.forEach(el => {
              const htmlEl = el as HTMLElement;
              if (htmlEl.style && htmlEl.style.cssText) {
                if (htmlEl.style.cssText.includes('oklch') || htmlEl.style.cssText.includes('oklab')) {
                  htmlEl.style.cssText = htmlEl.style.cssText
                    .replace(/oklch\([^)]+\)/g, 'rgb(0,0,0)')
                    .replace(/oklab\([^)]+\)/g, 'rgb(0,0,0)');
                }
              }
            });
          }
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
