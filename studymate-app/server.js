'use strict';
/*
 * StudyMate AI server (Google Gemini Version)
 * - Serves the web app from ./public
 * - Keeps your Gemini API key on the server and answers /api/ai requests
 * No npm packages needed. Requires Node.js 18 or newer.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

// Minimal .env loader (KEY=value per line)
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
} catch (e) { /* no .env file */ }

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash'
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MIN) || 30;
const PUBLIC = path.join(__dirname, 'public');
const MIME = { 
  '.html': 'text/html; charset=utf-8', 
  '.js': 'text/javascript; charset=utf-8', 
  '.css': 'text/css; charset=utf-8', 
  '.json': 'application/json', 
  '.png': 'image/png', 
  '.svg': 'image/svg+xml', 
  '.ico': 'image/x-icon', 
  '.txt': 'text/plain; charset=utf-8' 
};

const hits = new Map(); // ip -> timestamps (simple in-memory rate limit)
function limited(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 60000);
  list.push(now); hits.set(ip, list);
  return list.length > RATE_LIMIT;
}

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(obj));
}

function readBody(req, max = 300000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > max) { reject(new Error('too_large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Convert standard Chat JSON format into Gemini contents format
function cleanMessages(list) {
  if (!Array.isArray(list) || !list.length || list.length > 40) return null;
  const out = [];
  for (const m of list) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 40000) return null;
    
    // Convert 'assistant' role to Gemini's 'model' role
    const role = m.role === 'assistant' ? 'model' : 'user';
    const last = out[out.length - 1];
    
    // Gemini allows consecutive same-role parts or merged contents
    if (last && last.role === role) {
      last.parts[0].text += '\n\n' + m.content;
    } else {
      out.push({ role, parts: [{ text: m.content }] });
    }
  }
  
  // Ensure conversation starts with 'user'
  while (out.length && out[0].role !== 'user') out.shift();
  if (!out.length || out[out.length - 1].role !== 'user') return null;
  
  return out;
}

function upstreamError(status) {
  if (status === 401 || status === 403) return [502, 'auth_error'];
  if (status === 429) return [429, 'rate_limited'];
  return [502, 'upstream_error'];
}

async function handleAI(req, res) {
  if (!API_KEY) return send(res, 503, { code: 'no_key' });
  const ip = req.socket.remoteAddress || 'x';
  if (limited(ip)) return send(res, 429, { code: 'rate_limited' });
  
  let body;
  try { body = JSON.parse(await readBody(req)); } catch (e) { return send(res, 400, { code: 'bad_request' }); }
  
  const contents = cleanMessages(body.messages);
  if (!contents) return send(res, 400, { code: 'bad_request' });

  const systemPrompt = typeof body.system === 'string' ? body.system.slice(0, 8000) : '';
  const maxTokens = Math.min(4096, Math.max(64, Number(body.maxTokens) || 1200));
  const stream = body.stream === true;

  // Choose REST action based on streaming mode
  // Choose REST action based on streaming mode
 // Choose REST action based on streaming mode
 // Choose REST action based on streaming mode
const action = stream ? 'streamGenerateContent?alt=sse&key=' : 'generateContent?key=';
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${MODEL.startsWith('models/') ? MODEL : 'models/' + MODEL}:${action}${API_KEY}`;
  const geminiPayload = {
    contents: contents,
    generationConfig: {
      maxOutputTokens: maxTokens
    }
  };

  if (systemPrompt) {
    geminiPayload.systemInstruction = {
      parts: [{ text: systemPrompt }]
    };
  }

  const ctl = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ctl.abort(); });
  
  let up;
  try {
    up = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
      signal: ctl.signal
    });
  } catch (e) { return send(res, 502, { code: 'upstream_error' }); }

  if (!up.ok) {
    const [status, code] = upstreamError(up.status);
    console.error('Gemini API error', up.status, (await up.text().catch(() => '')).slice(0, 300));
    return send(res, status, { code });
  }

  // Non-Streaming Response Handling
  if (!stream) {
    const j = await up.json().catch(() => null);
    const text = j && j.candidates && j.candidates[0]?.content?.parts?.map(p => p.text).join('') || '';
    return text ? send(res, 200, { text }) : send(res, 502, { code: 'empty_completion' });
  }

  // Streaming (SSE) Handling
  res.writeHead(200, { 
    'Content-Type': 'text/event-stream', 
    'Cache-Control': 'no-cache', 
    'Connection': 'keep-alive', 
    'X-Accel-Buffering': 'no' 
  });

  const dec = new TextDecoder(); 
  let buf = '';

  try {
    for await (const chunk of up.body) {
      buf = (buf + dec.decode(chunk, { stream: true })).replace(/\r\n/g, '\n');
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const ev = buf.slice(0, i); 
        buf = buf.slice(i + 2);
        const line = ev.split('\n').find(l => l.startsWith('data:'));
        if (!line) continue;

        let j; 
        try { j = JSON.parse(line.slice(5).trim()); } catch (e) { continue; }
        
        // Extract text from Gemini candidate parts
        const textChunk = j.candidates && j.candidates[0]?.content?.parts?.map(p => p.text).join('');
        if (textChunk) {
          res.write('data: ' + JSON.stringify({ delta: textChunk }) + '\n\n');
        }
      }
    }
    res.write('data: [DONE]\n\n');
  } catch (e) { 
    if (!res.writableEnded) res.write('data: ' + JSON.stringify({ error: 'upstream_error' }) + '\n\n'); 
  }
  res.end();
}

function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true, aiConfigured: !!API_KEY, model: MODEL });
    if (url.pathname === '/api/ai' && req.method === 'POST') return await handleAI(req, res);
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
    res.writeHead(405); res.end();
  } catch (e) { console.error(e); if (!res.headersSent) send(res, 500, { code: 'server_error' }); else res.end(); }
});

server.listen(PORT, () => {
  console.log('StudyMate AI running at http://localhost:' + PORT);
  console.log(API_KEY ? 'AI: ready (model ' + MODEL + ')' : 'AI: NOT configured. Add GEMINI_API_KEY to the .env file and restart.');
});