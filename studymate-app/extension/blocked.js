let endsAt = 0;
const el = document.getElementById('left');
function draw() {
  const s = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  el.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
chrome.runtime.sendMessage({ type: 'ATTEMPT' }, r => { endsAt = (r && r.endsAt) || 0; draw(); });
setInterval(draw, 1000);
