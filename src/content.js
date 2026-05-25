(function () {
  const config = window.PROMPTFORGE_CONFIG || {};
  const state = {
    activeInput: null,
    button: null,
    panel: null,
    busy: false
  };

  const SUGGESTIONS = [
    {
      id: "enhance",
      title: "Enhance with LLM",
      description: "Rewrite this into a richer retrieval-ready prompt with source and evidence guidance."
    },
    {
      id: "structure",
      title: "Add prompt structure",
      description: "Turn the draft into a reusable retrieval-focused structured prompt."
    },
    {
      id: "concise",
      title: "Make it concise",
      description: "Shorten the prompt while keeping the goal and expected output clear."
    },
    {
      id: "detailed",
      title: "Make it detailed",
      description: "Add context, retrieval requirements, examples, constraints, and quality criteria."
    }
  ];

  function isEditable(element) {
    if (!element) return false;
    if (element.tagName === "TEXTAREA") return true;
    if (element.tagName === "INPUT" && ["text", "search"].includes(element.type)) return true;
    return element.isContentEditable || element.getAttribute("contenteditable") === "true";
  }

  function getText(element) {
    if (!element) return "";
    if ("value" in element) return element.value || "";
    return element.innerText || element.textContent || "";
  }

  function setText(element, value) {
    if (!element) return;
    element.focus();
    if ("value" in element) {
      element.value = value;
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    element.textContent = value;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  }

  function createButton() {
    const button = document.createElement("button");
    button.className = "promptforge-assist-button";
    button.type = "button";
    button.textContent = "PF";
    button.title = "PromptForge suggestions";
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", togglePanel);
    document.documentElement.appendChild(button);
    state.button = button;
  }

  function createPanel() {
    const panel = document.createElement("section");
    panel.className = "promptforge-panel";
    panel.innerHTML = `
      <div class="promptforge-panel-header">
        <div class="promptforge-panel-title">
          <strong>PromptForge</strong>
          <span>Prompt suggestions</span>
        </div>
        <button class="promptforge-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="promptforge-panel-body">
        ${SUGGESTIONS.map((item) => `
          <button class="promptforge-action" data-promptforge-action="${item.id}" type="button">
            <strong>${item.title}</strong>
            <span>${item.description}</span>
          </button>
        `).join("")}
        <div class="promptforge-status" hidden></div>
      </div>
    `;
    panel.querySelector(".promptforge-close").addEventListener("click", hidePanel);
    panel.querySelectorAll("[data-promptforge-action]").forEach((button) => {
      button.addEventListener("click", () => applySuggestion(button.dataset.promptforgeAction));
    });
    document.documentElement.appendChild(panel);
    state.panel = panel;
  }

  function ensureUi() {
    if (!state.button) createButton();
    if (!state.panel) createPanel();
  }

  function positionUi() {
    if (!state.activeInput || !state.button) return;
    const rect = state.activeInput.getBoundingClientRect();
    const left = Math.min(window.innerWidth - 48, Math.max(8, rect.right - 44));
    const top = Math.min(window.innerHeight - 48, Math.max(8, rect.top - 46));
    state.button.style.left = `${left}px`;
    state.button.style.top = `${top}px`;

    if (state.panel && !state.panel.hidden) {
      const panelLeft = Math.min(window.innerWidth - 392, Math.max(12, rect.right - 380));
      const panelTop = Math.min(window.innerHeight - 360, Math.max(12, rect.top - 350));
      state.panel.style.left = `${panelLeft}px`;
      state.panel.style.top = `${panelTop}px`;
    }
  }

  function showButtonFor(input) {
    state.activeInput = input;
    ensureUi();
    state.button.hidden = false;
    positionUi();
  }

  function hidePanel() {
    if (state.panel) state.panel.hidden = true;
  }

  function togglePanel() {
    ensureUi();
    state.panel.hidden = !state.panel.hidden;
    positionUi();
  }

  function setStatus(message, isError = false) {
    const status = state.panel?.querySelector(".promptforge-status");
    if (!status) return;
    status.hidden = !message;
    status.textContent = message || "";
    status.classList.toggle("error", Boolean(isError));
  }

  function localRewrite(text, action) {
    const trimmed = text.trim();
    if (action === "concise") {
      return `Rewrite this as a clear, concise retrieval prompt. Keep the user's goal, required evidence, constraints, and expected output explicit:\n\n${trimmed}`;
    }
    if (action === "detailed") {
      return `Improve this prompt for a retrieval-augmented assistant.

Original request:
${trimmed}

Add the missing details needed for better retrieval:
- The exact user goal and decision to support.
- Key entities, keywords, synonyms, time range, location, product names, versions, or domain terms to search for.
- The types of sources or documents that should be preferred.
- What evidence must be extracted from the retrieved context.
- How to handle missing, conflicting, or low-confidence evidence.
- A specific output format with citations or source references when available.`;
    }
    if (action === "structure") {
      return buildRetrievalPrompt(trimmed);
    }
    return trimmed;
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
4. Source references or citations when available.`;
  }

  async function applySuggestion(action) {
    if (state.busy || !state.activeInput) return;
    const text = getText(state.activeInput).trim();
    if (!text) {
      setStatus("Type a draft prompt first.", true);
      return;
    }

    if (action !== "enhance") {
      setText(state.activeInput, localRewrite(text, action));
      setStatus("Suggestion applied.");
      return;
    }

    if (!config.proxyEndpoint) {
      setStatus("Set proxyEndpoint in src/config.js before using LLM enhancement.", true);
      return;
    }

    state.busy = true;
    setStatus("Enhancing prompt...");
    try {
      const response = await fetch(config.proxyEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model || "llama-3.3-70b-versatile",
          temperature: 0.3,
          max_tokens: 900,
          messages: [
            {
              role: "system",
              content: "Rewrite user drafts into strong retrieval-augmented prompts. Return only the final improved prompt, no commentary. The prompt must preserve the user's original goal and add concrete retrieval guidance, source preferences, evidence requirements, ambiguity handling, constraints, and an output format. Do not return only a system instruction."
            },
            {
              role: "user",
              content: `Improve this draft into a complete retrieval-ready prompt. Make it useful for a retriever/RAG workflow by adding search terms, source requirements, evidence to extract, rules for missing or conflicting context, and a clear answer format:\n\n${text}`
            }
          ]
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || `Request failed with ${response.status}`);
      }
      const enhanced = data.choices?.[0]?.message?.content || "";
      if (!enhanced.trim()) throw new Error("Empty response from model.");
      setText(state.activeInput, enhanced.trim());
      setStatus("Enhanced prompt applied.");
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      state.busy = false;
    }
  }

  function handleFocus(event) {
    const input = event.target;
    if (!isEditable(input)) return;
    const rect = input.getBoundingClientRect();
    if (rect.width < 180 || rect.height < 28) return;
    showButtonFor(input);
  }

  document.addEventListener("focusin", handleFocus, true);
  document.addEventListener("input", (event) => {
    if (event.target === state.activeInput) positionUi();
  }, true);
  window.addEventListener("scroll", positionUi, true);
  window.addEventListener("resize", positionUi);
})();
