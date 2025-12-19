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
const MODE = (process.env.GEMINI_MODE || 'extract').toLowerCase(); // 'scan' | 'click' | 'extract'
const SCAN_HIGHLIGHT = process.env.GEMINI_SCAN_HIGHLIGHT === undefined || process.env.GEMINI_SCAN_HIGHLIGHT === '1' || process.env.GEMINI_SCAN_HIGHLIGHT === 'true';
const SCAN_LIMIT = Number.parseInt(process.env.GEMINI_SCAN_LIMIT || '60', 10);
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
const DEBUG_DIR = process.env.GEMINI_DEBUG_DIR
  ? path.resolve(process.env.GEMINI_DEBUG_DIR)
  : path.join(process.cwd(), 'data', 'gemini_debug');

function logV(...args) {
  if (VERBOSE) console.log(...args);
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

async function scanClickableCardsAndHighlight(page) {
  const cards = await waitForCardList(page);
  // Ensure we are scanning real cards instead of skeleton placeholders.
  await waitForHydratedCardContainers(page);
  const total = await cards.count();
  const limit = Math.max(0, Math.min(total, Number.isFinite(SCAN_LIMIT) ? SCAN_LIMIT : total));

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
  }, { limit, highlight: SCAN_HIGHLIGHT });

  const containerCount = await page.locator('.library-item-card-container').count().catch(() => 0);
  console.log(
    `🔎 Scan complete: ${rows.length}/${total} cards checked (lightDOM containers: ${containerCount})`
  );
  // In Node, console.table is the fastest visual cue.
  console.table(rows.map(r => ({
    i: r.i,
    hasContainer: r.hasContainer,
    intercepted: r.intercepted,
    top: r.topTag,
    topClass: r.topClass,
    title: r.title,
  })));

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
    console.log('🧭 Mode: scan (no clicking, no extraction). Highlighting click targets and interceptors...');
    await scanClickableCardsAndHighlight(page);
    console.log('✅ Scan finished. You can now visually inspect the page.');
    if (SCAN_AUTO_CLOSE) {
      console.log('🧹 GEMINI_SCAN_AUTO_CLOSE=1 → closing the tab.');
      await page.close();
    } else {
      console.log('ℹ️ Leaving the tab open (set GEMINI_SCAN_AUTO_CLOSE=1 to auto-close).');
    }
    return;
  }

  if (MODE === 'click') {
    await clickOnlyFlow({ page, context });
    console.log('✅ Click-only finished.');
    return;
  }

  if (MODE === 'extract' && SCAN_BEFORE_EXTRACT) {
    console.log('🧭 Pre-step: scan before extract (highlight + table), then continue to click/extract...');
    const rows = await scanClickableCardsAndHighlight(page);
    const hydrated = rows.filter(r => r.hasContainer).length;
    console.log(`➡️ Scan→Extract: hydrated=${hydrated}, continuing in ${SCAN_TO_EXTRACT_PAUSE_MS}ms...`);
    await page.waitForTimeout(SCAN_TO_EXTRACT_PAUSE_MS);
  }

  console.log('⏳ Waiting for library cards to appear...');
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

  console.log(
    `✅ Found ${total} items${EXTRACT_ONLY_HYDRATED ? ' (hydrated only)' : ''}. Starting extraction (Mode: ${TEST_ONE_ONLY ? 'TEST ONE ONLY' : 'BATCH'}, Limit: ${count})...`
  );

  const results = [];

  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const title = (await card.getAttribute('aria-label').catch(() => null)) || 'Untitled Prompt';
    const thumbUrl =
      (await card.locator('img').first().getAttribute('src').catch(() => '')) || '';

    console.log(`\n🔍 Processing [${i + 1}/${count}]: ${title}`);
    logV(`🧾 card thumb: ${thumbUrl ? thumbUrl.slice(0, 120) : '(none)'}`);

    // Prefer a "new tab per item" approach if we can resolve the session URL without relying on clicks.
    // This is typically more stable than navigating away and coming back in an infinite scroller.
    let opened = null;
    let sessionPage = null;

    logV('🔗 Resolving session URL from card...');
    const sessionUrl = await resolveSessionUrlFromCard(page, card);
    logV(`🔗 sessionUrl: ${sessionUrl || '(none)'}`);
    if (sessionUrl) {
      console.log(`🆕 Opening session in new tab via URL: ${sessionUrl}`);
      sessionPage = await context.newPage();
      await sessionPage.goto(sessionUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      opened = { kind: 'newTab', page: sessionPage };
    } else {
      console.log('👆 Clicking card (robust) ...');
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
      console.log('⏳ Waiting for prompt and image to reveal...');
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
        console.log(`✅ Extracted: "${displayTitle}"`);
        console.log(`📸 Image URL: ${promptData.imgUrl ? 'High Quality' : 'Thumbnail'}`);
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
      console.log('🔙 Returning to "My Stuff"...');
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
    console.log(`\n🎉 Success! Exported ${results.length} prompt(s) to ${OUTPUT_FILE}`);
    if (TEST_ONE_ONLY) {
      console.log('💡 Note: TEST_ONE_ONLY is true. Edit the script to false for full export.');
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
