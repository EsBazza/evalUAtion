import { jsPDF } from 'jspdf';

/**
 * Loads an image path (like '/bg.jpg'), renders it onto an off-screen canvas with
 * a specific alpha opacity, and returns the faded base64 PNG data URL.
 */
export function getFadedImageDataUrl(src: string, opacity: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve(''); // Return empty string if running during SSR
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.globalAlpha = opacity;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Canvas context could not be created'));
      }
    };
    img.onerror = () => {
      // Resolve with empty string rather than crashing if asset is missing
      console.warn(`Failed to load asset at ${src}`);
      resolve('');
    };
    img.src = src;
  });
}

interface DrawBrandedLayoutOptions {
  doc: jsPDF;
  watermarkDataUrl?: string;
  logoDataUrl?: string;
  title: string;
  currentPage: number;
  totalPages: number;
  generatedDate: string;
}

/**
 * Draws the official UA branded page layout containing the watermark background,
 * navy blue header, gold border accents, logo, title, and page footers.
 */
export function drawBrandedLayout({
  doc,
  watermarkDataUrl,
  logoDataUrl,
  title,
  currentPage,
  totalPages,
  generatedDate,
}: DrawBrandedLayoutOptions) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Draw Watermark Background (centered, faded)
  if (watermarkDataUrl) {
    const watermarkSize = Math.min(pageWidth, pageHeight) * 0.65;
    const x = (pageWidth - watermarkSize) / 2;
    const y = (pageHeight - watermarkSize) / 2;
    doc.addImage(watermarkDataUrl, 'PNG', x, y, watermarkSize, watermarkSize);
  }

  // 2. Draw Navy Blue Header Band
  doc.setFillColor(11, 47, 100); // #0B2F64 (Navy)
  doc.rect(0, 0, pageWidth, 30, 'F');

  // 3. Draw Gold Accent Stripe
  doc.setFillColor(212, 175, 55); // #D4AF37 (Gold)
  doc.rect(0, 30, pageWidth, 2, 'F');

  // 4. Draw Logo (if provided)
  let logoOffset = 14;
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 14, 6, 18, 18);
    logoOffset = 36; // Shift title text to right
  }

  // 5. Draw Header Title Texts (Double-decked header matching new standard)
  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('UNIVERSITY OF THE', logoOffset, 11);

  doc.setFontSize(13);
  doc.setTextColor(212, 175, 55); // Gold
  doc.text('ASSUMPTION', logoOffset, 17);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255); // White subtitle
  doc.text(title.toUpperCase(), logoOffset, 24);

  // 6. Draw Footer Line (Gold)
  doc.setFillColor(212, 175, 55);
  doc.rect(14, pageHeight - 15, pageWidth - 28, 0.5, 'F');

  // 7. Draw Footer Texts
  doc.setTextColor(110, 110, 110);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Generated on: ${generatedDate}`, 14, pageHeight - 10);
  doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
}
