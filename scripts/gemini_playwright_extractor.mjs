import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

/**
 * Gemini Playwright Extractor
 * 
 * This script automates the extraction of prompt text and image URLs from Gemini "My Stuff" page.
 * It uses Playwright to navigate, wait for elements, and handle the asynchronous nature of Gemini.
 * 
 * Usage:
 * 1. Open Chrome with a remote debugging port:
 *    /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="$HOME/Library/Application Support/Google/Chrome_Gemini_Export"
 * 2. Log in to Gemini if not already.
 * 3. Run: node scripts/gemini_playwright_extractor.mjs
 */

const REMOTE_DEBUGGING_PORT = 9222;
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'gemini_export.json');
const TEST_ONE_ONLY = false; // Set to false to export everything

const MY_STUFF_URL = 'https://gemini.google.com/mystuff';
const SESSION_READY_SELECTOR =
  '.user-query-bubble-with-background, .query-text, user-query, .query-content';

const VERBOSE = process.env.GEMINI_VERBOSE === '1' || process.env.GEMINI_VERBOSE === 'true';
const QUIET =
  process.env.GEMINI_QUIET === '1' ||
  process.env.GEMINI_QUIET === 'true' ||
  // Default to quiet for extraction runs unless explicitly verbose
  (!VERBOSE && ((process.env.GEMINI_MODE || 'extract').toLowerCase() === 'extract'));
const BYPASS_POINTER_EVENTS =
  process.env.GEMINI_BYPASS_POINTER_EVENTS === undefined ||
  process.env.GEMINI_BYPASS_POINTER_EVENTS === '1' ||
  process.env.GEMINI_BYPASS_POINTER_EVENTS === 'true';
const CLICK_TIMEOUT_MS = Number.parseInt(process.env.GEMINI_CLICK_TIMEOUT_MS || '3000', 10);
const OPEN_DETECT_TIMEOUT_MS = Number.parseInt(process.env.GEMINI_OPEN_DETECT_TIMEOUT_MS || '3000', 10);
const POPUP_TIMEOUT_MS = Number.parseInt(process.env.GEMINI_POPUP_TIMEOUT_MS || '1500', 10);
const RETRY_PAUSE_MS = Number.parseInt(process.env.GEMINI_RETRY_PAUSE_MS || '300', 10);
const ENABLE_TRIAL_CLICK = process.env.GEMINI_ENABLE_TRIAL_CLICK === '1' || process.env.GEMINI_ENABLE_TRIAL_CLICK === 'true';
const USE_JS_CLICK =
  process.env.GEMINI_USE_JS_CLICK === undefined ||
  process.env.GEMINI_USE_JS_CLICK === '1' ||
  process.env.GEMINI_USE_JS_CLICK === 'true';
const MODE = (process.env.GEMINI_MODE || 'extract').toLowerCase(); // 'scan' | 'click' | 'simulate' | 'extract'
const SCAN_HIGHLIGHT = process.env.GEMINI_SCAN_HIGHLIGHT === undefined || process.env.GEMINI_SCAN_HIGHLIGHT === '1' || process.env.GEMINI_SCAN_HIGHLIGHT === 'true';
// How many items to render in the scan table / highlight (viewport-only). Not a discovery cap.
const SCAN_LIMIT = Number.parseInt(process.env.GEMINI_SCAN_LIMIT || '60', 10);
// How many unique cards to discover while scrolling. 0 = unlimited (recommended).
const SCAN_DISCOVERY_LIMIT = Number.parseInt(process.env.GEMINI_SCAN_DISCOVERY_LIMIT || '0', 10);
const SCAN_SCREENSHOT = process.env.GEMINI_SCAN_SCREENSHOT === '1' || process.env.GEMINI_SCAN_SCREENSHOT === 'true';
const SCAN_AUTO_CLOSE =
  process.env.GEMINI_SCAN_AUTO_CLOSE === '1' || process.env.GEMINI_SCAN_AUTO_CLOSE === 'true';
const SCAN_BEFORE_EXTRACT =
  process.env.GEMINI_SCAN_BEFORE_EXTRACT === undefined ||
  process.env.GEMINI_SCAN_BEFORE_EXTRACT === '1' ||
  process.env.GEMINI_SCAN_BEFORE_EXTRACT === 'true';
const SCAN_TO_EXTRACT_PAUSE_MS = Number.parseInt(process.env.GEMINI_SCAN_TO_EXTRACT_PAUSE_MS || '800', 10);
const EXTRACT_LIMIT = Number.parseInt(process.env.GEMINI_EXTRACT_LIMIT || '0', 10); // 0 = no limit
const EXTRACT_ONLY_HYDRATED =
  process.env.GEMINI_EXTRACT_ONLY_HYDRATED === undefined ||
  process.env.GEMINI_EXTRACT_ONLY_HYDRATED === '1' ||
  process.env.GEMINI_EXTRACT_ONLY_HYDRATED === 'true';
const CLICK_ONLY_LIMIT = Number.parseInt(process.env.GEMINI_CLICK_ONLY_LIMIT || String(EXTRACT_LIMIT || 2), 10);
const SCAN_SCROLL_ALL =
  process.env.GEMINI_SCAN_SCROLL_ALL === undefined ||
  process.env.GEMINI_SCAN_SCROLL_ALL === '1' ||
  process.env.GEMINI_SCAN_SCROLL_ALL === 'true';
const SCAN_SCROLL_PAUSE_MS = Number.parseInt(process.env.GEMINI_SCAN_SCROLL_PAUSE_MS || '450', 10);
const SCAN_MAX_SCROLL_STEPS = Number.parseInt(process.env.GEMINI_SCAN_MAX_SCROLL_STEPS || '250', 10);
const SCAN_IDLE_ROUNDS = Number.parseInt(process.env.GEMINI_SCAN_IDLE_ROUNDS || '6', 10);

const EXTRACT_SCROLL_ALL =
  process.env.GEMINI_EXTRACT_SCROLL_ALL === undefined ||
  process.env.GEMINI_EXTRACT_SCROLL_ALL === '1' ||
  process.env.GEMINI_EXTRACT_SCROLL_ALL === 'true';
const EXTRACT_SCROLL_PAUSE_MS = Number.parseInt(process.env.GEMINI_EXTRACT_SCROLL_PAUSE_MS || '500', 10);
const EXTRACT_MAX_SCROLL_STEPS = Number.parseInt(process.env.GEMINI_EXTRACT_MAX_SCROLL_STEPS || '400', 10);
const EXTRACT_IDLE_ROUNDS = Number.parseInt(process.env.GEMINI_EXTRACT_IDLE_ROUNDS || '8', 10);
// Batch-by-row extraction: click the first visible row items 1..N, then scroll by ~one row height and repeat.
const EXTRACT_ROW_BATCH_SIZE = Number.parseInt(process.env.GEMINI_EXTRACT_ROW_BATCH_SIZE || '5', 10);
// 'down' means scrollTop += rowHeight (content moves up, you go deeper into the list).
// If your list behaves opposite, set GEMINI_EXTRACT_ROW_SCROLL_DIRECTION=up.
const EXTRACT_ROW_SCROLL_DIRECTION = String(process.env.GEMINI_EXTRACT_ROW_SCROLL_DIRECTION || 'down').toLowerCase();
// Dry-run simulation (no clicks, no extraction): highlight the selected targets and scroll row-by-row.
const SIMULATE_STEP_PAUSE_MS = Number.parseInt(process.env.GEMINI_SIMULATE_STEP_PAUSE_MS || '900', 10);
const SIMULATE_AFTER_BATCH_PAUSE_MS = Number.parseInt(process.env.GEMINI_SIMULATE_AFTER_BATCH_PAUSE_MS || '500', 10);
const SIMULATE_PROCESSED_PAUSE_MS = Number.parseInt(process.env.GEMINI_SIMULATE_PROCESSED_PAUSE_MS || '120', 10);
const SIMULATE_AUTO_CLOSE =
  process.env.GEMINI_SIMULATE_AUTO_CLOSE === '1' || process.env.GEMINI_SIMULATE_AUTO_CLOSE === 'true';
const DEBUG_DIR = process.env.GEMINI_DEBUG_DIR
  ? path.resolve(process.env.GEMINI_DEBUG_DIR)
  : path.join(process.cwd(), 'data', 'gemini_debug');

