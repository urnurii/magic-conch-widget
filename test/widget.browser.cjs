const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createServer } = require('../scripts/dev.cjs');
const { answers, audioFor } = require('../src/answers.js');
const root = path.resolve(__dirname, '..');

async function exerciseWidget(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForSelector('#shell');
  await page.waitForFunction(() => document.querySelector('.shell img').complete);
  const image = await page.evaluate(async () => {
    const image = document.querySelector('.shell img'); await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] === 0) count++;
    return { ratio: count / (pixels.length / 4), width: image.naturalWidth, height: image.naturalHeight };
  });
  assert.ok(image.ratio > .2); assert.equal(image.width, 424); assert.equal(image.height, 463);
  // Decode real audio with the current engine, including the WKWebView family.
  for (const answer of answers) {
    const bytes = await fs.readFile(path.join(root, audioFor(answer)));
    const decoded = await page.evaluate(async base64 => {
      const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
      const context = new AudioContext();
      const buffer = await context.decodeAudioData(bytes.buffer);
      let peak = 0;
      for (const sample of buffer.getChannelData(0)) peak = Math.max(peak, Math.abs(sample));
      await context.close();
      return { duration: buffer.duration, peak };
    }, bytes.toString('base64'));
    assert.ok(decoded.duration > .2 && decoded.duration < 10, answer);
    assert.ok(decoded.peak > .01, `Silent recording: ${answer}`);
  }
  await page.locator('#shell').click();
  await page.locator('#shell').click();
  await page.waitForFunction(() => document.getElementById('eyebrow').textContent === 'РАКУШКА СКАЗАЛА');
  const first = await page.locator('#answer').textContent(); assert.ok(answers.includes(first));
  await page.waitForFunction(() => { const v = document.getElementById('voice'); return v.currentSrc.includes('answer-') && v.currentTime > 0; });
  assert.equal(await page.locator('#voice').evaluate(v => new URL(v.currentSrc).pathname.endsWith(ConchAnswers.audioFor(document.getElementById('answer').textContent))), true);
  await page.locator('#sound').click();
  assert.equal(await page.locator('#voice').evaluate(v => v.paused), true);
  const ring = await page.locator('#ring').boundingBox();
  const drag = async distance => {
    await page.mouse.move(ring.x + 24, ring.y + 24); await page.mouse.down();
    await page.mouse.move(ring.x + 24, ring.y + 24 - distance, { steps: 8 }); await page.mouse.up();
  };
  await drag(20); assert.equal(await page.locator('#answer').textContent(), first);
  await drag(65);
  await page.waitForFunction(() => document.getElementById('eyebrow').textContent === 'РАКУШКА СКАЗАЛА');
  const second = await page.locator('#answer').textContent(); assert.ok(answers.includes(second)); assert.notEqual(first, second);
  assert.equal(await page.locator('#voice').evaluate(v => v.paused), true, 'Muted answers must stay silent');
  await page.mouse.move(ring.x + 24, ring.y + 24); await page.mouse.down();
  await page.mouse.move(ring.x + 24, ring.y - 41);
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.mouse.up();
  assert.equal(await page.locator('#answer').textContent(), second);
  await page.locator('#ring').focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('eyebrow').textContent === 'РАКУШКА СКАЗАЛА');
  await page.locator('#ring').focus(); await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('eyebrow').textContent === 'РАКУШКА СКАЗАЛА');
  await page.evaluate(() => document.activeElement.blur()); await page.mouse.move(0, 0);
  assert.deepEqual(errors, []);
}

async function main() {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const engine = process.env.CONCH_BROWSER === 'webkit' ? webkit : chromium;
  const options = { headless: true };
  if (engine === chromium && process.env.PLAYWRIGHT_CHANNEL) options.channel = process.env.PLAYWRIGHT_CHANNEL;
  let browser;
  try {
    browser = await engine.launch(options);
    const page = await browser.newPage({ viewport: { width: 390, height: 490 }, reducedMotion: 'reduce' });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await exerciseWidget(page);
    await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, `test-results/preview-${process.env.CONCH_BROWSER || 'chromium'}.png`), omitBackground: true });
    console.log(`${process.env.CONCH_BROWSER || 'chromium'}: appearance, all 12 recordings, playback/mute, click, drag threshold, cancellation, keyboard passed.`);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { exerciseWidget };
