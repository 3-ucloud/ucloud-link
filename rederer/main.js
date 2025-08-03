
function formatSize(bytes) {
  if (bytes > 1e9) return (bytes/1e9).toFixed(1)+' GB';
  if (bytes > 1e6) return (bytes/1e6).toFixed(1)+' MB';
  if (bytes > 1e3) return (bytes/1e3).toFixed(1)+' KB';
  return bytes + ' B';
}
function formatTime(ms) {
  const dt = new Date(ms);
  return dt.toLocaleString();
}
function renderTable(files) {
  const tbody = document.getElementById('file-rows');
  tbody.innerHTML = '';
  files.forEach(f => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${f.name}</td>
      <td>${formatSize(f.size)}</td>
      <td>${formatTime(f.mtime)}</td>
      <td>${f.hash}</td>`;
    tbody.appendChild(row);
  });
}
window.ucloud.listFiles().then(renderTable);
window.ucloud.onFilesIndex(renderTable);
document.getElementById('refresh').onclick = () => {
  document.getElementById('status').textContent = 'Syncing...';
  window.ucloud.scanFiles();
};