function logV(...args) {
  if (VERBOSE) console.log(...args);
}

function logI(...args) {
  if (!QUIET) console.log(...args);
}

function safeFilePart(input) {
  return String(input || '')
    .replace(/[^\w\-\.]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function setPointerEventsBypassCSS(page, enabled) {
  if (!BYPASS_POINTER_EVENTS) return;
  await page.evaluate((on) => {
    const ID = '__pw_click_bypass_css__';
    const existing = document.getElementById(ID);
    if (!on) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    const style = document.createElement('style');
    style.id = ID;
    style.textContent = `
      /*
        IMPORTANT:
        Do NOT use overly-broad selectors like "X * { pointer-events:none }" here.
        Some of these components (e.g. "bard-sidenav-container") can be ancestors of the card grid,
        and disabling pointer events on all descendants would make the cards unclickable.
        We only disable pointer events on the known overlay/interceptor elements themselves.
      */
      infinite-scroller.disable-scroll,
      div.overflow-container,
      div.sidenav-with-history-container,
      side-navigation-content,
      bard-sidenav,
      bard-sidenav-container {
        pointer-events: none !important;
      }
    `;
    document.documentElement.appendChild(style);
  }, enabled).catch(() => null);
}

async function getClickPoint(card, mode = 'center') {
  const box = await card.boundingBox().catch(() => null);
  if (!box) return null;
  const x = Math.max(0, box.x + box.width / 2);
  const y = Math.max(0, box.y + (mode === 'center' ? box.height / 2 : Math.min(24, box.height / 2)));
  return { x, y, box };
}

async function jsClick(locator) {
  try {
    const handle = await locator.elementHandle({ timeout: CLICK_TIMEOUT_MS }).catch(() => null);
    if (!handle) return false;
    await handle.evaluate((el) => {
      // Trigger both HTMLElement.click() and a real MouseEvent for frameworks listening on either.
      // This bypasses Playwright's hit-testing (useful when overlays intercept pointer events).
      if (typeof el.click === 'function') el.click();
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    });
    return true;
  } catch {
    return false;
  }
}

function briefEl(el) {
  if (!el) return null;
  const tag = el.tagName?.toLowerCase?.() ?? 'unknown';
  const id = el.id ? `#${el.id}` : '';
  const cls =
    typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 4).join('.')}`
      : '';
  const role = el.getAttribute?.('role');
  const aria = el.getAttribute?.('aria-label');
  return {
    tag: `${tag}${id}${cls}`,
    role: role || undefined,
    ariaLabel: aria || undefined,
  };
}

async function debugClickSurface(page, card, label) {
  try {
    const pt = await getClickPoint(card, 'center');
    if (!pt) {
      console.warn(`🧭 [debug] No bounding box for card (${label})`);
      return;
    }
    const { x, y } = pt;

    // NOTE: functions from Node scope aren't available in page.evaluate; inline a helper.
    const surface = await page.evaluate(({ x, y }) => {
      function briefElInPage(el) {
        if (!el) return null;
        const tag = el.tagName?.toLowerCase?.() ?? 'unknown';
        const id = el.id ? `#${el.id}` : '';
        const cls =
          typeof el.className === 'string' && el.className.trim()
            ? `.${el.className.trim().split(/\s+/).slice(0, 4).join('.')}`
            : '';
        const role = el.getAttribute?.('role');
        const aria = el.getAttribute?.('aria-label');
        return {
          tag: `${tag}${id}${cls}`,
          role: role || undefined,
          ariaLabel: aria || undefined,
        };
      }
      const els = document.elementsFromPoint(x, y).slice(0, 6);
      return els.map(briefElInPage);
    }, { x, y });

    console.warn(`🧭 [debug] Click point (${Math.round(x)},${Math.round(y)}) top elements:`, surface);
  } catch (e) {
    console.warn(`🧭 [debug] Failed to inspect click surface (${label}):`, e?.message || e);
  }
}

async function writeDebugBundle({ page, prefix, note, extra }) {
  try {
    ensureDir(DEBUG_DIR);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = `${prefix}_${stamp}`;
    const pngPath = path.join(DEBUG_DIR, `${base}.png`);
    const htmlPath = path.join(DEBUG_DIR, `${base}.html`);
    const jsonPath = path.join(DEBUG_DIR, `${base}.json`);

    const url = (() => {
      try {
        return page.url();
      } catch {
        return '';
      }
    })();

    // Screenshot is the most useful artifact for overlays/intercepts.
    await page.screenshot({ path: pngPath, fullPage: true }).catch(() => null);
    const html = await page.content().catch(() => '');
    fs.writeFileSync(htmlPath, html || '', 'utf8');

    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          url,
          note,
          extra,
        },
        null,
        2
      ),
      'utf8'
    );

    console.warn(`🧾 [debug] Wrote debug bundle:\n- ${jsonPath}\n- ${pngPath}\n- ${htmlPath}`);
  } catch (e) {
    console.warn('🧾 [debug] Failed writing debug bundle:', e?.message || e);
  }
}

async function temporarilyDisableScrollerPointerEvents(page) {
  // Gemini list is inside an infinite scroller that sometimes toggles a blocking overlay
  // (`disable-scroll`) during transitions; that overlay can intercept clicks.
  await setPointerEventsBypassCSS(page, true);
  await page.evaluate(() => {
    const nodes = [
      ...Array.from(document.querySelectorAll('infinite-scroller.disable-scroll')),
      // Observed in the wild: this container can sit above cards and intercept clicks.
      ...Array.from(document.querySelectorAll('div.overflow-container[data-test-id="overflow-container"]')),
      ...Array.from(document.querySelectorAll('div.overflow-container')),
      // Observed in the wild: left nav container can overlap list and intercept clicks
      // (e.g. class contains `sidenav-with-history-container ... side-nav-mystuff-update`).
      ...Array.from(document.querySelectorAll('div.sidenav-with-history-container')),
      // Observed in the wild: this custom element can overlay content and intercept clicks.
      ...Array.from(document.querySelectorAll('side-navigation-content')),
      // Observed in the wild: the nav itself can intercept clicks.
      ...Array.from(document.querySelectorAll('bard-sidenav')),
      ...Array.from(document.querySelectorAll('bard-sidenav-container')),
    ];
    for (const n of nodes) {
      // preserve prior inline style so it can be restored if needed later
      if (!n.dataset._pwPrevPe) n.dataset._pwPrevPe = n.style.pointerEvents || '';
      n.style.pointerEvents = 'none';
    }
  }).catch(() => null);
}

async function restoreScrollerPointerEvents(page) {
  await page.evaluate(() => {
    const nodes = [
      ...Array.from(document.querySelectorAll('infinite-scroller')),
      ...Array.from(document.querySelectorAll('div.overflow-container')),
      ...Array.from(document.querySelectorAll('div.sidenav-with-history-container')),
      ...Array.from(document.querySelectorAll('side-navigation-content')),
      ...Array.from(document.querySelectorAll('bard-sidenav')),
      ...Array.from(document.querySelectorAll('bard-sidenav-container')),
    ];
    for (const n of nodes) {
      if (n.dataset && Object.prototype.hasOwnProperty.call(n.dataset, '_pwPrevPe')) {
        n.style.pointerEvents = n.dataset._pwPrevPe || '';
        delete n.dataset._pwPrevPe;
      }
    }
  }).catch(() => null);
  await setPointerEventsBypassCSS(page, false);
}

async function resolveSessionUrlFromCard(page, card) {
  // Best case: the card contains an actual link we can open in a new tab without clicking.
  const href =
    (await card.locator('a[href*="/app/"]').first().getAttribute('href', { timeout: CLICK_TIMEOUT_MS }).catch(() => null)) ||
    (await card.locator('a[href]').first().getAttribute('href', { timeout: CLICK_TIMEOUT_MS }).catch(() => null));

  if (href && href.includes('/app/')) {
    try {
      return new URL(href, page.url()).toString();
    } catch {
      return href;
    }
  }

  // Sometimes Angular apps put router links on attributes; sniff a few common ones.
  const maybe = await card.evaluate((el) => {
    const attrs = ['href', 'routerlink', 'ng-reflect-router-link', 'data-href', 'data-url'];
    for (const a of attrs) {
      const v = el.getAttribute?.(a);
      if (v && typeof v === 'string' && v.includes('/app/')) return v;
    }
    return null;
  }).catch(() => null);

  if (maybe) {
    try {
      return new URL(maybe, page.url()).toString();
    } catch {
      return maybe;
    }
  }

  return null;
}

