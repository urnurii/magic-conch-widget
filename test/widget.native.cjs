const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const { setTimeout: delay } = require('node:timers/promises');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { exerciseWidget } = require('./widget.browser.cjs');
(async () => {
  const root = path.resolve(__dirname, '..');
  const executable = path.resolve(root, process.env.CONCH_EXECUTABLE || 'src-tauri/target/release/magic-conch-widget.exe');
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'conch-native-'));
  let child; let browser; let launches = 0;
  async function launch() {
    const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port; await new Promise(resolve => server.close(resolve));
    let diagnostics = '';
    child = spawn(executable, [], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env,
      CONCH_TEST_DATA: data, WEBVIEW2_USER_DATA_FOLDER: path.join(data, `webview-${++launches}`),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` } });
    child.stdout.on('data', bytes => { diagnostics = (diagnostics + bytes).slice(-3000); });
    child.stderr.on('data', bytes => { diagnostics = (diagnostics + bytes).slice(-3000); });
    child.on('error', error => { diagnostics += error.message; });
    let connected = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      if (child.exitCode !== null) throw Error(`Native app exited early: ${child.exitCode}`);
      try { const response = await fetch(`http://127.0.0.1:${port}/json/version`); if (response.ok) { connected = true; break; } } catch {}
      await delay(200);
    }
    if (!connected) throw Error('WebView2 debugging endpoint did not become ready. ' + diagnostics);
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const context = browser.contexts()[0];
    const page = context.pages()[0] || await context.waitForEvent('page');
    await page.waitForFunction(() => window.conch && document.getElementById('shell'));
    await page.evaluate(() => window.conch.getPreferences());
    return page;
  }
  async function closeApp(page) {
    const closed = new Promise(resolve => child.once('exit', resolve));
    await page.locator('#close').click().catch(() => {});
    await Promise.race([closed, delay(10000).then(() => { throw Error('Native close did not exit'); })]);
    await browser.close().catch(() => {}); browser = null;
  }
  try {
    let page = await launch();
    const native = await page.evaluate(async () => {
      const window = __TAURI__.window.getCurrentWindow(); const size = await window.innerSize(); const scale = await window.scaleFactor();
      return { decorated: await window.isDecorated(), resizable: await window.isResizable(), width: size.width / scale, height: size.height / scale };
    });
    assert.deepEqual(native, { decorated: false, resizable: false, width: 390, height: 490 });
    await exerciseWidget(page);
    await page.locator('#pin').click(); await delay(150);
    let preferences = await page.evaluate(() => window.conch.getPreferences());
    assert.equal(await page.locator('#pin').getAttribute('aria-pressed'), String(preferences.alwaysOnTop));
    if (preferences.alwaysOnTop) { await page.locator('#pin').click(); await delay(150); }
    await assert.rejects(page.evaluate(() => __TAURI__.core.invoke('set_preference', { key: 'invalid', value: true })));
    await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results/native-windows.png'), omitBackground: true });
    await closeApp(page);
    preferences = JSON.parse(await fs.readFile(path.join(data, 'preferences.json'), 'utf8'));
    assert.equal(preferences.sound, false); assert.equal(preferences.alwaysOnTop, false);
    page = await launch();
    await page.waitForFunction(() => document.getElementById('sound').getAttribute('aria-pressed') === 'false');
    assert.equal(await page.locator('#pin').getAttribute('aria-pressed'), 'false');
    await closeApp(page);
    console.log('Native Windows app: window controls, recordings, interactions, IPC validation, saved preferences and restart passed.');
  } finally {
    await browser?.close().catch(() => {});
    if (child?.exitCode === null) { child.kill(); await delay(500); }
    await fs.rm(data, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
