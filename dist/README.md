# PromptForge Builder

PromptForge Builder is a local-first Chrome/Edge extension MVP for creating, validating, testing, versioning, and exporting structured AI prompts.

## What Is Implemented

- Manifest V3 browser extension shell
- Popup entry point that opens the full builder
- Template library with starter prompts for email, code, research, creative, support, and JSON extraction workflows
- Visual prompt builder with sections for role, context, task, constraints, examples, variables, output format, and custom content
- Drag-and-drop and button-based section reordering
- Rule-based validation for missing sections, vague tasks, undefined variables, conflicting instructions, and likely secrets
- IndexedDB persistence for prompts, versions, test runs, and settings
- Search and category filtering for saved prompts
- Version snapshots with restore support
- Export to Markdown, JSON, and plain text prompt content
- Live testing through the Groq OpenAI-compatible chat completions endpoint
- Hosted backend proxy mode so all users can use your API without seeing your key
- LLM prompt enhancement from the builder
- Grammarly-style prompt suggestion widget on supported AI chat pages

## Load Locally

1. Open Chrome or Edge.
2. Go to `chrome://extensions`.
3. Enable Developer mode.
4. Choose Load unpacked.
5. Select this project folder: `D:\prompt-builder-extention`.
6. Open the PromptForge extension and click Open Builder.

## Activate The Extension

For local testing, loading the unpacked folder activates the extension immediately. Pin it from the browser toolbar so users can open it quickly.

For real users, publish the extension through the Chrome Web Store or Microsoft Edge Add-ons. After installation, each user opens the extension, clicks Open Builder, and the app runs on their device with local IndexedDB storage.

## Groq API Setup

The extension has two API modes:

- Hosted backend proxy for all users: recommended for production.
- Direct user API key: useful only for private local testing.

### Recommended: Your API On Your Side

Run or deploy the included proxy server. Your Groq API key stays on the server, not inside the extension.

Create a `.env` file from the example:

```powershell
Copy-Item .env.example .env
```

Edit `.env`:

```env
GROQ_API_KEY=gsk-your-groq-api-key
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_ENDPOINT=https://api.groq.com/openai/v1/chat/completions
PORT=8787
RATE_LIMIT_PER_MINUTE=30
ALLOWED_ORIGINS=*
```

Start the proxy:

```powershell
npm run start:proxy
```

The local proxy URL is:

```text
http://localhost:8787/api/chat
```

For production, deploy `backend/proxy-server.mjs` to your server, set `GROQ_API_KEY`, and set `ALLOWED_ORIGINS` to your published extension origin when you know it:

```text
chrome-extension://your-extension-id
```

Then open PromptForge Settings and set:

- API Mode: `Hosted backend proxy for all users`
- Backend Proxy URL: `https://your-domain.com/api/chat`
- Model: your preferred Groq model

Before publishing, you can also preconfigure the URL in `src/config.js`:

```js
window.PROMPTFORGE_CONFIG = {
  apiMode: "proxy",
  proxyEndpoint: "https://your-domain.com/api/chat",
  model: "llama-3.3-70b-versatile"
};
```

### Local Direct-Key Testing

Open Settings in the extension and add:

- API endpoint, defaulting to `https://api.groq.com/openai/v1/chat/completions`
- Model, defaulting to `llama-3.3-70b-versatile`
- API key

Do not ship a direct API key inside the extension. Browser extension files can be inspected by users.

## Enhance Prompts With LLM

Open the Builder, create or load a prompt, then click Enhance with LLM. PromptForge sends the compiled prompt to the configured API mode and replaces the current sections with an improved prompt. Review it, then click Save Version.

## Chat Page Suggestions

PromptForge also injects a small `PF` assistant button on supported chat pages:

- ChatGPT
- Claude
- Gemini
- Microsoft Copilot
- Grok
- Perplexity

When the user focuses a chat input, the `PF` button appears near the input. Clicking it opens suggestions:

- Enhance with LLM
- Add prompt structure
- Make it concise
- Make it detailed

The LLM enhancement uses the production proxy URL from `src/config.js`. Before publishing for all users, set:

```js
window.PROMPTFORGE_CONFIG = {
  apiMode: "proxy",
  proxyEndpoint: "https://your-backend-domain.com/api/chat",
  model: "llama-3.3-70b-versatile"
};
```

## Deploy The Extension

### 1. Deploy The Backend Proxy

Deploy the Node server in `backend/proxy-server.mjs` to a host such as Render, Railway, Fly.io, DigitalOcean, AWS, or any VPS that supports Node 18+.

Required production environment variables:

```env
GROQ_API_KEY=gsk-your-real-key
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_ENDPOINT=https://api.groq.com/openai/v1/chat/completions
PORT=8787
RATE_LIMIT_PER_MINUTE=30
ALLOWED_ORIGINS=*
```

After the extension is published, replace `ALLOWED_ORIGINS=*` with:

```text
chrome-extension://your-extension-id
```

### 2. Configure The Extension For Production

Edit `src/config.js`:

```js
window.PROMPTFORGE_CONFIG = {
  apiMode: "proxy",
  proxyEndpoint: "https://your-backend-domain.com/api/chat",
  model: "llama-3.3-70b-versatile"
};
```

### 3. Test Locally Before Publishing

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this project folder.
5. Open PromptForge, create a prompt, and test Run Test and Enhance with LLM.

### 4. Package The Extension

Zip only the extension files, not `.env`, `.git`, or backend secrets. Include:

```text
app.html
popup.html
manifest.json
src/
icons/
README.md
```

Do not include:

```text
.env
.git/
backend/
node_modules/
```

### 5. Publish To Chrome Web Store

1. Create a Chrome Web Store Developer account.
2. Open the Developer Dashboard.
3. Click New Item.
4. Upload the extension zip.
5. Complete listing details, screenshots, privacy practices, and permissions explanation.
6. Submit for review.

### 6. Publish To Microsoft Edge Add-ons

1. Create a Microsoft Partner Center account.
2. Create a new Edge extension submission.
3. Upload the same extension zip.
4. Complete store listing, privacy details, and permission explanations.
5. Submit for certification.

## Project Structure

```text
manifest.json        Chrome/Edge extension manifest
popup.html           Small extension popup
app.html             Full builder interface
backend/             Optional API proxy server for production-style deployment
src/app.js           Main app state, rendering, validation, exports, and API testing
src/content.js       Grammarly-style prompt assistant for chat pages
src/content.css      Prompt assistant widget styling
src/db.js            IndexedDB helper
src/templates.js     Starter prompt templates
src/styles.css       Responsive UI styles
icons/               Extension icons
```

## Suggested Next Steps

- Add automated Playwright extension tests.
- Add a backend proxy for API calls and rate limiting.
- Add cloud sync and sharable links.
- Add AI-assisted prompt critique.
- Replace vanilla rendering with React/TypeScript when the UI grows beyond the MVP.
