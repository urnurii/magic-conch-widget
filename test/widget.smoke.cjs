const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { answers } = require('../src/answers.js');

(async () => {
  const root = path.resolve(__dirname, '..');
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'conch-widget-test-'));
  const env = { ...process.env, CONCH_TEST_MODE: '1', CONCH_TEST_DATA: userData };
  delete env.ELECTRON_RUN_AS_NODE;
  let application;
  const launch = async () => {
    const packaged = process.env.CONCH_PACKAGED_EXECUTABLE;
    application = await electron.launch({
      ...(packaged ? { executablePath: packaged } : {}), args: packaged ? [] : [root], env
    });
    const page = await application.firstWindow();
    await page.waitForFunction(() => window.conch && document.getElementById('shell'));
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].showInactive());
    await page.waitForTimeout(150);
    return page;
  };
  try {
    let page = await launch();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const native = await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      return { background: window.getBackgroundColor(), top: window.isAlwaysOnTop(), size: window.getSize() };
    });
    assert.match(native.background, /^#000000(?:00)?$/);
    assert.deepEqual(native.size, [390, 490]);
    assert.equal(await page.locator('#pin').getAttribute('aria-pressed'), String(native.top));
    const transparentPixels = await page.evaluate(async () => {
      const img = document.querySelector('.shell img'); await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const context = canvas.getContext('2d'); context.drawImage(img, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let transparent = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] === 0) transparent++;
      return transparent / (pixels.length / 4);
    });
    assert.ok(transparentPixels > .2, 'PNG must have a real alpha channel');
    // Silence playback during tests, and verify persistence through the actual bridge.
    await page.locator('#sound').click();
    await page.locator('#shell').click();
    await page.locator('#shell').click();
    await page.waitForFunction(() => document.getElementById('eyebrow').textContent === 'РАКУШКА СКАЗАЛА');
    const first = await page.locator('#answer').textContent();
    assert.ok(answers.includes(first));
    const ring = await page.locator('#ring').boundingBox();
    const drag = async distance => {
      await page.mouse.move(ring.x + ring.width / 2, ring.y + ring.height / 2);
      await page.mouse.down();
      await page.mouse.move(ring.x + ring.width / 2, ring.y + ring.height / 2 - distance, { steps: 8 });
      await page.mouse.up();
    };
    await drag(20);
    assert.equal(await page.locator('#answer').textContent(), first, 'A short pull must not ask');
    await drag(65);
    await page.waitForFunction(() => document.getElementById('eyebrow').textContent === 'РАКУШКА СКАЗАЛА');
    const second = await page.locator('#answer').textContent();
    assert.ok(answers.includes(second)); assert.notEqual(first, second);
    // Cancellation after a sufficient pull must not produce a new answer.
    await page.mouse.move(ring.x + 20, ring.y + 20); await page.mouse.down();
    await page.mouse.move(ring.x + 20, ring.y - 45);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.mouse.up();
    assert.equal(await page.locator('#answer').textContent(), second);
    await page.locator('#pin').click();
    await page.waitForTimeout(150);
    const pinned = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isAlwaysOnTop());
    assert.equal(await page.locator('#pin').getAttribute('aria-pressed'), String(pinned));
    if (pinned) await page.locator('#pin').click();
    await page.locator('#ring').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('eyebrow').textContent === 'РАКУШКА СКАЗАЛА');
    await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results/preview.png'), omitBackground: true });
    await page.waitForTimeout(300);
    assert.deepEqual(errors, []);
    await application.close();
    page = await launch();
    await page.waitForFunction(() => document.getElementById('sound').getAttribute('aria-pressed') === 'false');
    assert.equal(await page.locator('#pin').getAttribute('aria-pressed'), 'false');
    const closed = application.waitForEvent('close');
    await page.locator('#close').click();
    await closed;
    console.log('Desktop smoke passed: transparency, click, pull threshold, cancellation, keyboard, pin, saved preferences, close.');
  } finally {
    if (application) await application.close().catch(() => {});
    await fs.rm(userData, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
