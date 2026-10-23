const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { answers, audioFor } = require('../src/answers.js');
const root = path.resolve(__dirname, '..');
test('every answer has its own bundled recording and matching checksum', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/audio/manifest.json'), 'utf8'));
  assert.equal(manifest.clips.length, answers.length);
  const hashes = new Set();
  for (const [index, answer] of answers.entries()) {
    const entry = manifest.clips[index];
    assert.equal(entry.text, answer);
    assert.equal(path.basename(audioFor(answer)), entry.file);
    const bytes = fs.readFileSync(path.join(root, audioFor(answer)));
    assert.ok(bytes.length > 1000);
    const hash = createHash('sha256').update(bytes).digest('hex');
    assert.equal(hash, entry.sha256); hashes.add(hash);
  }
  assert.equal(hashes.size, answers.length);
  assert.equal(audioFor('unknown'), null);
  assert.ok(fs.statSync(path.join(root, 'assets/audio/silence.wav')).size > 44);
});
