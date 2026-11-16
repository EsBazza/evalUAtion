import puppeteer, { type Browser } from 'puppeteer-core';

/**
 * Launches headless Chromium for PDF export.
 * - PUPPETEER_EXECUTABLE_PATH (if set) always wins.
 * - Linux (the production Ubuntu server): @sparticuz/chromium's bundled build.
 * - Windows/macOS dev machines: the Chrome that the full `puppeteer` package downloaded,
 *   because @sparticuz/chromium only ships a Linux binary.
 */
export async function launchBrowser(): Promise<Browser> {
  const override = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();

  if (override) {
    return puppeteer.launch({ executablePath: override, headless: true });
  }

  if (process.platform === 'linux') {
    const chromium = (await import('@sparticuz/chromium')).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const fullPuppeteer = (await import('puppeteer')).default;
  return puppeteer.launch({ executablePath: await fullPuppeteer.executablePath(), headless: true });
}

/** The app's own origin for the headless browser to load print pages from. */
export function appOrigin(requestOrigin: string): string {
  // Prefer the configured public URL over the request's Host header
  return new URL(process.env.AUTH_URL || requestOrigin).origin;
}
