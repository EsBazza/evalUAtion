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
      <div style="background-color: #ffffff; height: 62px; display: flex; align-items: center; width: 100; padding: 0 24px;">
        <!-- LEFT: Report Type -->
        <div style="flex: 0 0 100px;">
          <span style="font-weight: 800; font-size: 7px; letter-spacing: 0.5px; color: #000000; text-transform: uppercase; line-height: 1.3;">Faculty Evaluation<br/>Report</span>
        </div>
        <!-- CENTER: Logo + University Name stacked -->
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          ${logoBase64 ? `<img src="${logoBase64}" style="height: 36px; width: 36px; object-fit: contain; border-radius: 50;" />` : ''}
          <span style="font-weight: 800; font-size: 10px; letter-spacing: 1.5px; color: #F4B400; text-transform: uppercase; margin-top: 2px;">UNIVERSITY OF THE ASSUMPTION</span>
          <span style="font-weight: 500; font-size: 6px; letter-spacing: 0.8px; color: #64748B; margin-top: 1px;">San Fernando, Pampanga</span>
        </div>
        <!-- RIGHT: Empty for balance -->
        <div style="flex: 0 0 100px;"></div>
      </div>
      <div style="background-color: #F4B400; height: 3px; width: 100%;"></div>
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