async function waitForCardList(page) {
  // IMPORTANT:
  // `div.library-item-card` is often the *inner* clickable element, whose container is a parent.
  // Scanning/clicking should prefer the outer custom element <library-item-card>.
  const cards = page.locator('library-item-card');
  await cards.first().waitFor({ state: 'visible', timeout: 30000 });
  return cards;
}

async function waitForHydratedCardContainers(page) {
  // The page may first render skeleton placeholders (`.placeholder`) before hydrating real cards.
  // Your DOM snippet shows this structure when hydrated:
  // <library-item-card> -> .library-item-card-container -> .library-item-card[role="button"][tabindex="0"]
  const container = page.locator('.library-item-card-container');
  const clickable = page.locator('.library-item-card-container .library-item-card[role="button"][tabindex="0"]');
  // If it never hydrates (slow network), we still proceed with host-based scan.
  await Promise.race([
    container.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => null),
    clickable.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => null),
  ]);
}

function clickableTargetLocator(card) {
  // IMPORTANT:
  // Gemini cards often have `pointer-events: none` on the wrapper/button container,
  // but the thumbnail <img> remains clickable. Console validation confirmed
  // `document.querySelector('.library-item-card-container img.thumbnail').click()` opens the card.
  // NOTE: Do NOT use a big selector group here: querySelector returns the first match in DOM order,
  // which often picks the container (parent) instead of the thumbnail. Keep it specific.
  return card.locator('.library-item-card-container img.thumbnail, img.thumbnail').first();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeLimit(n) {
  return Number.isFinite(n) && n > 0 ? n : Number.POSITIVE_INFINITY;
}

function xpathLiteral(value) {
  // Safely embed arbitrary string into an XPath literal.
  const s = String(value ?? '');
  if (!s.includes("'")) return `'${s}'`;
  if (!s.includes('"')) return `"${s}"`;
  // If it contains both quotes, use concat('a',"'",'b',...)
  const parts = s.split("'");
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) out.push(`'${parts[i]}'`);
    if (i !== parts.length - 1) out.push(`"'"`);
  }
  return `concat(${out.join(',')})`;
}

async function getListScrollMetrics(page) {
  return await page.evaluate(() => {
    const scroller =
      document.querySelector('infinite-scroller.item-list') ||
      document.querySelector('infinite-scroller') ||
      document.querySelector('.item-list-container') ||
      document.scrollingElement;
    if (!scroller) return null;
    return {
      tag: scroller.tagName.toLowerCase(),
      className: scroller.className || '',
      scrollTop: scroller.scrollTop || 0,
      scrollHeight: scroller.scrollHeight || 0,
      clientHeight: scroller.clientHeight || 0,
    };
  }).catch(() => null);
}

async function scrollListBy(page, delta) {
  return await page.evaluate((d) => {
    const scroller =
      document.querySelector('infinite-scroller.item-list') ||
      document.querySelector('infinite-scroller') ||
      document.querySelector('.item-list-container') ||
      document.scrollingElement;
    if (!scroller) return null;
    scroller.scrollTop = (scroller.scrollTop || 0) + d;
    return {
      scrollTop: scroller.scrollTop || 0,
      scrollHeight: scroller.scrollHeight || 0,
      clientHeight: scroller.clientHeight || 0,
    };
  }, delta).catch(() => null);
}

async function scrollListTo(page, top) {
  return await page.evaluate((t) => {
    const scroller =
      document.querySelector('infinite-scroller.item-list') ||
      document.querySelector('infinite-scroller') ||
      document.querySelector('.item-list-container') ||
      document.scrollingElement;
    if (!scroller) return null;
    scroller.scrollTop = t;
    return {
      scrollTop: scroller.scrollTop || 0,
      scrollHeight: scroller.scrollHeight || 0,
      clientHeight: scroller.clientHeight || 0,
    };
  }, top).catch(() => null);
}

async function getFirstRowTargets(page, { batchSize }) {
  // Returns the first (top-most) visible row items, ordered left->right, and an estimated row scroll delta.
  return await page.evaluate(({ batchSize }) => {
    function pickThumb(container) {
      const img = container.querySelector('img.thumbnail') || container.querySelector('img');
      const src = img?.getAttribute?.('src') || img?.src || '';
      return { img, src };
    }

    const containers = Array.from(document.querySelectorAll('.library-item-card-container'));
    const candidates = [];
    for (const c of containers) {
      const host = c.closest?.('library-item-card') || null;
      const r = c.getBoundingClientRect();
      if (!Number.isFinite(r.top) || !Number.isFinite(r.left)) continue;
      // Only consider elements that are actually in the viewport and have a thumbnail src.
      if (r.bottom <= 0 || r.top >= window.innerHeight) continue;
      const { src } = pickThumb(c);
      if (!src) continue;
      const title =
        host?.querySelector?.('.library-item-card[aria-label]')?.getAttribute?.('aria-label') ||
        host?.getAttribute?.('aria-label') ||
        c.getAttribute?.('aria-label') ||
        '';
      candidates.push({
        top: r.top,
        left: r.left,
        height: r.height,
        thumbSrc: src,
        title: title || '',
      });
    }

    // No hydrated containers yet
    if (candidates.length === 0) return { targets: [], rowDelta: 0 };

    // Find the top-most row baseline.
    // IMPORTANT: Gemini grid isn't always pixel-perfect; different cards can differ by a few px in top.
    // We'll use a dynamic tolerance derived from card heights + a fallback that always returns N targets.
    candidates.sort((a, b) => a.top - b.top || a.left - b.left);
    const baselineTop = candidates[0].top;

    const heights = candidates.map((c) => c.height).filter((h) => Number.isFinite(h) && h > 0).sort((a, b) => a - b);
    const medianH = heights.length ? heights[Math.floor(heights.length / 2)] : 0;
    const rowTol = Math.max(12, Math.min(44, Math.round(medianH * 0.35) || 18));

    let row1 = candidates.filter((c) => Math.abs(c.top - baselineTop) <= rowTol);
    row1.sort((a, b) => a.left - b.left);

    // Fallback: if grouping yields too few (e.g. masonry/uneven tops), take the first N in reading order.
    // This prevents the "only 1 card selected → scroll immediately" behavior.
    if (row1.length < Math.max(1, batchSize)) {
      const fallback = candidates.slice(0, Math.max(1, batchSize));
      fallback.sort((a, b) => a.top - b.top || a.left - b.left);
      row1 = fallback;
    }

    // Estimate row delta as the distance from the baseline row to the next row's top (beyond tolerance).
    let rowDelta = 0;
    const nextTop = candidates
      .map((c) => c.top)
      .filter((t) => Number.isFinite(t) && t > baselineTop + rowTol)
      .sort((a, b) => a - b)[0];
    if (Number.isFinite(nextTop)) {
      rowDelta = Math.max(0, Math.round(nextTop - baselineTop));
    } else {
      const h = row1[0]?.height || medianH || 0;
      // heuristic: one card height plus a small gap
      rowDelta = Math.max(0, Math.round(h ? h + 24 : 220));
    }

    return {
      targets: row1.slice(0, Math.max(0, batchSize)).map((c) => ({
        thumbSrc: c.thumbSrc,
        title: c.title,
        top: c.top,
        left: c.left,
      })),
      rowDelta,
    };
  }, { batchSize }).catch(() => ({ targets: [], rowDelta: 0 }));
}

