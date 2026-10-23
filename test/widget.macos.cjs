const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const root = path.resolve(__dirname, '..');
  const binary = path.resolve(root, 'src-tauri/target/universal-apple-darwin/release/bundle/macos/Magic Conch.app/Contents/MacOS/magic-conch-widget');
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'conch-macos-'));
  let child;
  try {
    child = spawn(binary, [], { env: { ...process.env, CONCH_STARTUP_PROBE: '1', CONCH_TEST_DATA: data }, stdio: ['ignore', 'ignore', 'pipe'] });
    let errorOutput = '';
    child.stderr.on('data', chunk => { errorOutput = (errorOutput + chunk).slice(-2000); });
    let timer;
    const exitCode = await new Promise((resolve, reject) => {
      timer = setTimeout(() => { child.kill(); reject(Error('macOS startup timed out: ' + errorOutput)); }, 45000);
      child.once('error', reject);
      child.once('exit', code => { clearTimeout(timer); resolve(code); });
    });
    assert.equal(exitCode, 0, errorOutput);
    const report = JSON.parse(await fs.readFile(path.join(data, 'startup-smoke.json'), 'utf8'));
    assert.equal(report.ok, true); assert.equal(report.os, 'macos');
    assert.equal(report.width, 390); assert.equal(report.height, 490); assert.equal(report.decorated, false);
    assert.equal(report.clips.length, 12);
    console.log('Native macOS app started, IPC initialized, window is frameless, and all 12 recordings are bundled.');
    console.log(JSON.stringify(report));
  } finally {
    if (child?.exitCode === null) child.kill();
    await fs.rm(data, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
