# Prompt Builder — Project Docs

### Project Overview
* Local-first Chrome/Edge extension that injects a floating AI widget into LLM chat interfaces (ChatGPT, Claude, Gemini, Grok, Perplexity, etc.), enhancing user-typed prompts via a local Node.js proxy connected to the Groq LLM API. Includes a full prompt builder app for creating, versioning, and exporting structured prompts.

---

### Project Flow

1. **User opens a supported AI chat site** → content script auto-injects
2. **User clicks into the chat input** → green capsule widget appears beside Send button
3. **User clicks the widget** → draft text is captured from the input
4. **Content script sends message** to background service worker (bypasses CSP)
5. **Background worker POSTs** to `http://localhost:8787/api/chat`
6. **Proxy server** sanitizes payload, rate-limits, then calls Groq API securely
7. **Groq returns enhanced prompt** → proxy streams it back
8. **Content script injects** enhanced text back into the chat input field
9. **User can also open the Builder app** (via popup) to create structured prompts with sections, variables, versions, and test runs — all stored in IndexedDB locally

---

### Key Components

* **`manifest.json`** — Declares permissions, matched URLs, icons, content scripts, and web-accessible resources (Manifest V3)
* **`src/config.js`** — Sets default proxy endpoint and model; injected before content script
* **`src/content.js`** — Core injection script: detects editable inputs across all platforms, renders widget, sends enhancement requests, reinjects results
* **`src/content.css`** — Floating widget styles: glassmorphic capsule button, busy/success/failed state animations
* **`src/background.js`** — Service worker message relay: receives `PROMPTFORGE_CHAT_COMPLETION` messages and fetches the proxy (avoids page-level CSP blocks)
* **`backend/proxy-server.mjs`** — Node.js HTTP server on port `8787`; loads `.env`, sanitizes requests, rate-limits, and forwards to Groq API
* **`.env`** — Stores `GROQ_API_KEY`, `PORT`, `GROQ_MODEL`, rate limit config
* **`src/app.js`** — Full prompt builder SPA: prompt editor, section manager, variable compiler, version history, test runner, settings
* **`src/db.js`** — IndexedDB wrapper (`promptforge-builder` DB) for prompts, versions, test runs, settings
* **`src/templates.js`** — Starter prompt templates (email, code, analysis, creative, support)
* **`app.html` / `popup.html`** — Entry points for the builder app and toolbar popup
* **`icons/`** — Extension icons (SVG) + `logo.png` (3D glassy green capsule widget icon)
* **`scripts/package-extension.ps1`** — PowerShell script to zip extension files for distribution

---

### Supported Platforms

| Platform | URL |
|---|---|
| ChatGPT | chatgpt.com, chat.openai.com |
| Claude | claude.ai |
| Gemini | gemini.google.com |
| Grok | grok.com, x.com |
| Copilot | copilot.microsoft.com |
| Perplexity | perplexity.ai |
| DeepSeek | chat.deepseek.com |
| Meta AI | meta.ai |
| Mistral | chat.mistral.ai |
| Poe | poe.com |
| HuggingFace | huggingface.co |

---

### Local Setup

```bash
# 1. Clone & install
cd prompt-builder-extention

# 2. Configure API key
cp .env.example .env
# Edit .env → set GROQ_API_KEY=gsk_...

# 3. Start proxy (keep running)
npm run start:proxy

# 4. Load extension
# chrome://extensions → Developer Mode ON → Load unpacked → select project root

# 5. (Optional) Package for distribution
npm run package:extension   # outputs dist/promptforge-extension.zip
```

---

### Data Flow Diagram

```
Browser Tab (e.g. claude.ai)
  └── content.js (injected)
        └── chrome.runtime.sendMessage()
              └── background.js (service worker)
                    └── fetch("http://localhost:8787/api/chat")
                          └── proxy-server.mjs
                                └── fetch("https://api.groq.com/...")
                                      └── Groq LLM → enhanced prompt
```

---

### Environment Variables (`.env`)

| Key | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | required | Your Groq API key |
| `PORT` | `8787` | Proxy server port |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | LLM model |
| `GROQ_ENDPOINT` | Groq completions URL | Upstream API |
| `RATE_LIMIT_PER_MINUTE` | `30` | Max requests/min per IP |
| `ALLOWED_ORIGINS` | `*` | CORS allowed origins |

---

### Key Design Decisions

* **Local-first** — all prompt data in IndexedDB, no cloud sync
* **CSP bypass** — background service worker relays all fetch calls to avoid page-level Content Security Policy blocks
* **Platform-agnostic detection** — `PLATFORM_SELECTORS` map + `getEditableContainer()` + `MutationObserver` covers all editor types (textarea, contenteditable, Quill, ProseMirror)
* **No build step** — plain JS/CSS, load unpacked directly
* **Groq free tier** — 14,400 requests/day at no cost