async function highlightRowTargets(page, { targets, color = '#ef4444' }) {
  const srcs = (targets || []).map(t => t.thumbSrc).filter(Boolean);
  return await page.evaluate(({ srcs, color }) => {
    const ATTR = 'data-pwrowsim';
    const savedOutline = 'data-pwrowsim-prev-outline';
    const savedOffset = 'data-pwrowsim-prev-offset';
    const savedBg = 'data-pwrowsim-prev-bg';

    // cleanup previous marks
    for (const el of Array.from(document.querySelectorAll(`[${ATTR}]`))) {
      const prevO = el.getAttribute(savedOutline);
      const prevOff = el.getAttribute(savedOffset);
      const prevBg = el.getAttribute(savedBg);
      if (prevO !== null) el.style.outline = prevO;
      if (prevOff !== null) el.style.outlineOffset = prevOff;
      if (prevBg !== null) el.style.background = prevBg;
      el.removeAttribute(ATTR);
      el.removeAttribute(savedOutline);
      el.removeAttribute(savedOffset);
      el.removeAttribute(savedBg);
    }

    function mark(el) {
      if (!el) return;
      if (!el.hasAttribute(ATTR)) {
        el.setAttribute(savedOutline, el.style.outline || '');
        el.setAttribute(savedOffset, el.style.outlineOffset || '');
        el.setAttribute(savedBg, el.style.background || '');
        el.setAttribute(ATTR, '1');
      }
      el.style.outline = `3px solid ${color}`;
      el.style.outlineOffset = '2px';
      // subtle tint so it's visible even if outline is clipped
      el.style.background = 'rgba(239, 68, 68, 0.06)';
    }

    // Find each thumbnail by exact src and mark its container/host.
    for (const src of srcs) {
      const imgEl = Array.from(document.querySelectorAll('img.thumbnail')).find(
        (i) => i.getAttribute('src') === src || i.src === src
      );
      const container = imgEl?.closest?.('.library-item-card-container') || null;
      const host = imgEl?.closest?.('library-item-card') || null;
      mark(container || host || imgEl);
    }

    return { highlighted: srcs.length };
  }, { srcs, color }).catch(() => ({ highlighted: 0 }));
}

async function highlightRowScanState(page, { activeThumbSrc, processedThumbSrcs }) {
  const processed = Array.from(processedThumbSrcs || []).filter(Boolean);
  const active = activeThumbSrc || '';
  return await page.evaluate(({ processed, active }) => {
    const ATTR = 'data-pwrowsim';
    const savedOutline = 'data-pwrowsim-prev-outline';
    const savedOffset = 'data-pwrowsim-prev-offset';
    const savedBg = 'data-pwrowsim-prev-bg';

    // cleanup previous marks
    for (const el of Array.from(document.querySelectorAll(`[${ATTR}]`))) {
      const prevO = el.getAttribute(savedOutline);
      const prevOff = el.getAttribute(savedOffset);
      const prevBg = el.getAttribute(savedBg);
      if (prevO !== null) el.style.outline = prevO;
      if (prevOff !== null) el.style.outlineOffset = prevOff;
      if (prevBg !== null) el.style.background = prevBg;
      el.removeAttribute(ATTR);
      el.removeAttribute(savedOutline);
      el.removeAttribute(savedOffset);
      el.removeAttribute(savedBg);
    }

    function mark(el, { color, bg }) {
      if (!el) return;
      if (!el.hasAttribute(ATTR)) {
        el.setAttribute(savedOutline, el.style.outline || '');
        el.setAttribute(savedOffset, el.style.outlineOffset || '');
        el.setAttribute(savedBg, el.style.background || '');
        el.setAttribute(ATTR, '1');
      }
      el.style.outline = `3px solid ${color}`;
      el.style.outlineOffset = '2px';
      el.style.background = bg;
    }

    function findElBySrc(src) {
      const imgEl = Array.from(document.querySelectorAll('img.thumbnail')).find(
        (i) => i.getAttribute('src') === src || i.src === src
      );
      if (!imgEl) return null;
      return (
        imgEl.closest?.('.library-item-card-container') ||
        imgEl.closest?.('library-item-card') ||
        imgEl
      );
    }

    // Grey for already processed (subtle)
    for (const src of processed) {
      const el = findElBySrc(src);
      mark(el, { color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.05)' });
    }

    // Red for active (strong, overrides grey)
    if (active) {
      const el = findElBySrc(active);
      mark(el, { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)' });
    }

    return { processed: processed.length, active: Boolean(active) };
  }, { processed, active }).catch(() => ({ processed: 0, active: false }));
}

async function collectVisibleCards(page) {
  return await page.evaluate(() => {
    const out = [];
    const hosts = Array.from(document.querySelectorAll('library-item-card'));
    for (const host of hosts) {
      const img = host.querySelector('.library-item-card-container img.thumbnail, img.thumbnail');
      const src = img?.getAttribute?.('src') || img?.src || '';
      if (!src) continue;
      const title =
        host.querySelector('.library-item-card[aria-label]')?.getAttribute('aria-label') ||
        host.getAttribute('aria-label') ||
        '';
      out.push({
        key: src,
        thumbSrc: src,
        title: title || '',
      });
    }
    return out;
  }).catch(() => []);
}

async function scanAllCardsByScrolling(page, { maxSteps, idleRounds, pauseMs, limit }) {
  const hardLimit = normalizeLimit(limit);
  const seen = new Map(); // key -> {key, thumbSrc, title}
  let idle = 0;
  let steps = 0;

  // Start from top to be deterministic.
  await scrollListTo(page, 0);
  await sleep(Math.max(0, pauseMs));

  while (steps < maxSteps && idle < idleRounds && seen.size < hardLimit) {
    steps++;
    const before = seen.size;
    const visible = await collectVisibleCards(page);
    for (const item of visible) {
      if (!seen.has(item.key)) seen.set(item.key, item);
    }
    if (seen.size === before) idle++;
    else idle = 0;

    const metrics = await getListScrollMetrics(page);
    if (!metrics) break;
    const delta = Math.max(200, Math.floor(metrics.clientHeight * 0.9));
    await scrollListBy(page, delta);
    await sleep(Math.max(0, pauseMs));
  }

  return {
    items: Array.from(seen.values()),
    steps,
    idle,
  };
}

async function scanClickableCardsAndHighlight(page) {
  const cards = await waitForCardList(page);
  // Ensure we are scanning real cards instead of skeleton placeholders.
  await waitForHydratedCardContainers(page);
  const totalVisible = await cards.count();
  const viewLimit = Math.max(0, Math.min(totalVisible, Number.isFinite(SCAN_LIMIT) ? SCAN_LIMIT : totalVisible));

  // Full scan across the virtual list by scrolling (to get the correct count).
  if (SCAN_SCROLL_ALL) {
    const discoveryLimit = normalizeLimit(SCAN_DISCOVERY_LIMIT);
    const full = await scanAllCardsByScrolling(page, {
      maxSteps: SCAN_MAX_SCROLL_STEPS,
      idleRounds: SCAN_IDLE_ROUNDS,
      pauseMs: SCAN_SCROLL_PAUSE_MS,
      limit: discoveryLimit,
    });
    logI(
      `🔎 Scan(all): discovered=${full.items.length} steps=${full.steps} idle=${full.idle} (discoveryLimit=${Number.isFinite(SCAN_DISCOVERY_LIMIT) && SCAN_DISCOVERY_LIMIT > 0 ? SCAN_DISCOVERY_LIMIT : '∞'})`
    );
  }

  const rows = await page.evaluate(({ limit, highlight }) => {
    const ATTR = 'data-pwscan';
    const savedOutline = 'data-pwscan-prev-outline';
    const savedOffset = 'data-pwscan-prev-offset';

    // cleanup previous scan marks
    for (const el of Array.from(document.querySelectorAll(`[${ATTR}]`))) {
      const prevO = el.getAttribute(savedOutline);
      const prevOff = el.getAttribute(savedOffset);
      if (prevO !== null) el.style.outline = prevO;
      if (prevOff !== null) el.style.outlineOffset = prevOff;
      el.removeAttribute(ATTR);
      el.removeAttribute(savedOutline);
      el.removeAttribute(savedOffset);
    }

    // Prefer scanning the *actual clickable container* if it exists in light DOM.
    // This avoids false negatives when hosts exist but are still skeleton/placeholder.
    const containers = Array.from(document.querySelectorAll('.library-item-card-container')).slice(0, limit);
    const hosts =
      containers.length > 0
        ? []
        // Fallback: scan the outer host if container isn't available (e.g. placeholder state or closed shadow)
        : Array.from(document.querySelectorAll('library-item-card')).slice(0, limit);
    const out = [];

    function mark(el, outline) {
      if (!el || !highlight) return;
      if (!el.hasAttribute(ATTR)) {
        el.setAttribute(savedOutline, el.style.outline || '');
        el.setAttribute(savedOffset, el.style.outlineOffset || '');
        el.setAttribute(ATTR, '1');
      }
      el.style.outline = outline;
      el.style.outlineOffset = '2px';
    }

    function deepQueryFirst(root, selector) {
      // Traverse light DOM + ALL open shadow roots under root.
      const stack = [root];
      while (stack.length) {
        const node = stack.pop();
        if (!node) continue;
        try {
          const found = node.querySelector?.(selector);
          if (found) return found;
        } catch {
          // ignore
        }
        // Walk children
        const kids = node.children ? Array.from(node.children) : [];
        for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
        // Walk open shadow root
        const sr = node.shadowRoot;
        if (sr) stack.push(sr);
      }
      return null;
    }

    function findContainer(host) {
      if (!host) return null;
      return deepQueryFirst(host, '.library-item-card-container');
    }

    // Case A: we can directly enumerate containers (best case).
    for (let i = 0; i < containers.length; i++) {
      const container = containers[i];
      const host = container.closest?.('library-item-card') || null;
      const baseEl = container;
      const r = baseEl.getBoundingClientRect();
      const cx = Math.round(r.left + r.width / 2);
      const cy = Math.round(r.top + r.height / 2);
      const top = document.elementsFromPoint(cx, cy)[0];
      const title =
        host?.querySelector?.('.library-item-card[aria-label]')?.getAttribute?.('aria-label') ||
        host?.getAttribute?.('aria-label') ||
        baseEl.getAttribute?.('aria-label') ||
        baseEl.closest?.('[aria-label]')?.getAttribute?.('aria-label') ||
        '(no aria-label)';

      // green = intended click target (container)
      mark(container, '2px solid #22c55e');

      // red = click interceptor at center point (if outside card)
      const isInterceptor = top && top !== baseEl && !baseEl.contains(top);
      if (isInterceptor) mark(top, '2px solid #ef4444');

      out.push({
        i,
        title: String(title).slice(0, 80),
        centerX: cx,
        centerY: cy,
        hasContainer: true,
        topTag: top?.tagName?.toLowerCase?.() || '',
        topClass:
          typeof top?.className === 'string'
            ? top.className.split(/\s+/).slice(0, 6).join('.')
            : '',
        intercepted: Boolean(isInterceptor),
      });
    }

    // Case B: no containers found in light DOM; fall back to hosts (may be placeholder/closed shadow).
    for (let i = 0; i < hosts.length; i++) {
      const host = hosts[i];
      const container = findContainer(host);
      const baseEl = container || host;
      const r = baseEl.getBoundingClientRect();
      const cx = Math.round(r.left + r.width / 2);
      const cy = Math.round(r.top + r.height / 2);
      const top = document.elementsFromPoint(cx, cy)[0];
      const title =
        host.querySelector?.('.library-item-card[aria-label]')?.getAttribute?.('aria-label') ||
        host.getAttribute?.('aria-label') ||
        baseEl.getAttribute?.('aria-label') ||
        baseEl.closest?.('[aria-label]')?.getAttribute?.('aria-label') ||
        '(no aria-label)';

      // green = intended click target (container), orange = fallback (host only)
      if (container) mark(container, '2px solid #22c55e');
      else mark(host, '2px solid #f59e0b');

      const isInterceptor = top && top !== baseEl && !baseEl.contains(top);
      if (isInterceptor) mark(top, '2px solid #ef4444');

      out.push({
        i,
        title: String(title).slice(0, 80),
        centerX: cx,
        centerY: cy,
        hasContainer: Boolean(container),
        topTag: top?.tagName?.toLowerCase?.() || '',
        topClass:
          typeof top?.className === 'string'
            ? top.className.split(/\s+/).slice(0, 6).join('.')
            : '',
        intercepted: Boolean(isInterceptor),
      });
    }

    return out;
  }, { limit: viewLimit, highlight: SCAN_HIGHLIGHT });

  const containerCount = await page.locator('.library-item-card-container').count().catch(() => 0);
  logI(
    `🔎 Scan(viewport): ${rows.length}/${totalVisible} visible cards checked (lightDOM containers currently in DOM: ${containerCount}, tableLimit=${viewLimit})`
  );
  // In Node, console.table is the fastest visual cue.
  if (!QUIET) {
    console.table(rows.map(r => ({
      i: r.i,
      hasContainer: r.hasContainer,
      intercepted: r.intercepted,
      top: r.topTag,
      topClass: r.topClass,
      title: r.title,
    })));
  }

  if (SCAN_SCREENSHOT) {
    await writeDebugBundle({
      page,
      prefix: `scan_mystuff`,
      note: 'Scan mode screenshot after highlighting click targets (green) and interceptors at center point (red).',
      extra: { total, shown: rows.length },
    });
  }

  return rows;
}

async function clickCardByViewportCenter(page, card) {
  // Compute viewport center point from the *actual clickable container* if present,
  // then do a trusted mouse click at that coordinate (closest to human clicking).
  const button = clickableTargetLocator(card);
  const container = card.locator('.library-item-card-container').first();
  const point = await (async () => {
    if (await button.count().catch(() => 0)) {
      return await button.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      }).catch(() => null);
    }
    if (await container.count().catch(() => 0)) {
      return await container.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      }).catch(() => null);
    }
    return await card.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }).catch(() => null);
  })();

  if (!point) return false;
  await page.mouse.move(point.x, point.y).catch(() => null);
  await page.mouse.click(point.x, point.y, { delay: 20 }).catch(() => null);
  return true;
}

