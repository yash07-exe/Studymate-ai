# StudyMate AI: AI-Based Study Assistant for Personalized Learning

Runs on your own computer or server. The AI tutor, notes summarizer, quizzes, study plan and parent summary all work without Claude being open.

## What you need
- **Node.js 18 or newer** (https://nodejs.org). Check with `node -v`.
- **An Anthropic API key** from https://console.anthropic.com. API usage is billed separately from a Claude.ai subscription.

## Run it
1. Unzip this folder and open a terminal inside it.
2. Copy `.env.example` to `.env` and paste your key after `ANTHROPIC_API_KEY=`.
3. Start the server: `node server.js`
4. Open http://localhost:3000

No `npm install` is needed. The server has no dependencies.

If the key is missing, the app tells you on the AI screens. If the key is wrong, it says the key was rejected.

## Site blocking (focus mode)
1. Open `chrome://extensions` in Chrome, Edge or Brave and switch on Developer mode.
2. Click **Load unpacked** and choose the `extension` folder.
3. Reload http://localhost:3000, open Focus mode, and press **Check again**. The badge turns green.

If you installed an older copy of the extension before, press its reload icon.

## How it is built
- `public/index.html` is the whole front end (student panel, parent panel, focus timer).
- `server.js` serves the page and forwards AI requests to the Anthropic API. Your key stays on the server and is never sent to the browser.
- Answers from the tutor stream in live. The server limits each visitor to 30 AI requests per minute (change with `RATE_LIMIT_PER_MIN` in `.env`).
- `extension/` is the Chrome extension that blocks sites while a session runs.

## Putting it online
Use any host that runs Node (Render, Railway, Fly.io, a VPS). Set `ANTHROPIC_API_KEY` as an environment variable in the host's dashboard, use `node server.js` as the start command, and never put the key in the front-end code.

## Known limits of this prototype
- Accounts and progress are saved in each visitor's own browser (localStorage), so a parent and child on different devices cannot yet see each other's data. A shared database and real logins are the next step.
- Anyone who can open your hosted site can use your API key through the server. Add real logins before sharing a public link widely.
- PDF upload is not included. Paste text or load a .txt file.
