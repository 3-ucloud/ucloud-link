const express = require('express');
const chokidar = require('chokidar');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { parentPort } = require('worker_threads');

const SYNC_PATH = process.env.U_CLOUD_SYNC_PATH;
const INDEX_PATH = process.env.U_CLOUD_INDEX_PATH;
const STATE = { files: [], paused: false, watcher: null };

function sha25610(fp) {
  return new Promise((resolve) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(fp);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex').slice(0, 10)));
    stream.on('error', () => resolve(''));
  });
}
async function scanFiles() {
  const files = [];
  const items = await fs.readdir(SYNC_PATH);
  for (const name of items) {
    const full = path.join(SYNC_PATH, name);
    const stat = await fs.stat(full);
    if (stat.isFile()) {
      files.push({
        name,
        size: stat.size,
        mtime: stat.mtimeMs,
        hash: await sha25610(full)
      });
    }
  }
  STATE.files = files;
  await fs.writeJson(INDEX_PATH, files);
  process.send && process.send({ type: 'files', files });
}
async function loadIndex() {
  try {
    STATE.files = await fs.readJson(INDEX_PATH);
  } catch { STATE.files = []; }
}
function notifyStatus(status) {
  process.send && process.send({ type: 'status', status });
}
function startWatch() {
  if (STATE.watcher) STATE.watcher.close();
  STATE.watcher = chokidar.watch(SYNC_PATH, { ignoreInitial: true });
  STATE.watcher
    .on('add', () => !STATE.paused && handleChange())
    .on('change', () => !STATE.paused && handleChange())
    .on('unlink', () => !STATE.paused && handleChange());
}
let scanDebounce;
function handleChange() {
  notifyStatus('sync');
  if (scanDebounce) clearTimeout(scanDebounce);
  scanDebounce = setTimeout(async () => {
    await scanFiles();
    notifyStatus('ok');
  }, 700);
}
process.on('message', async (msg) => {
  try { msg = typeof msg === 'string' ? JSON.parse(msg) : msg; } catch {}
  if (msg.type === 'list') process.send && process.send({ type: 'files', files: STATE.files });
  if (msg.type === 'scan') { await scanFiles(); notifyStatus('ok'); }
  if (msg.type === 'pause') { STATE.paused = true; }
  if (msg.type === 'resume') { STATE.paused = false; }
});
(async () => {
  await loadIndex();
  await scanFiles();
  startWatch();
  notifyStatus('ok');
})();