async function waitForSessionOpen(page, startUrl) {
  // Gemini is an SPA; opening a card often changes URL without a full navigation.
  await Promise.race([
    page.waitForURL(/\/app\//, { timeout: OPEN_DETECT_TIMEOUT_MS }).catch(() => null),
    page.waitForFunction((old) => window.location.href !== old, startUrl, { timeout: OPEN_DETECT_TIMEOUT_MS }).catch(() => null),
    page.locator(SESSION_READY_SELECTOR).first().waitFor({ state: 'visible', timeout: OPEN_DETECT_TIMEOUT_MS }).catch(() => null),
  ]);
}

async function clickCardWithRetries({ page, card, index, titleForLog }) {
  const startUrl = page.url();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);

  // Some clicks open a new tab; capture both popup and in-page transitions.
  for (let attempt = 1; attempt <= 4; attempt++) {
    await temporarilyDisableScrollerPointerEvents(page);
    const popupPromise = page.waitForEvent('popup', { timeout: POPUP_TIMEOUT_MS }).catch(() => null);

    // Primary: programmatic click on the thumbnail (matches the console validation).
    // This bypasses pointer hit-testing entirely (important because many wrappers have `pointer-events:none`).
    let clicked = false;
    if (USE_JS_CLICK) {
      const thumb = clickableTargetLocator(card);
      const overlay = card.locator('.thumbnail-overlay').first();
      const roleButton = card.locator('.library-item-card[role="button"][tabindex="0"]').first();

      if (await thumb.count().catch(() => 0)) {
        await thumb.scrollIntoViewIfNeeded().catch(() => null);
        clicked = await jsClick(thumb);
        if (clicked) logV(`🧷 [${index}] JS click primary: img.thumbnail`);
      } else if (await overlay.count().catch(() => 0)) {
        await overlay.scrollIntoViewIfNeeded().catch(() => null);
        clicked = await jsClick(overlay);
        if (clicked) logV(`🧷 [${index}] JS click primary: .thumbnail-overlay`);
      } else if (await roleButton.count().catch(() => 0)) {
        await roleButton.scrollIntoViewIfNeeded().catch(() => null);
        clicked = await jsClick(roleButton);
        if (clicked) logV(`🧷 [${index}] JS click primary: role=button`);
      }
    }

    // Secondary: trusted coordinate click at the center of the actual clickable target.
    if (!clicked) {
      clicked = await clickCardByViewportCenter(page, card).catch(() => false);
      if (clicked) logV(`🖱️ [${index}] mouse center click`);
    }

    // Fallbacks if JS click didn't fire or couldn't find element handle.
    if (!clicked) {
      try {
        await card.hover({ timeout: 2000 }).catch(() => null);
      } catch {
        // ignore
      }

      const container = card.locator('.library-item-card-container').first();
      const clickTargets = [
        clickableTargetLocator(card),
        card.locator('.thumbnail-overlay').first(),
        card.locator('.library-item-card[role="button"][tabindex="0"]').first(),
        container,
        card.locator('a[href]').first(),
        card.locator('[role="link"]').first(),
        card.locator('button').first(),
      ];

      for (const target of clickTargets) {
        if (await target.count().catch(() => 0)) {
          try {
            await target.click({ timeout: CLICK_TIMEOUT_MS });
            clicked = true;
            break;
          } catch {
            // continue
          }
        }
      }
    }

    if (!clicked) {
      const pt =
        (await getClickPoint(container, 'center').catch(() => null)) ||
        (await getClickPoint(card, 'center').catch(() => null));
      if (pt) {
        await page.mouse.click(pt.x, pt.y).catch(() => null);
        clicked = true;
      }
    }

    if (!clicked) {
      await card.click({ force: true, timeout: CLICK_TIMEOUT_MS }).catch(() => null);
    }

    const popup = await popupPromise;
    if (popup) {
      await restoreScrollerPointerEvents(page);
      await popup.bringToFront().catch(() => null);
      await popup.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => null);
      return { kind: 'popup', page: popup };
    }

    await waitForSessionOpen(page, startUrl);

    // Heuristic: a session is usually /app/...; keep a selector fallback in case URL doesn't change.
    const looksOpened =
      page.url() !== startUrl ||
      (await page.locator(SESSION_READY_SELECTOR).first().isVisible().catch(() => false));

    if (looksOpened) {
      await restoreScrollerPointerEvents(page);
      return { kind: 'samePage', page };
    }

    // Diagnostics to understand why click didn't open.
    await debugClickSurface(page, card, `${index} attempt ${attempt}`);
    if (ENABLE_TRIAL_CLICK) {
      try {
        const btn = clickableTargetLocator(card);
        if (await btn.count().catch(() => 0)) await btn.click({ trial: true, timeout: CLICK_TIMEOUT_MS });
        else {
          const container = card.locator('.library-item-card-container').first();
          if (await container.count().catch(() => 0)) await container.click({ trial: true, timeout: CLICK_TIMEOUT_MS });
          else await card.click({ trial: true, timeout: CLICK_TIMEOUT_MS });
        }
      } catch (trialErr) {
        console.warn(`🧪 [debug] trial click says: ${trialErr?.message || trialErr}`);
      }
    }

    console.warn(`⚠️ [${index}] Click attempt ${attempt} didn't open. Retrying... (${titleForLog})`);
    await page.waitForTimeout(RETRY_PAUSE_MS);
  }

  await restoreScrollerPointerEvents(page);
  return { kind: 'failed', page };
}

