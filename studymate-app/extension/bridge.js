// Runs inside the StudyMate web page and connects it to the extension.
// It only activates on pages that contain <meta name="studymate-app">, so it
// works wherever StudyMate is opened (Claude, localhost, your own domain, a local file).
(function () {
  const post = m => window.postMessage(Object.assign({ source: 'studymate-ext' }, m), '*');
  function init() {
    if (!document.querySelector('meta[name="studymate-app"]')) return;
    window.addEventListener('message', async e => {
      if (e.source !== window) return;
      const d = e.data;
      if (!d || d.source !== 'studymate-web') return;
      try {
        if (d.type === 'PING') post({ type: 'READY' });
        if (d.type === 'START') {
          await chrome.runtime.sendMessage({ type: 'START', domains: d.domains, endsAt: d.endsAt });
          post({ type: 'READY' });
        }
        if (d.type === 'STOP') {
          const r = await chrome.runtime.sendMessage({ type: 'STOP' });
          post({ type: 'STOPPED', sessionId: d.sessionId, attempts: (r && r.attempts) || 0 });
        }
      } catch (err) { /* extension was reloaded; ignore */ }
    });
    chrome.storage.onChanged.addListener((c, area) => {
      if (area === 'local' && c.session && c.session.newValue) post({ type: 'BLOCKED', attempts: c.session.newValue.attempts });
    });
    post({ type: 'READY' });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
