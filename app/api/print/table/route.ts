import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
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
  const reportLabel = type === 'ratings' ? 'Ratings Ledger<br/>Report' : type === 'attendance' ? 'Attendance Logs<br/>Report' : 'System Audit<br/>Report';
  const headerTemplate = `
    <div style="font-size: 8px; width: 100%; font-family: 'Inter', sans-serif; box-sizing: border-box; display: flex; flex-direction: column;">
      <div style="background-color: #ffffff; height: 62px; display: flex; align-items: center; width: 100%; padding: 0 24px;">
        <!-- LEFT: Report Type -->
        <div style="flex: 0 0 100px;">
          <span style="font-weight: 800; font-size: 7px; letter-spacing: 0.5px; color: #000000; text-transform: uppercase; line-height: 1.3;">${reportLabel}</span>
        </div>
        <!-- CENTER: Logo + University Name stacked -->
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          ${logoBase64 ? `<img src="${logoBase64}" style="height: 36px; width: 36px; object-fit: contain; border-radius: 50%;" />` : ''}
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
    // 3. Launch headless chromium (serverless-compatible via @sparticuz/chromium)
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
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
