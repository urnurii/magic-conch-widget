const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function buildFrontend() {
  const destination = path.join(root, 'dist', 'frontend');
  fs.mkdirSync(destination, { recursive: true });
  for (const file of ['index.html', 'style.css', 'answers.js', 'bridge.js', 'renderer.js']) {
    fs.copyFileSync(path.join(root, 'src', file), path.join(destination, file));
  }
  fs.cpSync(path.join(root, 'assets'), path.join(destination, 'assets'), { recursive: true });
  return destination;
}
if (require.main === module) console.log('Frontend:', buildFrontend());
module.exports = { buildFrontend };
