import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Browser } from 'puppeteer';
import fs from 'fs';
import path from 'path';

interface RouteParams {
  params: Promise<{ professorId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { professorId } = await params;
  const { searchParams } = req.nextUrl;

  const academicYear = searchParams.get('academicYear') || '';
  const semester = searchParams.get('semester') || '';
  const subjectId = searchParams.get('subjectId') || 'all';

  // 1. Prepare absolute path to public/ua-logo.png for base64 inlining in header template
  const logoPath = path.join(process.cwd(), 'public', 'ua-logo.png');
  const logoBase64 = fs.existsSync(logoPath)
    ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
    : '';

  // 2. Define branding templates
  const headerTemplate = `
    <div style="font-size: 8px; width: 100%; font-family: 'Inter', sans-serif; box-sizing: border-box; display: flex; flex-direction: column;">
      <div style="background-color: #0B2F64; height: 48px; display: flex; align-items: center; justify-content: space-between; padding: 0 18px; color: white;">
        <div style="display: flex; align-items: center; gap: 10px;">
          ${logoBase64 ? `<img src="${logoBase64}" style="height: 32px; width: 32px; object-fit: contain; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.3); background-color: #ffffff; padding: 1.5px;" />` : ''}
          <div style="display: flex; flex-direction: column; justify-content: center; line-height: 1.1;">
            <span style="font-weight: 600; font-size: 8px; letter-spacing: 1.2px; color: rgba(255, 255, 255, 0.75);">UNIVERSITY OF THE</span>
            <span style="font-weight: 800; font-size: 15px; letter-spacing: 0.8px; color: #D4AF37;">ASSUMPTION</span>
          </div>
        </div>
        <span style="font-size: 8.5px; font-weight: 800; color: #ffffff; letter-spacing: 0.6px; border-left: 1.5px solid rgba(255, 255, 255, 0.2); padding-left: 12px; height: 22px; display: flex; align-items: center;">FACULTY EVALUATION REPORT</span>
      </div>
      <div style="background-color: #D4AF37; height: 3px; width: 100%;"></div>
    </div>
  `;

  const footerTemplate = `
    <div style="font-size: 7px; width: 100%; font-family: 'Inter', sans-serif; box-sizing: border-box; display: flex; flex-direction: column; color: #64748B; padding: 0 15px; margin-bottom: -5px;">
      <div style="background-color: #E2E8F0; height: 1px; width: 100%; margin-bottom: 4px;"></div>
      <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 600;">
        <span>Generated: <span class="date" style="font-weight: 700;"></span></span>
        <span>Page <span class="pageNumber" style="font-weight: 700;"></span> of <span class="totalPages" style="font-weight: 700;"></span></span>
      </div>
    </div>
  `;

  let browser: Browser | null = null;
  try {
    // 3. Launch headless chromium
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // 4. Inherit active user session cookies so Puppeteer can load the secure print-only page
    const cookies = req.cookies.getAll();
    for (const cookie of cookies) {
      await page.setCookie({
        name: cookie.name,
        value: cookie.value,
        domain: req.nextUrl.hostname,
        path: '/',
      });
    }

    // 5. Navigate to the dedicated print page and wait for the network to become idle (Recharts SVGs rendered)
    const printUrl = `${req.nextUrl.origin}/print/faculty-report/${professorId}?academicYear=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(semester)}&subjectId=${encodeURIComponent(subjectId)}`;
    await page.goto(printUrl, { waitUntil: 'networkidle0' });

    // 6. Generate the vector PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      margin: {
        top: '24mm',
        bottom: '20mm',
        left: '15mm',
        right: '15mm',
      },
    });

    // 7. Stream PDF back to user
    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="faculty_report_${professorId}_${academicYear.replace(/\s+/g, '_')}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error('Puppeteer PDF export error:', err);
    return NextResponse.json(
      { error: 'Failed to generate PDF report.', details: err.message },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