async function clickOnlyFlow({ page, context }) {
  console.log('🧭 Mode: click (scan + click verification only).');
  const rows = await scanClickableCardsAndHighlight(page);
  const hydrated = rows.filter(r => r.hasContainer).length;
  console.log(`➡️ click-only: scan rows=${rows.length}, hydrated=${hydrated}`);

  await waitForCardList(page);
  await waitForHydratedCardContainers(page);

  const cards = page.locator('library-item-card', { has: page.locator('.library-item-card-container') });
  const total = await cards.count();
  const count = Math.max(0, Math.min(total, Number.isFinite(CLICK_ONLY_LIMIT) ? CLICK_ONLY_LIMIT : total));
  console.log(`✅ click-only: will try ${count}/${total} hydrated cards`);

  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const title =
      (await card.locator('.library-item-card[aria-label]').first().getAttribute('aria-label', { timeout: CLICK_TIMEOUT_MS }).catch(() => null)) ||
      (await card.getAttribute('aria-label', { timeout: CLICK_TIMEOUT_MS }).catch(() => null)) ||
      'Untitled';
    console.log(`\n🖱️ Click-only [${i + 1}/${count}]: ${title}`);

    const startUrl = page.url();
    const opened = await clickCardWithRetries({ page, card, index: `${i + 1}/${count}`, titleForLog: title });

    const ok =
      page.url() !== startUrl ||
      (await page.locator(SESSION_READY_SELECTOR).first().isVisible().catch(() => false));

    console.log(`➡️ Result: ${ok ? 'OPENED' : 'NOT OPENED'} | url=${page.url()}`);

    // Return to list for next verification
    if (opened.kind === 'popup') {
      await opened.page.close().catch(() => null);
      await page.bringToFront().catch(() => null);
    } else if (ok) {
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(async () => {
        await page.goto(MY_STUFF_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      });
    }
    await waitForCardList(page);
    await waitForHydratedCardContainers(page);
  }
}

async function simulateRowBatchFlow({ page }) {
  console.log('🧪 Mode: simulate (row-batch dry run). No clicking, no extraction.');

  await waitForCardList(page);
  await waitForHydratedCardContainers(page);
  await scrollListTo(page, 0);
  await sleep(EXTRACT_SCROLL_PAUSE_MS);

  const scrollSign = EXTRACT_ROW_SCROLL_DIRECTION === 'up' ? -1 : 1;

  let idle = 0;
  let steps = 0;
  const processed = new Set(); // thumb src cache

  while (steps < EXTRACT_MAX_SCROLL_STEPS && idle < EXTRACT_IDLE_ROUNDS) {
    steps++;

    await waitForCardList(page);
    await waitForHydratedCardContainers(page);

    const { targets, rowDelta } = await getFirstRowTargets(page, { batchSize: EXTRACT_ROW_BATCH_SIZE });
    if (!targets || targets.length === 0) {
      idle++;
      await sleep(SIMULATE_STEP_PAUSE_MS);
    } else {
      idle = 0;
      const titles = targets.map((t, i) => `${i + 1}:${(t.title || '').slice(0, 40)}`).join(' | ');
      logI(`🧪 simulate: row=${steps} targets=${targets.length} rowDelta≈${Math.round(rowDelta || 0)} ${titles ? `| ${titles}` : ''}`);

      // Sequential "scan" from left -> right, one card at a time.
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        const src = t?.thumbSrc || '';
        if (!src) continue;

        const already = processed.has(src);
        // Highlight processed as grey, active as red (even if already processed, keep it grey).
        if (already) {
          await highlightRowScanState(page, { activeThumbSrc: '', processedThumbSrcs: [src] });
          await sleep(SIMULATE_PROCESSED_PAUSE_MS);
          continue;
        }

        await highlightRowScanState(page, { activeThumbSrc: src, processedThumbSrcs: Array.from(processed) });
        await sleep(SIMULATE_STEP_PAUSE_MS);
        processed.add(src);
      }

      const effectiveRowDelta = Math.max(40, Math.round(Number.isFinite(rowDelta) && rowDelta > 0 ? rowDelta : 220));
      await sleep(SIMULATE_AFTER_BATCH_PAUSE_MS);
      await scrollListBy(page, scrollSign * effectiveRowDelta);
      await sleep(EXTRACT_SCROLL_PAUSE_MS);
    }
  }

  logI(`🧪 simulate done: rows=${steps} idle=${idle} processed=${processed.size}`);
  if (SIMULATE_AUTO_CLOSE) {
    logI('🧹 GEMINI_SIMULATE_AUTO_CLOSE=1 → closing the tab.');
    await page.close();
  } else {
    logI('ℹ️ Leaving the tab open (set GEMINI_SIMULATE_AUTO_CLOSE=1 to auto-close).');
  }
}

