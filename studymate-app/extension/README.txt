StudyMate Focus Blocker (Chrome / Edge / Brave, Manifest V3)

Install
1. Open chrome://extensions
2. Turn on Developer mode (top right)
3. Click "Load unpacked" and choose this folder
4. Reload the StudyMate page. In Focus mode the badge turns green.

How it works
- StudyMate posts START / STOP messages; bridge.js passes them to background.js.
- background.js adds declarativeNetRequest redirect rules for your blocked sites
  and removes them when the timer ends (chrome.alarms) or you stop early.
- blocked.html is what you see when you open a blocked site.

Works wherever StudyMate is opened
- bridge.js activates only on pages that contain <meta name="studymate-app">.
- If you open the downloaded studymate.html from your computer, open the extension's
  Details page in chrome://extensions and switch on "Allow access to file URLs".
- Blocking never lasts longer than 3 hours, whatever a page requests.
