const { app, BrowserWindow, ipcMain, screen, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

let win;
let saveTimer;
let preferences = { alwaysOnTop: true, sound: true };
const testMode = process.env.CONCH_TEST_MODE === '1';
if (testMode && process.env.CONCH_TEST_DATA) app.setPath('userData', process.env.CONCH_TEST_DATA);
const preferencesFile = () => path.join(app.getPath('userData'), 'preferences.json');

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(preferencesFile()), { recursive: true });
      fs.writeFileSync(preferencesFile(), JSON.stringify(preferences, null, 2));
    } catch (error) { console.error('Cannot save preferences:', error.message); }
  }, 200);
}

function createWindow() {
  try { preferences = { ...preferences, ...JSON.parse(fs.readFileSync(preferencesFile(), 'utf8')) }; } catch {}
  const area = screen.getPrimaryDisplay().workArea;
  const saved = preferences.position;
  const valid = saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && screen.getAllDisplays().some(({ workArea: a }) =>
    saved.x >= a.x && saved.y >= a.y && saved.x + 390 <= a.x + a.width && saved.y + 490 <= a.y + a.height);
  win = new BrowserWindow({
    width: 390, height: 490,
    x: valid ? saved.x : area.x + area.width - 410,
    y: valid ? saved.y : area.y + Math.max(0, area.height - 530),
    transparent: true, frame: false, hasShadow: false, resizable: false,
    maximizable: false, fullscreenable: false, alwaysOnTop: !!preferences.alwaysOnTop,
    show: false, backgroundColor: '#00000000', title: 'Волшебная ракушка',
    icon: path.join(__dirname, '../assets/magic-conch.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true,
      nodeIntegration: false, sandbox: true, spellcheck: false
    }
  });
  Menu.setApplicationMenu(null);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.once('ready-to-show', () => {
    win.setAlwaysOnTop(!!preferences.alwaysOnTop);
    if (!testMode) win.show();
  });
  win.on('moved', () => { const [x, y] = win.getPosition(); preferences.position = { x, y }; save(); });
  win.on('closed', () => { win = null; });
  win.loadFile(path.join(__dirname, 'index.html'));
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { win.restore(); win.show(); win.focus(); } });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}
ipcMain.handle('preferences:get', () => ({ sound: !!preferences.sound, alwaysOnTop: win?.isAlwaysOnTop() ?? false }));
ipcMain.handle('preferences:set', async (event, key, value) => {
  if (event.sender !== win?.webContents || !['sound', 'alwaysOnTop'].includes(key) || typeof value !== 'boolean') return;
  preferences[key] = value;
  if (key === 'alwaysOnTop') {
    win.setAlwaysOnTop(value);
    await new Promise(resolve => setTimeout(resolve, 80));
    value = win?.isAlwaysOnTop() ?? false;
    preferences[key] = value;
  }
  save();
  return value;
});
ipcMain.on('window:minimize', () => win?.minimize());
ipcMain.on('window:close', () => win?.close());