async function extractByScrolling({ page, context, limit }) {
  // NOTE: despite the name, this is now "row-batch extraction":
  //  - on list page, read the first visible row (left->right) and click items 1..N (default 5)
  //  - after N items, scroll by ~one row height and repeat
  logI(`🧭 Extract(row-batch): starting (limit=${limit || '∞'}, batchSize=${EXTRACT_ROW_BATCH_SIZE})`);

  const results = [];
  const processed = new Set(); // thumb src

  await waitForCardList(page);
  await waitForHydratedCardContainers(page);
  await scrollListTo(page, 0);
  await sleep(EXTRACT_SCROLL_PAUSE_MS);

  let idle = 0;
  let steps = 0;

  const scrollSign = EXTRACT_ROW_SCROLL_DIRECTION === 'up' ? -1 : 1;

  while (steps < EXTRACT_MAX_SCROLL_STEPS && idle < EXTRACT_IDLE_ROUNDS) {
    if (limit && results.length >= limit) break;
    steps++;

    await waitForCardList(page);
    await waitForHydratedCardContainers(page);

    const before = processed.size;
    const { targets, rowDelta } = await getFirstRowTargets(page, { batchSize: EXTRACT_ROW_BATCH_SIZE });

    if (!targets || targets.length === 0) {
      idle++;
    } else {
      for (let j = 0; j < targets.length; j++) {
        if (limit && results.length >= limit) break;
        const item = targets[j];
        if (!item?.thumbSrc || processed.has(item.thumbSrc)) continue;
        processed.add(item.thumbSrc);

        const startUrl = page.url();
        const scrollBefore = await getListScrollMetrics(page);

        const opened = await (async () => {
          // Locate the card host by matching thumbnail src via XPath (CSS escaping is annoying here).
          const x = `xpath=//img[contains(@class,"thumbnail") and @src=${xpathLiteral(item.thumbSrc)}]/ancestor::library-item-card[1]`;
          const cardHost = page.locator(x).first();
          const countHost = await cardHost.count().catch(() => 0);

          if (countHost > 0) {
            const sessionUrl = await resolveSessionUrlFromCard(page, cardHost);
            if (sessionUrl) {
              const sp = await context.newPage();
              await sp.goto(sessionUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
              return { kind: 'newTab', page: sp };
            }
            return await clickCardWithRetries({
              page,
              card: cardHost,
              index: `${results.length + 1}`,
              titleForLog: item.title || `Row item ${j + 1}`,
            });
          }

          // Fallback: evaluate click by exact src match
          const clicked = await page.evaluate((src) => {
            const imgEl = Array.from(document.querySelectorAll('img.thumbnail')).find(
              (i) => i.getAttribute('src') === src || i.src === src
            );
            if (!imgEl) return false;
            imgEl.scrollIntoView({ block: 'center' });
            imgEl.click();
            return true;
          }, item.thumbSrc).catch(() => false);

          if (!clicked) return { kind: 'failed', page };
          await waitForSessionOpen(page, startUrl);
          return { kind: 'samePage', page };
        })();

        const sessionPage = opened?.page;
        if (!opened || opened.kind === 'failed' || !sessionPage) {
          // count failures as no-progress for idle heuristics
          idle++;
          continue;
        }

        try {
          await sessionPage.locator(SESSION_READY_SELECTOR).first().waitFor({ state: 'visible', timeout: 25000 });
          await page.waitForTimeout(1500);

          const promptData = await sessionPage.evaluate(() => {
            let conversationTitle = '';
            const ct = document.querySelector('.conversation-title');
            if (ct && ct.textContent) conversationTitle = ct.textContent.trim();

            let text = '';
            const bubble = document.querySelector('.user-query-bubble-with-background');
            if (bubble) {
              const lines = Array.from(bubble.querySelectorAll('.query-text-line'))
                .map(el => el.textContent.trim())
                .filter(t => t.length > 0);
              text = lines.join('\n');
            } else {
              const fallback = document.querySelector('.query-text');
              text = fallback ? fallback.textContent.trim() : '';
            }

            let imgUrl = '';
            const img = document.querySelector('img.image.loaded');
            if (img && img.src && !img.src.includes('data:image')) imgUrl = img.src;
            else {
              const secondary = document.querySelector('img[src*="content-ad-pc.googleapis.com"]');
              imgUrl = secondary ? secondary.src : '';
            }
            return { conversationTitle, text, imgUrl };
          });

          const genericTitles = new Set(['预览或打开此项内容', 'Untitled Prompt', '(no aria-label)']);
          const promptFirstLine = (promptData.text || '').split('\n')[0].trim();
          const fromPrompt = promptFirstLine.length > 0 ? promptFirstLine.slice(0, 80) : '';
          const fromCard = genericTitles.has(item.title) ? '' : String(item.title || '').trim();
          const displayTitle =
            (promptData.conversationTitle && promptData.conversationTitle.trim()) ||
            fromPrompt ||
            fromCard ||
            'Untitled Prompt';

          results.push({
            id: `gemini_${Date.now()}_${results.length}`,
            title: displayTitle,
            promptText: promptData.text,
            imageUrl: promptData.imgUrl || item.thumbSrc,
            genres: [],
            styles: [],
            moods: [],
            createdAt: new Date().toISOString(),
            source: { name: 'Gemini', url: sessionPage.url() }
          });

          logI(`✅ [${results.length}] ${displayTitle}`);
        } catch (e) {
          console.warn('⚠️ Extract(row-batch) failed for item:', item.thumbSrc, e?.message || e);
        } finally {
          if (opened.kind === 'newTab') {
            await sessionPage.close().catch(() => null);
            await page.bringToFront().catch(() => null);
          } else if (opened.kind === 'samePage') {
            await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(async () => {
              await page.goto(MY_STUFF_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
            });
          }

          // Restore scroll position (best-effort) so we keep working on the same row "window".
          if (scrollBefore) await scrollListTo(page, scrollBefore.scrollTop || 0);
          await waitForCardList(page);
          await waitForHydratedCardContainers(page);
          await sleep(EXTRACT_SCROLL_PAUSE_MS);
        }
      }

      if (processed.size === before) idle++;
      else idle = 0;
    }

    // After finishing 1..N in the first row, scroll by ~one row height and repeat.
    const effectiveRowDelta = Math.max(40, Math.round(Number.isFinite(rowDelta) && rowDelta > 0 ? rowDelta : 220));
    await scrollListBy(page, scrollSign * effectiveRowDelta);
    await sleep(EXTRACT_SCROLL_PAUSE_MS);
  }

  logI(`🎯 Extract(row-batch) done: results=${results.length} processed=${processed.size} steps=${steps} idle=${idle}`);
  return results;
}

async function extractPromptData() {
  console.log('🚀 Connecting to Chrome on port 9222...');
  
  let browser;
  try {
    browser = await chromium.connectOverCDP(`http://localhost:${REMOTE_DEBUGGING_PORT}`);
  } catch (error) {
    console.error('❌ Failed to connect to Chrome. Make sure Chrome is running with --remote-debugging-port=9222');
    console.log('Current command to launch Chrome on Mac (Persistent Login):');
    console.log('/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --user-data-dir="$HOME/Library/Application Support/Google/Chrome_Gemini_Export"');
    process.exit(1);
  }

  const context = browser.contexts()[0];
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(30000);
  page.on('console', (msg) => {
    if (!VERBOSE) return;
    try {
      console.log(`🧠 [page console:${msg.type()}]`, msg.text());
    } catch {
      // ignore
    }
  });

  console.log('📦 Navigating to Gemini "My Stuff"...');
  await page.goto(MY_STUFF_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  if (MODE === 'scan') {
    logI('🧭 Mode: scan (no clicking, no extraction). Highlighting click targets and interceptors...');
    await scanClickableCardsAndHighlight(page);
    logI('✅ Scan finished. You can now visually inspect the page.');
    if (SCAN_AUTO_CLOSE) {
      logI('🧹 GEMINI_SCAN_AUTO_CLOSE=1 → closing the tab.');
      await page.close();
    } else {
      logI('ℹ️ Leaving the tab open (set GEMINI_SCAN_AUTO_CLOSE=1 to auto-close).');
    }
    return;
  }

  if (MODE === 'click') {
    await clickOnlyFlow({ page, context });
    console.log('✅ Click-only finished.');
    return;
  }

  if (MODE === 'simulate') {
    await simulateRowBatchFlow({ page });
    console.log('✅ Simulate finished.');
    return;
  }

  if (MODE === 'extract' && SCAN_BEFORE_EXTRACT) {
    logI('🧭 Pre-step: scan before extract (highlight + table), then continue to click/extract...');
    const rows = await scanClickableCardsAndHighlight(page);
    const hydrated = rows.filter(r => r.hasContainer).length;
    logI(`➡️ Scan→Extract: hydrated=${hydrated}, continuing in ${SCAN_TO_EXTRACT_PAUSE_MS}ms...`);
    await page.waitForTimeout(SCAN_TO_EXTRACT_PAUSE_MS);
  }

  logI('⏳ Waiting for library cards to appear...');
  try {
    await waitForCardList(page);
  } catch (e) {
    console.error('❌ Could not find any library items. Make sure you are logged in and "My Stuff" has content.');
    process.exit(1);
  }

  // Prefer extracting only fully-hydrated cards (those that contain the clickable container).
  // This makes the first validation step much more reliable (especially on slow networks).
  const allCards = await waitForCardList(page);
  await waitForHydratedCardContainers(page);

  const hydratedCards = page.locator('library-item-card', { has: page.locator('.library-item-card-container') });
  const cards = EXTRACT_ONLY_HYDRATED ? hydratedCards : allCards;

  const total = await cards.count();
  const rawCount = TEST_ONE_ONLY ? 1 : total;
  const count =
    EXTRACT_LIMIT && EXTRACT_LIMIT > 0 ? Math.min(rawCount, EXTRACT_LIMIT) : rawCount;

  logI(
    `✅ Found ${total} items${EXTRACT_ONLY_HYDRATED ? ' (hydrated only)' : ''}. Starting extraction (Mode: ${TEST_ONE_ONLY ? 'TEST ONE ONLY' : 'BATCH'}, Limit: ${count})...`
  );

  // If enabled, extract across the whole virtual list by scrolling (recommended for correct counts).
  if (EXTRACT_SCROLL_ALL) {
    const results = await extractByScrolling({ page, context, limit: count });
    if (results.length > 0) {
      const outputDir = path.dirname(OUTPUT_FILE);
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ prompts: results }, null, 2));
      console.log(`\n🎉 Success! Exported ${results.length} prompt(s) to ${OUTPUT_FILE}`);
    } else {
      console.error('\n❌ No data was extracted. Check your login and the Gemini UI.');
    }
    await page.close();
    return;
  }

  const results = [];

  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const title = (await card.getAttribute('aria-label').catch(() => null)) || 'Untitled Prompt';
    const thumbUrl =
      (await card.locator('img').first().getAttribute('src').catch(() => '')) || '';

    logI(`\n🔍 Processing [${i + 1}/${count}]: ${title}`);
    logV(`🧾 card thumb: ${thumbUrl ? thumbUrl.slice(0, 120) : '(none)'}`);

    // Prefer a "new tab per item" approach if we can resolve the session URL without relying on clicks.
    // This is typically more stable than navigating away and coming back in an infinite scroller.
    let opened = null;
    let sessionPage = null;

    logV('🔗 Resolving session URL from card...');
    const sessionUrl = await resolveSessionUrlFromCard(page, card);
    logV(`🔗 sessionUrl: ${sessionUrl || '(none)'}`);
    if (sessionUrl) {
      logI(`🆕 Opening session in new tab via URL: ${sessionUrl}`);
      sessionPage = await context.newPage();
      await sessionPage.goto(sessionUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      opened = { kind: 'newTab', page: sessionPage };
    } else {
      logI('👆 Clicking card (robust) ...');
      opened = await clickCardWithRetries({
        page,
        card,
        index: `${i + 1}/${count}`,
        titleForLog: title,
      });
      sessionPage = opened.page;
    }

    if (!opened || opened.kind === 'failed') {
      console.warn(`⚠️ Could not open card detail for: ${title}. Skipping.`);
      await writeDebugBundle({
        page,
        prefix: `open_failed_${i + 1}_${safeFilePart(title)}`,
        note: 'Failed to open card detail (no URL, and click did not open).',
        extra: { index: i + 1, count, title, thumbUrl },
      });
      if (sessionPage && sessionPage !== page) await sessionPage.close().catch(() => null);
      continue;
    }
    
    try {
      // Wait for the session page to load its main content
      logI('⏳ Waiting for prompt and image to reveal...');
      await sessionPage.locator(SESSION_READY_SELECTOR).first().waitFor({ state: 'visible', timeout: 25000 });
      
      // Give it extra time for the image to load/reveal
      await page.waitForTimeout(4000); 

      const promptData = await sessionPage.evaluate(() => {
        // 0. Extract Conversation Title (if present in header)
        let conversationTitle = '';
        const ct = document.querySelector('.conversation-title');
        if (ct && ct.textContent) {
          conversationTitle = ct.textContent.trim();
        }

        // 1. Extract Prompt Text (Confirmed Structure)
        let text = '';
        const bubble = document.querySelector('.user-query-bubble-with-background');
        if (bubble) {
          const lines = Array.from(bubble.querySelectorAll('.query-text-line'))
            .map(el => el.textContent.trim())
            .filter(t => t.length > 0);
          text = lines.join('\n');
        } else {
          // Fallback
          const fallback = document.querySelector('.query-text');
          text = fallback ? fallback.textContent.trim() : '';
        }

        // 2. Extract Image URL (Confirmed Selection)
        let imgUrl = '';
        const img = document.querySelector('img.image.loaded');
        if (img && img.src && !img.src.includes('data:image')) {
          imgUrl = img.src;
        } else {
          // Secondary selector if needed
          const secondary = document.querySelector('img[src*="content-ad-pc.googleapis.com"]');
          imgUrl = secondary ? secondary.src : '';
        }

        return { conversationTitle, text, imgUrl };
      });

      if (promptData.text) {
        logV(`🧾 extracted text len: ${promptData.text.length}`);
        logV(`🧾 extracted text head: ${promptData.text.slice(0, 160).replace(/\s+/g, ' ')}`);
        logV(`🧾 extracted img: ${promptData.imgUrl ? promptData.imgUrl.slice(0, 160) : '(none)'}`);
        // Title priority:
        // 1) conversation title from the detail page
        // 2) first line of the prompt
        // 3) card aria-label (if not generic)
        const genericTitles = new Set(['预览或打开此项内容', 'Untitled Prompt', '(no aria-label)']);
        const promptFirstLine = (promptData.text || '').split('\n')[0].trim();
        const fromPrompt =
          promptFirstLine.length > 0 ? promptFirstLine.slice(0, 80) : '';
        const fromCard = genericTitles.has(title) ? '' : String(title || '').trim();

        const displayTitle =
          (promptData.conversationTitle && promptData.conversationTitle.trim()) ||
          fromPrompt ||
          fromCard ||
          'Untitled Prompt';

        results.push({
          id: `gemini_${Date.now()}_${i}`,
          title: displayTitle,
          promptText: promptData.text,
          imageUrl: promptData.imgUrl || thumbUrl,
          genres: [],
          styles: [],
          moods: [],
          createdAt: new Date().toISOString(),
          source: { name: 'Gemini', url: sessionPage.url() }
        });
        logI(`✅ Extracted: "${displayTitle}"`);
        logI(`📸 Image URL: ${promptData.imgUrl ? 'High Quality' : 'Thumbnail'}`);
      } else {
        console.warn(`⚠️ Could not extract prompt text for ${title}.`);
        await writeDebugBundle({
          page: sessionPage,
          prefix: `extract_empty_${i + 1}_${safeFilePart(title)}`,
          note: 'Opened session, but prompt text extraction returned empty.',
          extra: { index: i + 1, count, title, url: sessionPage.url(), thumbUrl, promptData },
        });
      }

    } catch (e) {
      console.error(`❌ Error during extraction:`, e.message);
      await writeDebugBundle({
        page: sessionPage,
        prefix: `extract_error_${i + 1}_${safeFilePart(title)}`,
        note: 'Exception during extraction.',
        extra: { index: i + 1, count, title, url: sessionPage.url(), thumbUrl, error: e?.message || String(e) },
      });
    }

    // Go back for the next item if in batch mode
    if (!TEST_ONE_ONLY && i < count - 1) {
      logI('🔙 Returning to "My Stuff"...');
      if (opened.kind === 'newTab') {
        await sessionPage.close().catch(() => null);
        await page.bringToFront().catch(() => null);
        // stay on list page; just ensure it's interactive again
        await restoreScrollerPointerEvents(page);
        await waitForCardList(page);
      } else if (opened.kind === 'popup') {
        await sessionPage.close().catch(() => null);
        await page.bringToFront().catch(() => null);
      } else {
        // Using goBack is often more reliable and preserves state (SPA-safe waitUntil)
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(async () => {
          // Fallback to goto if goBack fails
          await page.goto(MY_STUFF_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        });
      }
      await waitForCardList(page);
    }
  }

  // Save the results
  if (results.length > 0) {
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ prompts: results }, null, 2));
      console.log(`\n🎉 Export complete: ${results.length} prompt(s) → ${OUTPUT_FILE}`);
    if (TEST_ONE_ONLY) {
      logI('💡 Note: TEST_ONE_ONLY is true. Edit the script to false for full export.');
    }
  } else {
    console.error('\n❌ No data was extracted. Check your login and the Gemini UI.');
  }

  await page.close();
}

extractPromptData().catch(err => {
  console.error('💥 Fatal Error:', err);
  process.exit(1);
});
