const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');

let mainWindow, tray, backend, pauseTimer = null, isPaused = false;
const userData = app.getPath('userData');
const statePath = path.join(userData, 'window-state.json');
const indexPath = path.join(userData, 'file-index.json');
const platform = os.platform();
const homeDir = os.homedir();
const defaultFolder = platform === 'win32'
  ? path.join(process.env.USERPROFILE, 'Ucloud')
  : path.join(homeDir, 'Ucloud');

function createDefaultFolder() {
  if (!fs.existsSync(defaultFolder)) fs.mkdirSync(defaultFolder, { recursive: true });
}
function loadWindowState() {
  try { return JSON.parse(fs.readFileSync(statePath)); } catch { return { width: 850, height: 480 }; }
}
function saveWindowState(bounds) {
  fs.writeFileSync(statePath, JSON.stringify(bounds));
}
function createWindow() {
  const state = loadWindowState();
  mainWindow = new BrowserWindow({
    ...state,
    minWidth: 600,
    minHeight: 350,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', () => saveWindowState(mainWindow.getBounds()));
}
function setTray(status = "ok") {
  const iconPath = path.join(__dirname, 'assets', status === "ok" ? 'tray-ok.png' : 'tray-sync.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  if (!tray) tray = new Tray(trayIcon);
  else tray.setImage(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    { label: isPaused ? "Resume Now" : "Pause 30 min", click: togglePause },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setToolTip(status === "ok" ? 'U-Cloud: Up-to-date' : 'U-Cloud: Syncing...');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow.show());
}
function togglePause() {
  if (isPaused) {
    isPaused = false;
    backend.send(JSON.stringify({ type: 'resume' }));
    setTray("ok");
    if (pauseTimer) clearTimeout(pauseTimer);
  } else {
    isPaused = true;
    backend.send(JSON.stringify({ type: 'pause' }));
    setTray("sync");
    pauseTimer = setTimeout(() => togglePause(), 30 * 60 * 1000);
  }
}
function startBackend() {
  backend = spawn(process.execPath, [path.join(__dirname, 'backend', 'server.js')], {
    stdio: ['pipe', 'pipe', 'inherit', 'ipc'],
    env: {
      ...process.env,
      U_CLOUD_SYNC_PATH: defaultFolder,
      U_CLOUD_INDEX_PATH: indexPath
    }
  });
  backend.on('message', (msg) => {
    if (msg.type === 'status') setTray(msg.status);
    if (msg.type === 'files') mainWindow.webContents.send('files:index', msg.files);
    if (msg.type === 'syncing') setTray("sync");
    if (msg.type === 'uptodate') setTray("ok");
  });
}
app.on('ready', () => {
  createDefaultFolder();
  setTray("ok");
  createWindow();
  startBackend();
});
app.on('window-all-closed', (e) => e.preventDefault());
app.on('before-quit', () => {
  if (backend) backend.kill();
});
ipcMain.handle('files:list', async () => {
  backend.send(JSON.stringify({ type: 'list' }));
  return new Promise(resolve => {
    backend.once('message', (msg) => resolve(msg.files || []));
  });
});
ipcMain.handle('files:scan', async () => {
  backend.send(JSON.stringify({ type: 'scan' }));
});
