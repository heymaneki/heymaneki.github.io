// Headless-browser checks for heymaneki.github.io and its lucky cat.
// Run: npm install && npm test   (needs Chrome or Edge; set BROWSER=path to override)
// Audio is never played: the page's AudioContext is replaced by a silent recorder.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PAGE = path.resolve(__dirname, '..', 'index.html');
const URL = pathToFileURL(PAGE).href;
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const BROWSER = process.env.BROWSER || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(p => fs.existsSync(p));

const results = [];
const check = (name, ok, extra = '') => results.push({ ok: !!ok, line: `${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}` });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SILENT_AUDIO = () => {
  window.__audio = { created: 0, sounds: 0 };
  const node = () => ({ connect: n => n || node(), start() { window.__audio.sounds++; }, stop() {},
    frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, type: '' });
  class FakeAudio {
    constructor() { window.__audio.created++; this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100; this.destination = node(); }
    createOscillator() { return node(); } createGain() { return node(); } createBiquadFilter() { return node(); }
    createBufferSource() { return node(); } createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; }
    resume() {}
  }
  window.AudioContext = FakeAudio; window.webkitAudioContext = FakeAudio;
};

(async () => {
  if (!BROWSER) throw new Error('No Chrome/Edge found; set BROWSER=/path/to/chrome');
  const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--mute-audio', '--no-first-run'] });
  async function open(width, theme, reduced = false) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/heymaneki\.png|ERR_/.test(m.text())) errors.push(m.text()); });
    await page.evaluateOnNewDocument(SILENT_AUDIO);
    await page.evaluateOnNewDocument(t => { try { localStorage.setItem('maneki-theme', t); } catch (e) {} }, theme);
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1, hasTouch: width < 500, isMobile: width < 500 });
    await page.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: theme },
      { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' },
    ]);
    await page.goto(URL, { waitUntil: 'load' });
    await sleep(300);
    return { page, errors };
  }
  const state = page => page.evaluate(() => ({
    taps: +statTaps.textContent, best: +statCombo.textContent,
    cat: [...luckyCat.classList], spec: [...catSpec.classList],
    combo: catCombo.classList.contains('is-on') ? catCombo.textContent : '',
  }));

  // Layout in both themes, phone to desktop
  for (const [w, theme] of [[1280, 'light'], [1280, 'dark'], [480, 'light'], [360, 'light'], [360, 'dark'], [320, 'light']]) {
    const { page, errors } = await open(w, theme);
    const info = await page.evaluate(() => {
      const r = s => document.querySelector(s).getBoundingClientRect();
      const overlap = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      const cat = r('#luckyCat'), label = r('.cat-label');
      const blockers = ['.hero-title h1', '.links', '#themeToggle', '#soundToggle', '.bio', '.avatar-wrap'].map(r);
      return {
        hscroll: document.documentElement.scrollWidth > window.innerWidth,
        visible: !luckyCat.hidden,
        clear: blockers.every(b => !overlap(cat, b) && !overlap(label, b)),
        dark: document.documentElement.getAttribute('data-theme') === 'dark',
      };
    });
    check(`${w}px ${theme}: no horizontal scroll`, !info.hscroll);
    check(`${w}px ${theme}: cat visible and clear of name, bio, buttons and toggles`, info.visible && info.clear);
    check(`${w}px ${theme}: theme applied`, info.dark === (theme === 'dark'));
    await page.screenshot({ path: `${OUT}/${w}-${theme}.png`, fullPage: true });
    check(`${w}px ${theme}: no console errors`, errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // Fortunes, keyboard, a11y
  {
    const { page, errors } = await open(1280, 'light');
    await page.click('#catButton'); await sleep(200);
    let s = await page.evaluate(() => ({ open: !fortuneSlip.hidden, h: fortuneHeading.textContent, l: fortuneLine.textContent, exp: catButton.getAttribute('aria-expanded') }));
    check('click gives a fortune slip', s.open && s.h && s.l && s.exp === 'true', `${s.h}: ${s.l}`);
    check('clicking the cat does not count as a drum tap', (await state(page)).taps === 0);
    await sleep(150);
    check('fortune announced to screen readers', (await page.evaluate(() => catAnnouncement.textContent)).length > 0);
    const lines = await page.evaluate(() => { const out = []; for (let i = 0; i < 60; i++) { fortuneAgain.click(); out.push(fortuneLine.textContent); } return out; });
    check('no fortune repeats back-to-back (60 draws)', lines.every((l, i) => i === 0 || l !== lines[i - 1]));
    const dist = await page.evaluate(() => { const c = {}; for (let i = 0; i < 4000; i++) { fortuneAgain.click(); c[fortuneHeading.textContent] = (c[fortuneHeading.textContent] || 0) + 1; } return c; });
    check('luck levels weighted, Great and Bad rare', dist['Great luck'] < 500 && dist['Bad luck'] < 400 && dist['Good luck'] > 1000, JSON.stringify(dist));
    await page.focus('#fortuneAgain');
    await page.keyboard.press('Escape');
    s = await page.evaluate(() => ({ hidden: fortuneSlip.hidden, focus: document.activeElement.id }));
    check('Escape closes the slip and returns focus to the cat', s.hidden && s.focus === 'catButton');
    const before = (await state(page)).taps;
    await page.keyboard.press('Enter');
    check('Enter on the cat opens a fortune', await page.evaluate(() => !fortuneSlip.hidden));
    check('Enter on a button is not a drum tap', (await state(page)).taps === before);
    await page.click('#fortuneClose');
    check('close button closes the slip', await page.evaluate(() => fortuneSlip.hidden));
    await page.click('#catButton'); await sleep(50);
    await page.mouse.click(1200, 880);
    check('clicking outside closes the slip', await page.evaluate(() => fortuneSlip.hidden));
    check('desktop fortunes: no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // Drumming, combo, wiring diagram mirror, stats
  {
    const { page, errors } = await open(1280, 'light');
    const st = await page.evaluate(() => ({ pool: statPool.textContent, size: statSize.textContent, checks: statChecks.textContent }));
    check('stats: fortune pool counted from the code', +st.pool >= 30, st.pool);
    check('stats: cat size measured live', /^\d+(\.\d)? KB$/.test(st.size), st.size);
    await page.keyboard.press('KeyA');
    let s = await state(page);
    check('a keypress drums a paw', s.taps === 1 && (s.cat.includes('tap-l') || s.cat.includes('tap-r')), s.cat.join(' '));
    check('wiring diagram mirrors the drum', s.spec.some(c => c.startsWith('tap-')));
    const firstSide = s.cat.find(c => c.startsWith('tap-'));
    await sleep(250);
    await page.keyboard.press('KeyB');
    s = await state(page);
    check('paws alternate', s.cat.some(c => c.startsWith('tap-') && c !== firstSide), `${firstSide} -> ${s.cat.join(' ')}`);
    const t0 = (await state(page)).taps;
    await page.click('#copyEmailBtn').catch(() => {});
    await sleep(50);
    check('clicking a button is not a drum tap', (await state(page)).taps === t0);
    await page.mouse.click(1200, 880);
    check('clicking an empty spot drums', (await state(page)).taps === t0 + 1);
    for (let i = 0; i < 12; i++) { await page.keyboard.press('KeyK'); await sleep(40); }
    s = await state(page);
    check('fast drumming shows a combo badge', /^×\d+$/.test(s.combo), s.combo);
    for (let i = 0; i < 20; i++) { await page.keyboard.press('KeyJ'); await sleep(30); }
    s = await state(page);
    check('a big combo makes the cat excited, in both views', s.cat.includes('is-excited') && s.spec.includes('is-excited'));
    check('best combo stat updates', s.best >= 25, String(s.best));
    await page.screenshot({ path: `${OUT}/combo.png`, clip: { x: 640, y: 0, width: 640, height: 260 } });
    await sleep(1000);
    s = await state(page);
    check('combo fades after a pause', !s.combo && !s.cat.includes('is-excited'));
    // petting mirrors too
    const box = await (await page.$('#catButton')).boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    for (let i = 0; i < 6; i++) await page.mouse.move(cx + (i % 2 ? 25 : -25), cy, { steps: 4 });
    await sleep(80);
    s = await state(page);
    check('shaking the mouse pets the cat (and the diagram)', s.cat.includes('is-petting') && s.spec.includes('is-petting'));
    check('petting does not open a fortune', await page.evaluate(() => fortuneSlip.hidden));
    await page.evaluate(() => document.querySelector('.showcase').scrollIntoView());
    await sleep(100);
    await page.screenshot({ path: `${OUT}/showcase-light.png`, fullPage: false });
    await page.mouse.move(100, 100); await sleep(80);
    const p1 = await page.evaluate(() => document.querySelector('#luckyCat .cat-pupils').getAttribute('transform'));
    await page.mouse.move(1200, 800); await sleep(80);
    const p2 = await page.evaluate(() => [document.querySelector('#luckyCat .cat-pupils').getAttribute('transform'), document.querySelector('#catSpec .cat-pupils').getAttribute('transform')]);
    check('eyes follow the cursor, diagram eyes too', p1 && p2[0] && p1 !== p2[0] && p2[0] === p2[1]);
    let blinked = await page.evaluate(() => new Promise(res => {
      const mo = new MutationObserver(() => { if (luckyCat.classList.contains('is-blinking')) { mo.disconnect(); res(true); } });
      mo.observe(luckyCat, { attributes: true }); setTimeout(() => res(false), 7000);
    }));
    check('blinks within 7 seconds', blinked);
    check('drumming: no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // Sound: off by default, opt-in, synthesized
  {
    const { page, errors } = await open(1280, 'dark');
    await page.keyboard.press('KeyA'); await page.click('#catButton');
    let a = await page.evaluate(() => ({ ...window.__audio, pressed: soundToggle.getAttribute('aria-pressed') }));
    check('sound is off by default: no audio context, no sounds', a.created === 0 && a.sounds === 0 && a.pressed === 'false');
    await page.click('#soundToggle');
    await page.keyboard.press('KeyA');
    a = await page.evaluate(() => ({ ...window.__audio, pressed: soundToggle.getAttribute('aria-pressed'), label: soundToggle.textContent }));
    check('sound toggle turns synthesized sound on', a.created === 1 && a.sounds > 0 && a.pressed === 'true' && a.label === 'Sound on', JSON.stringify(a));
    await page.click('#soundToggle');
    const n = await page.evaluate(() => window.__audio.sounds);
    await page.keyboard.press('KeyA');
    check('sound toggle turns it back off', await page.evaluate(n => window.__audio.sounds === n, n));
    await page.click('#themeToggle');
    check('theme toggle still works', await page.evaluate(() => !document.documentElement.hasAttribute('data-theme') && themeToggle.textContent === 'Dark mode'));
    await page.evaluate(() => document.querySelector('.showcase').scrollIntoView());
    await page.click('#themeToggle');
    await sleep(100);
    await page.screenshot({ path: `${OUT}/showcase-dark.png` });
    check('sound/theme: no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // Nap and wake (clock pushed forward instead of waiting)
  {
    const { page, errors } = await open(1280, 'light');
    await page.evaluate(() => { const real = Date.now; Date.now = () => real() + 31000; });
    await sleep(600);
    check('naps after 30 seconds idle', await page.evaluate(() => luckyCat.classList.contains('is-napping') && catSpec.classList.contains('is-napping')));
    await page.screenshot({ path: `${OUT}/nap.png`, clip: { x: 760, y: 0, width: 520, height: 260 } });
    await page.mouse.move(300, 300); await sleep(100);
    const w = await page.evaluate(() => ({ nap: luckyCat.classList.contains('is-napping'), waking: luckyCat.classList.contains('is-waking') }));
    check('any input wakes it with a stretch', !w.nap && w.waking);
    check('nap: no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // Touch
  {
    const { page, errors } = await open(360, 'light');
    await page.tap('#catButton'); await sleep(150);
    check('phone: tap gives a fortune', await page.evaluate(() => !fortuneSlip.hidden));
    await page.screenshot({ path: `${OUT}/fortune-phone.png`, fullPage: true });
    await page.tap('#fortuneClose');
    const box = await (await page.$('#catButton')).boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const cdp = await page.target().createCDPSession();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await sleep(800);
    const petting = await page.evaluate(() => luckyCat.classList.contains('is-petting'));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(300);
    check('phone: press and hold pets the cat', petting);
    check('phone: press and hold does not open a fortune', await page.evaluate(() => fortuneSlip.hidden));
    const t = (await state(page)).taps;
    await page.tap('.bio');
    check('phone: tapping the page drums', (await state(page)).taps === t + 1);
    check('phone: no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // Reduced motion
  {
    const { page, errors } = await open(1280, 'light', true);
    await page.mouse.move(100, 100); await page.mouse.move(1200, 800); await sleep(100);
    check('reduced motion: eyes stay still', !(await page.evaluate(() => document.querySelector('.cat-pupils').getAttribute('transform'))));
    await page.keyboard.press('KeyA');
    const s = await state(page);
    check('reduced motion: drumming counts but does not animate', s.taps === 1 && !s.cat.some(c => c.startsWith('tap-')));
    await page.click('#catButton'); await sleep(100);
    const f = await page.evaluate(() => ({ open: !fortuneSlip.hidden, waving: luckyCat.classList.contains('is-waving'), anim: getComputedStyle(fortuneSlip).animationName }));
    check('reduced motion: fortunes work without wave or slide', f.open && !f.waving && f.anim === 'none');
    await page.evaluate(() => { const real = Date.now; Date.now = () => real() + 31000; });
    await sleep(500);
    check('reduced motion: no nap animation', await page.evaluate(() => !luckyCat.classList.contains('is-napping')));
    check('reduced motion: no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // Source rules
  const html = fs.readFileSync(PAGE, 'utf8');
  const emoji = html.match(/\p{Extended_Pictographic}/gu) || [];
  check('no emojis in the page', emoji.length === 0, emoji.join(' '));
  check('no external scripts or stylesheets', !/<script[^>]+src=|<link[^>]+rel="stylesheet"/.test(html));
  check('no audio files or autoplay', !/<audio|autoplay|\.mp3|\.wav/.test(html));
  await browser.close();

  // The page shows how many checks exist; keep that number honest.
  const shown = (html.match(/id="statChecks">(\d+)</) || [])[1];
  check('page shows the real number of checks', +shown === results.length + 1, `page says ${shown}, suite has ${results.length + 1}`);

  console.log(results.map(r => r.line).join('\n'));
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
