// StudyMate Focus Blocker - service worker (Manifest V3)
const RULE_BASE = 1000;
const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/;

async function startBlock(domains, endsAt) {
  // Safety: never block for more than 3 hours, whatever a page asks for.
  endsAt = Math.min(Number(endsAt) || 0, Date.now() + 3 * 3600 * 1000);
  if (endsAt <= Date.now()) return;
  const clean = (domains || []).filter(d => typeof d === 'string' && DOMAIN_RE.test(d)).slice(0, 100);
  const addRules = clean.map((d, i) => ({
    id: RULE_BASE + i,
    priority: 1,
    action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } },
    condition: { requestDomains: [d], resourceTypes: ['main_frame'] }
  }));
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: old.map(r => r.id), addRules });
  await chrome.storage.local.set({ session: { endsAt, attempts: 0 } });
  chrome.alarms.create('studymate-end', { when: endsAt });
}

async function stopBlock() {
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: old.map(r => r.id) });
  await chrome.alarms.clear('studymate-end');
  const { session } = await chrome.storage.local.get('session');
  const attempts = session ? session.attempts : 0;
  await chrome.storage.local.remove('session');
  return attempts;
}

chrome.alarms.onAlarm.addListener(a => { if (a.name === 'studymate-end') stopBlock(); });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === 'START') { await startBlock(msg.domains, msg.endsAt); sendResponse({ ok: true }); }
    else if (msg.type === 'STOP') { sendResponse({ attempts: await stopBlock() }); }
    else if (msg.type === 'ATTEMPT') {
      const { session } = await chrome.storage.local.get('session');
      if (session) { session.attempts += 1; await chrome.storage.local.set({ session }); }
      sendResponse({ endsAt: session ? session.endsAt : 0 });
    } else sendResponse({});
  })();
  return true; // keep the channel open for the async reply
});
