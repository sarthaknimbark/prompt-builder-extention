(function () {
  const db = window.PromptForgeDb;
  const templates = window.PROMPTFORGE_TEMPLATES;
  const config = window.PROMPTFORGE_CONFIG || {};
  const SECTION_TYPES = [
    "role",
    "context",
    "task",
    "constraints",
    "examples",
    "variables",
    "output_format",
    "custom"
  ];

  const state = {
    view: "dashboard",
    prompts: [],
    versions: [],
    testRuns: [],
    settings: {
      provider: "openai",
      apiMode: config.apiMode || "proxy",
      proxyEndpoint: config.proxyEndpoint || "",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      model: config.model || "llama-3.3-70b-versatile",
      apiKey: "",
      temperature: 0.4,
      maxTokens: 900
    },
    activePrompt: null,
    search: "",
    category: "All",
    testing: false,
    enhancing: false,
    lastTestResult: "",
    notice: ""
  };

  const app = document.getElementById("app");

  function uid(prefix) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  function now() {
    return new Date().toISOString();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function sectionTitle(type) {
    return type
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function hydrateTemplate(template) {
    const timestamp = now();
    return {
      id: uid("prompt"),
      title: template.title,
      description: template.description,
      category: template.category,
      persona: template.persona,
      tags: template.tags || [],
      sections: template.sections.map((section, index) => ({
        id: uid("section"),
        type: section.type,
        title: section.title || sectionTitle(section.type),
        content: section.content,
        required: Boolean(section.required),
        order: index
      })),
      compiled_prompt: "",
      favorite: false,
      created_at: timestamp,
      updated_at: timestamp
    };
  }

  function blankPrompt() {
    const timestamp = now();
    const sections = [
      { type: "role", title: "Role", content: "", required: true },
      { type: "context", title: "Context", content: "", required: true },
      { type: "task", title: "Task", content: "", required: true },
      { type: "constraints", title: "Constraints", content: "", required: false },
      { type: "output_format", title: "Output Format", content: "", required: true }
    ].map((section, index) => ({
      ...section,
      id: uid("section"),
      order: index
    }));

    return {
      id: uid("prompt"),
      title: "Untitled Prompt",
      description: "",
      category: "General",
      persona: "",
      tags: [],
      sections,
      compiled_prompt: "",
      favorite: false,
      created_at: timestamp,
      updated_at: timestamp
    };
  }

  function compilePrompt(prompt) {
    return prompt.sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .filter((section) => section.content.trim())
      .map((section) => `## ${section.title || sectionTitle(section.type)}\n${section.content.trim()}`)
      .join("\n\n");
  }

  function buildRetrievalPrompt(draft) {
    return `## Role
You are a retrieval-focused assistant that answers only after grounding the response in the most relevant available context.

## Original User Request
${draft}

## Retrieval Goal
Find information that directly helps answer the user's request. Expand the search with likely synonyms, related entities, product or feature names, dates, versions, locations, and domain-specific terms from the request.

## Retrieval Instructions
- Prefer authoritative, current, and specific sources over generic summaries.
- Retrieve enough context to compare claims, dates, definitions, requirements, and exceptions.
- Extract exact facts, constraints, examples, metrics, names, dates, and source references that affect the answer.
- If the request depends on a time period, version, jurisdiction, location, or audience, make that scope explicit before answering.

## Answering Rules
- Use the retrieved evidence to answer the original request, not just to describe the sources.
- Do not invent facts that are missing from the retrieved context.
- If sources conflict, explain the conflict and prefer the more authoritative or recent source.
- If retrieval does not provide enough evidence, state what is missing and ask the smallest necessary clarifying question.
- Keep the answer practical and focused on the user's goal.

## Output Format
Return:
1. Direct answer or recommendation.
2. Key evidence from retrieved context.
3. Important caveats, assumptions, or missing information.
4. Source references or citations when available.

## Quality Criteria
- Cover the main entities, constraints, and edge cases implied by the request.
- Include examples or comparisons when they help the user make a decision.
- Separate facts found in sources from assumptions or recommendations.`;
  }

  function extractVariables(text) {
    const matches = text.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g);
    return Array.from(new Set(Array.from(matches).map((match) => match[1])));
  }

  function declaredVariables(prompt) {
    const variableSection = prompt.sections.find((section) => section.type === "variables");
    if (!variableSection) return [];
    return extractVariables(variableSection.content).concat(
      variableSection.content
        .split(/[\n,]/)
        .map((item) => item.trim().replace(/^[-*]\s*/, ""))
        .filter(Boolean)
    );
  }

  function validatePrompt(prompt) {
    const warnings = [];
    const sectionsByType = Object.fromEntries(prompt.sections.map((section) => [section.type, section]));
    const compiled = compilePrompt(prompt);

    ["role", "task", "output_format"].forEach((type) => {
      if (!sectionsByType[type] || !sectionsByType[type].content.trim()) {
        warnings.push(`Add a ${sectionTitle(type).toLowerCase()} section so the model has clear guidance.`);
      }
    });

    if (sectionsByType.task && sectionsByType.task.content.trim().length > 0 && sectionsByType.task.content.trim().length < 24) {
      warnings.push("The task is very short. Add the exact action, target audience, and success criteria.");
    }

    if (!sectionsByType.constraints || !sectionsByType.constraints.content.trim()) {
      warnings.push("Add constraints for tone, scope, exclusions, or quality standards.");
    }

    const used = extractVariables(compiled);
    const declared = declaredVariables(prompt);
    const undeclared = used.filter((variable) => !declared.includes(variable));
    if (undeclared.length && sectionsByType.variables) {
      warnings.push(`Define these variables in the variables section: ${undeclared.join(", ")}.`);
    }

    if (/api[_ -]?key|secret|password|token/i.test(compiled)) {
      warnings.push("This prompt may contain secrets. Remove or mask sensitive values before testing.");
    }

    if (/concise/i.test(compiled) && /exhaustive|comprehensive/i.test(compiled)) {
      warnings.push("The prompt asks for both concise and exhaustive output. Clarify the expected depth.");
    }

    return warnings;
  }

  async function load() {
    const [prompts, versions, testRuns, settingsRows] = await Promise.all([
      db.all("prompts"),
      db.all("versions"),
      db.all("testRuns"),
      db.all("settings")
    ]);

    state.prompts = prompts.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    state.versions = versions.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    state.testRuns = testRuns.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    settingsRows.forEach((row) => {
      state.settings[row.key] = row.value;
    });

    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      try {
        const stored = await new Promise((resolve) => {
          chrome.storage.local.get(null, resolve);
        });
        Object.keys(stored).forEach((key) => {
          state.settings[key] = stored[key];
        });
      } catch (err) {
        console.error("Failed to load settings from chrome.storage.local", err);
      }
    }
  }

  async function savePrompt(prompt, changeNote) {
    const nextPrompt = {
      ...prompt,
      compiled_prompt: compilePrompt(prompt),
      updated_at: now()
    };

    await db.put("prompts", nextPrompt);
    const promptVersions = state.versions.filter((version) => version.prompt_id === nextPrompt.id);
    await db.put("versions", {
      id: uid("version"),
      prompt_id: nextPrompt.id,
      version_number: promptVersions.length + 1,
      sections_snapshot: clone(nextPrompt.sections),
      compiled_prompt_snapshot: nextPrompt.compiled_prompt,
      change_note: changeNote || "Saved prompt",
      created_at: now()
    });

    state.activePrompt = clone(nextPrompt);
    await load();
    state.notice = "Prompt saved.";
    render();
  }

  async function persistSetting(key, value) {
    state.settings[key] = value;
    await db.put("settings", { key, value });
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      try {
        await chrome.storage.local.set({ [key]: value });
      } catch (err) {
        console.error("Failed to save setting to chrome.storage.local", err);
      }
    }
  }

  function setView(view) {
    state.view = view;
    state.notice = "";
    render();
  }

  function editPrompt(prompt) {
    state.activePrompt = clone(prompt);
    state.lastTestResult = "";
    setView("builder");
  }

  function duplicateTemplate(templateId) {
    const template = templates.find((item) => item.id === templateId);
    state.activePrompt = hydrateTemplate(template);
    state.lastTestResult = "";
    setView("builder");
  }

  function updateActivePrompt(mutator) {
    state.activePrompt = clone(state.activePrompt || blankPrompt());
    mutator(state.activePrompt);
    state.activePrompt.compiled_prompt = compilePrompt(state.activePrompt);
    render();
  }

  function filteredPrompts() {
    const term = state.search.trim().toLowerCase();
    return state.prompts.filter((prompt) => {
      const categoryMatch = state.category === "All" || prompt.category === state.category;
      const haystack = [
        prompt.title,
        prompt.description,
        prompt.category,
        prompt.persona,
        prompt.tags.join(" "),
        prompt.compiled_prompt
      ].join(" ").toLowerCase();
      return categoryMatch && (!term || haystack.includes(term));
    });
  }

  function categories() {
    return ["All", ...Array.from(new Set(state.prompts.map((prompt) => prompt.category).filter(Boolean))).sort()];
  }

  function nav() {
    const items = [
      ["dashboard", "Dashboard"],
      ["library", "Library"],
      ["builder", "Builder"],
      ["templates", "Templates"],
      ["settings", "Settings"]
    ];

    return `
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-title">PromptForge</div>
          <div class="brand-subtitle">Structured prompt builder</div>
        </div>
        <nav class="nav">
          ${items.map(([id, label]) => `<button class="${state.view === id ? "active" : ""}" data-view="${id}" type="button">${label}</button>`).join("")}
        </nav>
      </aside>
    `;
  }

  function shell(content) {
    app.innerHTML = `
      <div class="shell">
        ${nav()}
        <main class="workspace">
          <header class="topbar">
            <div>
              <p class="eyebrow">Chrome/Edge MVP</p>
              <h1>${pageTitle()}</h1>
            </div>
            <div class="toolbar">
              <button class="secondary-button" data-action="new-prompt" type="button">New Prompt</button>
              <button class="primary-button" data-view="templates" type="button">Use Template</button>
            </div>
          </header>
          <section class="content">${content}</section>
        </main>
      </div>
    `;
  }

  function pageTitle() {
    return {
      dashboard: "Dashboard",
      library: "Prompt Library",
      builder: "Visual Builder",
      templates: "Template Library",
      settings: "Settings"
    }[state.view];
  }

  function renderDashboard() {
    const recent = state.prompts.slice(0, 4);
    const runCount = state.testRuns.length;
    shell(`
      <div class="page">
        ${state.notice ? `<div class="success">${escapeHtml(state.notice)}</div>` : ""}
        <div class="grid">
          <article class="panel"><p class="eyebrow">Saved</p><h2>${state.prompts.length} prompts</h2><p class="muted">Local-first library stored in IndexedDB.</p></article>
          <article class="panel"><p class="eyebrow">Templates</p><h2>${templates.length} starters</h2><p class="muted">Email, code, analysis, support, and creative examples.</p></article>
          <article class="panel"><p class="eyebrow">Tests</p><h2>${runCount} runs</h2><p class="muted">Responses, settings, and ratings are tracked locally.</p></article>
        </div>
        <div class="page-header">
          <div>
            <h2>Recent Prompts</h2>
            <p class="muted">Open a prompt to refine, test, version, or export it.</p>
          </div>
        </div>
        <div class="list">
          ${recent.length ? recent.map(promptCard).join("") : `<div class="empty">No prompts yet. Start from a template or create a blank prompt.</div>`}
        </div>
      </div>
    `);
  }

  function promptCard(prompt) {
    return `
      <article class="card">
        <div class="card-row">
          <div>
            <h3>${escapeHtml(prompt.title)}</h3>
            <p class="muted">${escapeHtml(prompt.description || "No description")}</p>
          </div>
          <span class="badge">${escapeHtml(prompt.category || "General")}</span>
        </div>
        <p class="muted">${escapeHtml((prompt.tags || []).join(", ") || "No tags")}</p>
        <div class="toolbar">
          <button class="primary-button" data-edit="${prompt.id}" type="button">Open</button>
          <button class="secondary-button" data-export="${prompt.id}" data-format="markdown" type="button">Export MD</button>
          <button class="secondary-button" data-export="${prompt.id}" data-format="json" type="button">Export JSON</button>
        </div>
      </article>
    `;
  }

  function renderLibrary() {
    const prompts = filteredPrompts();
    shell(`
      <div class="page">
        <div class="toolbar">
          <input class="input" style="max-width: 420px" data-search value="${escapeHtml(state.search)}" placeholder="Search title, tags, category, or prompt text">
          <select class="select" style="max-width: 220px" data-category>
            ${categories().map((category) => `<option ${category === state.category ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}
          </select>
        </div>
        <div class="list">
          ${prompts.length ? prompts.map(promptCard).join("") : `<div class="empty">No prompts match this search.</div>`}
        </div>
      </div>
    `);
  }

  function renderTemplates() {
    shell(`
      <div class="page">
        <div class="page-header">
          <div>
            <h2>Starter Templates</h2>
            <p class="muted">Duplicate one into the builder, then customize it for your workflow.</p>
          </div>
        </div>
        <div class="grid">
          ${templates.map((template) => `
            <article class="card">
              <div class="card-row">
                <div>
                  <h3>${escapeHtml(template.title)}</h3>
                  <p class="muted">${escapeHtml(template.description)}</p>
                </div>
                <span class="badge">${escapeHtml(template.category)}</span>
              </div>
              <p class="muted">${escapeHtml(template.persona)} · ${escapeHtml(template.tags.join(", "))}</p>
              <button class="primary-button" data-template="${template.id}" type="button">Use Template</button>
            </article>
          `).join("")}
        </div>
      </div>
    `);
  }

  function renderBuilder() {
    if (!state.activePrompt) {
      state.activePrompt = blankPrompt();
    }

    const prompt = state.activePrompt;
    const warnings = validatePrompt(prompt);
    const promptVersions = state.versions.filter((version) => version.prompt_id === prompt.id);
    const promptRuns = state.testRuns.filter((run) => run.prompt_id === prompt.id).slice(0, 5);

    shell(`
      <div class="two-column">
        <div class="page">
          ${state.notice ? `<div class="success">${escapeHtml(state.notice)}</div>` : ""}
          <section class="panel">
            <div class="grid">
              <label>Title<input class="input" data-prompt-field="title" value="${escapeHtml(prompt.title)}"></label>
              <label>Category<input class="input" data-prompt-field="category" value="${escapeHtml(prompt.category)}"></label>
              <label>Tags<input class="input" data-prompt-field="tags" value="${escapeHtml((prompt.tags || []).join(", "))}"></label>
            </div>
            <label>Description<textarea class="textarea" data-prompt-field="description">${escapeHtml(prompt.description)}</textarea></label>
          </section>
          <section class="list">
            ${prompt.sections.slice().sort((a, b) => a.order - b.order).map(sectionEditor).join("")}
          </section>
          <div class="toolbar">
            <button class="secondary-button" data-action="add-section" type="button">Add Section</button>
            <button class="secondary-button" data-action="enhance-prompt" type="button">${state.enhancing ? "Enhancing..." : "Enhance with LLM"}</button>
            <button class="primary-button" data-action="save-prompt" type="button">Save Version</button>
          </div>
        </div>
        <aside class="page">
          <section class="panel">
            <h2>Validation</h2>
            <div class="list" style="margin-top: 12px">
              ${warnings.length ? warnings.map((warning) => `<div class="warning">${escapeHtml(warning)}</div>`).join("") : `<div class="success">Prompt includes the core role, task, constraints, and output format signals.</div>`}
            </div>
          </section>
          <section class="panel">
            <div class="card-row">
              <h2>Compiled Prompt</h2>
              <button class="secondary-button" data-copy-compiled type="button">Copy</button>
            </div>
            <div class="compiled">${escapeHtml(compilePrompt(prompt) || "Add content to compile the prompt.")}</div>
          </section>
          <section class="panel">
            <h2>Live Test</h2>
            <div class="list" style="margin-top: 12px">
              <div class="grid">
                <label>Model<input class="input" data-test-field="model" value="${escapeHtml(state.settings.model)}"></label>
                <label>Temperature<input class="input" type="number" step="0.1" min="0" max="2" data-test-field="temperature" value="${escapeHtml(state.settings.temperature)}"></label>
                <label>Max Tokens<input class="input" type="number" min="1" data-test-field="maxTokens" value="${escapeHtml(state.settings.maxTokens)}"></label>
              </div>
              <button class="primary-button" data-action="run-test" type="button">${state.testing ? "Testing..." : "Run Test"}</button>
              ${state.lastTestResult ? `<div class="compiled">${escapeHtml(state.lastTestResult)}</div>` : ""}
            </div>
          </section>
          <section class="panel">
            <h2>History</h2>
            <div class="list" style="margin-top: 12px">
              ${promptVersions.length ? promptVersions.slice(0, 5).map((version) => `<article class="card"><strong>Version ${version.version_number}</strong><p class="muted">${escapeHtml(version.change_note)} · ${new Date(version.created_at).toLocaleString()}</p><button class="secondary-button" data-restore="${version.id}" type="button">Restore</button></article>`).join("") : `<p class="muted">Save the prompt to create the first version.</p>`}
            </div>
          </section>
          <section class="panel">
            <h2>Recent Test Runs</h2>
            <div class="list" style="margin-top: 12px">
              ${promptRuns.length ? promptRuns.map((run) => `<article class="card"><strong>${escapeHtml(run.model)}</strong><p class="muted">${new Date(run.created_at).toLocaleString()}</p><p>${escapeHtml(run.response.slice(0, 160))}${run.response.length > 160 ? "..." : ""}</p></article>`).join("") : `<p class="muted">No test runs saved for this prompt.</p>`}
            </div>
          </section>
        </aside>
      </div>
    `);
  }

  function sectionEditor(section) {
    return `
      <article class="section-editor" draggable="true" data-section="${section.id}">
        <div class="section-header">
          <select class="select" data-section-field="type" data-section-id="${section.id}">
            ${SECTION_TYPES.map((type) => `<option value="${type}" ${section.type === type ? "selected" : ""}>${sectionTitle(type)}</option>`).join("")}
          </select>
          <input class="input" data-section-field="title" data-section-id="${section.id}" value="${escapeHtml(section.title)}">
          <label><input type="checkbox" data-section-field="required" data-section-id="${section.id}" ${section.required ? "checked" : ""}> Required</label>
          <button class="danger-button" data-delete-section="${section.id}" type="button">Remove</button>
        </div>
        <textarea class="textarea" data-section-field="content" data-section-id="${section.id}" placeholder="Write ${escapeHtml(sectionTitle(section.type).toLowerCase())} guidance here.">${escapeHtml(section.content)}</textarea>
        <div class="toolbar">
          <button class="secondary-button" data-move-section="${section.id}" data-direction="up" type="button">Move Up</button>
          <button class="secondary-button" data-move-section="${section.id}" data-direction="down" type="button">Move Down</button>
        </div>
      </article>
    `;
  }

  function renderSettings() {
    shell(`
      <div class="page">
        <section class="panel settings-grid">
          <label>Provider
            <select class="select" data-setting="provider">
              <option value="openai" ${state.settings.provider === "openai" ? "selected" : ""}>OpenAI-compatible</option>
            </select>
          </label>
          <label>API Mode
            <select class="select" data-setting="apiMode">
              <option value="proxy" ${state.settings.apiMode === "proxy" ? "selected" : ""}>Hosted backend proxy for all users</option>
              <option value="direct" ${state.settings.apiMode === "direct" ? "selected" : ""}>Direct user API key</option>
            </select>
          </label>
          <label>Backend Proxy URL<input class="input" data-setting="proxyEndpoint" value="${escapeHtml(state.settings.proxyEndpoint)}" placeholder="https://your-domain.com/api/chat"></label>
          <label>API Endpoint<input class="input" data-setting="endpoint" value="${escapeHtml(state.settings.endpoint)}"></label>
          <label>Default Model<input class="input" data-setting="model" value="${escapeHtml(state.settings.model)}"></label>
          <label>API Key<input class="input" data-setting="apiKey" type="password" value="${escapeHtml(state.settings.apiKey)}" placeholder="sk-..."></label>
          <p class="muted">Use Hosted backend proxy when you want the extension to work on every user's device without exposing your API key. Direct user API key is only for private local testing.</p>
        </section>
      </div>
    `);
  }

  function render() {
    if (state.view === "dashboard") renderDashboard();
    if (state.view === "library") renderLibrary();
    if (state.view === "builder") renderBuilder();
    if (state.view === "templates") renderTemplates();
    if (state.view === "settings") renderSettings();
  }

  async function exportPrompt(promptId, format) {
    const prompt = state.prompts.find((item) => item.id === promptId);
    if (!prompt) return;

    let payload = "";
    let mime = "text/plain";
    let extension = "txt";

    if (format === "json") {
      payload = JSON.stringify(prompt, null, 2);
      mime = "application/json";
      extension = "json";
    } else if (format === "markdown") {
      payload = `# ${prompt.title}\n\n${prompt.description || ""}\n\n${prompt.compiled_prompt || compilePrompt(prompt)}\n`;
      mime = "text/markdown";
      extension = "md";
    } else {
      payload = prompt.compiled_prompt || compilePrompt(prompt);
    }

    const blob = new Blob([payload], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${prompt.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "prompt"}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function sendChatRequest(messages, signal) {
    const payload = {
      model: state.settings.model,
      messages,
      temperature: Number(state.settings.temperature),
      max_tokens: Number(state.settings.maxTokens)
    };

    if (state.settings.apiMode === "proxy") {
      const endpoint = state.settings.proxyEndpoint;
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        return new Promise((resolve, reject) => {
          if (signal?.aborted) {
            reject(new DOMException("The request was aborted.", "AbortError"));
            return;
          }
          const abort = () => reject(new DOMException("The request was aborted.", "AbortError"));
          signal?.addEventListener("abort", abort, { once: true });

          chrome.runtime.sendMessage(
            {
              type: "PROMPTFORGE_CHAT_COMPLETION",
              endpoint,
              payload
            },
            (result) => {
              signal?.removeEventListener("abort", abort);
              const runtimeError = chrome.runtime.lastError;
              if (runtimeError) {
                reject(new Error(runtimeError.message));
                return;
              }
              resolve({
                ok: result.ok,
                status: result.status,
                json: async () => result.data
              });
            }
          );
        });
      }

      return fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal
      });
    }

    return fetch(state.settings.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.settings.apiKey}`
      },
      body: JSON.stringify(payload),
      signal
    });
  }

  async function runTest() {
    if (!state.activePrompt || state.testing) return;
    const compiled = compilePrompt(state.activePrompt);
    if (!compiled.trim()) {
      state.lastTestResult = "Add prompt content before testing.";
      render();
      return;
    }
    if (state.settings.apiMode === "direct" && !state.settings.apiKey) {
      state.lastTestResult = "Add an API key in Settings before running a live test.";
      render();
      return;
    }
    if (state.settings.apiMode === "proxy" && !state.settings.proxyEndpoint) {
      state.lastTestResult = "Add your hosted backend proxy URL in Settings before running a live test.";
      render();
      return;
    }

    state.testing = true;
    state.lastTestResult = "";
    render();

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);

    try {
      const response = await sendChatRequest([{ role: "user", content: compiled }], controller.signal);

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || `API request failed with ${response.status}`);
      }

      const output = data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2);
      state.lastTestResult = output;
      const savedPrompt = state.prompts.find((prompt) => prompt.id === state.activePrompt.id);
      if (savedPrompt) {
        await db.put("testRuns", {
          id: uid("run"),
          prompt_id: state.activePrompt.id,
          version_id: state.versions.find((version) => version.prompt_id === state.activePrompt.id)?.id || "",
          model: state.settings.model,
          settings: {
            temperature: Number(state.settings.temperature),
            max_tokens: Number(state.settings.maxTokens)
          },
          input_variables: {},
          response: output,
          rating: 0,
          created_at: now()
        });
        await load();
      }
    } catch (error) {
      state.lastTestResult = error.name === "AbortError" ? "The API request timed out after 30 seconds." : error.message;
    } finally {
      window.clearTimeout(timeout);
      state.testing = false;
      render();
    }
  }

  function parseMarkdownToSections(markdown) {
    const lines = markdown.split(/\r?\n/);
    const sections = [];
    let currentSection = null;
    let currentContent = [];

    const headerRegex = /^(?:#|##|###)\s+(.+)$/;

    for (const line of lines) {
      const match = line.match(headerRegex);
      if (match) {
        if (currentSection) {
          currentSection.content = currentContent.join("\n").trim();
          sections.push(currentSection);
        }
        const title = match[1].trim();
        // Try to match title with a section type
        const normalized = title.toLowerCase().replace(/[^a-z0-9]+/g, "_");
        let type = "custom";
        if (SECTION_TYPES.includes(normalized)) {
          type = normalized;
        } else if (normalized === "output") {
          type = "output_format";
        }
        
        currentSection = {
          id: uid("section"),
          type,
          title,
          content: "",
          required: ["role", "context", "task", "output_format"].includes(type),
          order: sections.length
        };
        currentContent = [];
      } else {
        if (currentSection) {
          currentContent.push(line);
        } else if (line.trim()) {
          // If content appears before any header, create an initial custom section
          currentSection = {
            id: uid("section"),
            type: "custom",
            title: "Introduction",
            content: "",
            required: false,
            order: 0
          };
          currentContent.push(line);
        }
      }
    }

    if (currentSection) {
      currentSection.content = currentContent.join("\n").trim();
      sections.push(currentSection);
    }

    // If no sections were parsed at all, return a single custom section
    if (sections.length === 0) {
      sections.push({
        id: uid("section"),
        type: "custom",
        title: "Enhanced Prompt",
        content: markdown.trim(),
        required: true,
        order: 0
      });
    }

    return sections;
  }

  async function enhancePrompt() {
    if (!state.activePrompt || state.enhancing) return;
    const compiled = compilePrompt(state.activePrompt);
    if (!compiled.trim()) {
      state.notice = "Add prompt content before enhancing.";
      render();
      return;
    }
    if (state.settings.apiMode === "direct" && !state.settings.apiKey) {
      state.notice = "Add an API key in Settings before enhancing prompts.";
      render();
      return;
    }
    if (state.settings.apiMode === "proxy" && !state.settings.proxyEndpoint) {
      state.notice = "Add your hosted backend proxy URL in Settings before enhancing prompts.";
      render();
      return;
    }

    state.enhancing = true;
    state.notice = "";
    render();

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);

    try {
      const response = await sendChatRequest([
        {
          role: "system",
          content: "You improve prompts for retrieval-augmented LLM workflows. Return only the rewritten prompt, no commentary. Preserve the user's original intent and add concrete retrieval guidance, source preferences, evidence requirements, ambiguity handling, constraints, and an output format. Do not return only a system instruction."
        },
        {
          role: "user",
          content: `Rewrite this into a complete retrieval-ready prompt for reliable LLM output.

The improved prompt should include:
- Role and objective.
- Original user goal.
- Retrieval/search guidance with keywords, synonyms, entities, dates, versions, locations, or domain terms to look for when they can be inferred.
- Preferred source or document types.
- Evidence that must be extracted from retrieved context.
- Rules for missing, stale, ambiguous, or conflicting evidence.
- Constraints for accuracy and scope.
- A clear output format with citations or source references when available.

Prompt to improve:

${compiled}`
        }
      ], controller.signal);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || `API request failed with ${response.status}`);
      }

      const enhanced = data.choices?.[0]?.message?.content || "";
      if (!enhanced.trim()) {
        throw new Error("The model returned an empty enhancement.");
      }

      updateActivePrompt((prompt) => {
        prompt.sections = parseMarkdownToSections(enhanced.trim());
        prompt.description = prompt.description || "Enhanced with PromptForge.";
      });
      state.notice = "Prompt enhanced. Review and save it as a new version.";
    } catch (error) {
      updateActivePrompt((prompt) => {
        prompt.sections = parseMarkdownToSections(buildRetrievalPrompt(compiled));
        prompt.description = prompt.description || "Enhanced with PromptForge.";
      });
      state.notice = `LLM unavailable; applied structured enhancement locally. ${error.name === "AbortError" ? "Enhancement timed out after 30 seconds." : error.message}`;
    } finally {
      window.clearTimeout(timeout);
      state.enhancing = false;
      render();
    }
  }

  function wireEvents() {
    app.addEventListener("click", async (event) => {
      const target = event.target.closest("button");
      if (!target) return;

      if (target.dataset.view) setView(target.dataset.view);
      if (target.dataset.action === "new-prompt") {
        state.activePrompt = blankPrompt();
        state.lastTestResult = "";
        setView("builder");
      }
      if (target.dataset.action === "add-section") {
        updateActivePrompt((prompt) => {
          prompt.sections.push({
            id: uid("section"),
            type: "custom",
            title: "Custom",
            content: "",
            required: false,
            order: prompt.sections.length
          });
        });
      }
      if (target.dataset.action === "save-prompt") {
        await savePrompt(state.activePrompt, "Manual save");
      }
      if (target.dataset.action === "run-test") {
        await runTest();
      }
      if (target.dataset.action === "enhance-prompt") {
        await enhancePrompt();
      }
      if (target.dataset.template) duplicateTemplate(target.dataset.template);
      if (target.dataset.edit) {
        const prompt = state.prompts.find((item) => item.id === target.dataset.edit);
        if (prompt) editPrompt(prompt);
      }
      if (target.dataset.export) await exportPrompt(target.dataset.export, target.dataset.format);
      if (target.dataset.deleteSection) {
        updateActivePrompt((prompt) => {
          prompt.sections = prompt.sections
            .filter((section) => section.id !== target.dataset.deleteSection)
            .map((section, index) => ({ ...section, order: index }));
        });
      }
      if (target.dataset.moveSection) {
        updateActivePrompt((prompt) => {
          const sections = prompt.sections.slice().sort((a, b) => a.order - b.order);
          const index = sections.findIndex((section) => section.id === target.dataset.moveSection);
          const nextIndex = target.dataset.direction === "up" ? index - 1 : index + 1;
          if (nextIndex < 0 || nextIndex >= sections.length) return;
          const [section] = sections.splice(index, 1);
          sections.splice(nextIndex, 0, section);
          prompt.sections = sections.map((item, order) => ({ ...item, order }));
        });
      }
      if (target.dataset.copyCompiled !== undefined) {
        await navigator.clipboard.writeText(compilePrompt(state.activePrompt));
        state.notice = "Compiled prompt copied.";
        render();
      }
      if (target.dataset.restore) {
        const version = state.versions.find((item) => item.id === target.dataset.restore);
        if (version) {
          updateActivePrompt((prompt) => {
            prompt.sections = clone(version.sections_snapshot);
            prompt.compiled_prompt = version.compiled_prompt_snapshot;
          });
        }
      }
    });

    app.addEventListener("input", async (event) => {
      const target = event.target;
      if (target.dataset.search !== undefined) {
        state.search = target.value;
        renderLibrary();
      }
      if (target.dataset.testField) {
        state.settings[target.dataset.testField] = target.value;
      }
      if (target.dataset.setting) {
        await persistSetting(target.dataset.setting, target.value);
      }
    });

    app.addEventListener("change", async (event) => {
      const target = event.target;
      if (target.dataset.category !== undefined) {
        state.category = target.value;
        renderLibrary();
      }
      if (target.dataset.promptField) {
        updateActivePrompt((prompt) => {
          if (target.dataset.promptField === "tags") {
            prompt.tags = target.value.split(",").map((tag) => tag.trim()).filter(Boolean);
          } else {
            prompt[target.dataset.promptField] = target.value;
          }
        });
      }
      if (target.dataset.sectionField) {
        updateActivePrompt((prompt) => {
          const section = prompt.sections.find((item) => item.id === target.dataset.sectionId);
          if (!section) return;
          if (target.dataset.sectionField === "required") {
            section.required = target.checked;
          } else {
            section[target.dataset.sectionField] = target.value;
          }
        });
      }
    });

    let draggedId = "";
    app.addEventListener("dragstart", (event) => {
      const section = event.target.closest("[data-section]");
      if (!section) return;
      draggedId = section.dataset.section;
      event.dataTransfer.effectAllowed = "move";
    });

    app.addEventListener("dragover", (event) => {
      if (event.target.closest("[data-section]")) {
        event.preventDefault();
      }
    });

    app.addEventListener("drop", (event) => {
      const section = event.target.closest("[data-section]");
      if (!section || !draggedId || section.dataset.section === draggedId) return;
      event.preventDefault();
      updateActivePrompt((prompt) => {
        const sections = prompt.sections.slice().sort((a, b) => a.order - b.order);
        const fromIndex = sections.findIndex((item) => item.id === draggedId);
        const toIndex = sections.findIndex((item) => item.id === section.dataset.section);
        const [moved] = sections.splice(fromIndex, 1);
        sections.splice(toIndex, 0, moved);
        prompt.sections = sections.map((item, order) => ({ ...item, order }));
      });
      draggedId = "";
    });
  }

  async function init() {
    wireEvents();
    await load();
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      try {
        const keys = ["apiMode", "proxyEndpoint", "model", "provider", "endpoint", "apiKey", "temperature", "maxTokens"];
        const toStore = {};
        keys.forEach((key) => {
          if (state.settings[key] !== undefined) {
            toStore[key] = state.settings[key];
          }
        });
        if (Object.keys(toStore).length > 0) {
          chrome.storage.local.set(toStore);
        }
      } catch (err) {
        console.error("Failed to initialize chrome.storage.local", err);
      }
    }
    render();
  }

  init().catch((error) => {
    app.innerHTML = `<main class="content"><div class="warning">${escapeHtml(error.message)}</div></main>`;
  });
})();
