import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Browser } from 'puppeteer';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get('type') || '';
  if (!type || !['ratings', 'attendance', 'audit'].includes(type)) {
    return NextResponse.json({ error: 'Invalid print type.' }, { status: 400 });
  }

  // 1. Prepare absolute path to public/ua-logo.png for base64 inlining in header template
  const logoPath = path.join(process.cwd(), 'public', 'ua-logo.png');
  const logoBase64 = fs.existsSync(logoPath)
    ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
    : '';

  // 2. Define standard header template (matching University of the Assumption styling)
  const headerTemplate = `
    <div style="font-size: 8px; width: 100%; font-family: 'Inter', sans-serif; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <div style="background-color: #0B2265; height: 68px; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; color: white; gap: 4px;">
        ${logoBase64 ? `<img src="${logoBase64}" style="height: 42px; width: 42px; object-fit: contain; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.4); background-color: #ffffff; padding: 1.5px;" />` : ''}
        <div style="display: flex; flex-direction: column; align-items: center; line-height: 1.1;">
          <div style="display: flex; align-items: center; gap: 5px;">
            <span style="font-weight: 700; font-size: 7.5px; letter-spacing: 1.2px; color: #F4B400;">UNIVERSITY OF THE</span>
            <span style="font-weight: 800; font-size: 11px; letter-spacing: 0.8px; color: #F4B400;">ASSUMPTION</span>
          </div>
          <span style="font-size: 6.5px; font-weight: 700; color: rgba(255,255,255,0.7); letter-spacing: 0.6px; text-transform: uppercase; margin-top: 1px;">
            ${type === 'ratings' ? 'RATINGS LEDGER REPORT' : type === 'attendance' ? 'ATTENDANCE LOGS REPORT' : 'SYSTEM AUDIT REPORT'}
          </span>
        </div>
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

    // 4. Inherit session cookies
    const cookies = req.cookies.getAll();
    for (const cookie of cookies) {
      await page.setCookie({
        name: cookie.name,
        value: cookie.value,
        domain: req.nextUrl.hostname,
        path: '/',
      });
    }

    // 5. Navigate to the Print Table page
    const queryParams = searchParams.toString();
    const printUrl = `${req.nextUrl.origin}/print/table?${queryParams}`;
    await page.goto(printUrl, { waitUntil: 'networkidle0' });

    // 6. Generate vector PDF
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

    // 7. Stream file download
    const filename = `${type}_ledger_${new Date().toISOString().slice(0, 10)}.pdf`;
    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error('Puppeteer PDF table export error:', err);
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
