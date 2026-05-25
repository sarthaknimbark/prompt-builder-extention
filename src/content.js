(function () {
  const config = window.PROMPTFORGE_CONFIG || {};
  const state = {
    activeInput: null,
    button: null,
    panel: null,
    busy: false,
    settings: {
      proxyEndpoint: config.proxyEndpoint || "",
      model: config.model || "llama-3.3-70b-versatile"
    }
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
      const setter = Object.getOwnPropertyDescriptor(element.constructor.prototype, "value")?.set;
      if (setter) {
        setter.call(element, value);
      } else {
        element.value = value;
      }
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("insertText", false, value);
    if (getText(element).trim() !== value.trim()) {
      element.textContent = value;
    }
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
      return buildConcisePrompt(trimmed);
    }
    if (action === "detailed") {
      return buildDetailedPrompt(trimmed);
    }
    if (action === "structure") {
      return buildRetrievalPrompt(trimmed);
    }
    return trimmed;
  }

  function buildConcisePrompt(draft) {
    return `## Goal
${draft}

## Instructions
- Answer the request directly and optimally.
- Provide clean, efficient code or solutions without unnecessary fluff.
- Highlight key assumptions if any.

## Output Format
A concise, ready-to-use solution with explanation and code where applicable.`;
  }

  function buildDetailedPrompt(draft) {
    return `## Role
You are an expert technical consultant and senior engineer.

## Task
${draft}

## Instructions
- Analyze the problem from first principles.
- Design an optimal, scalable solution.
- Provide production-grade, well-commented code with complete implementations.
- List all potential edge cases, trade-offs, and optimization strategies.

## Output Format
1. **Architecture & Design**: High-level approach and reasoning.
2. **Code / Implementation**: Full, clean, and tested implementation.
3. **Validation & Edge Cases**: How edge cases and errors are resolved.
4. **Complexity & Alternatives**: Performance analysis and alternative design paths.`;
  }

  function buildRetrievalPrompt(draft) {
    return `## Role
You are an expert AI software engineer and advanced technical assistant.

## Objective
Help the user solve their request efficiently by providing clear, accurate, and optimal solutions.

## Task
${draft}

## Instructions
- Analyze the problem deeply and identify the most efficient algorithm, architecture, or approach.
- Provide clean, robust, and well-commented code if code is required.
- Handle edge cases, errors, and performance implications proactively.
- If more details or context are needed to provide a perfect solution, state the assumptions clearly.

## Output Format
1. **Solution Summary**: Brief explanation of the approach.
2. **Implementation**: Detailed solution (e.g. clean code block, proof, or step-by-step logic).
3. **Complexity & Edge Cases**: Brief analysis of performance and handling of edge cases.`;
  }

  function enhancementErrorMessage(error) {
    if (error.name === "AbortError") return "The LLM request timed out.";
    if (/failed to fetch|load failed|networkerror/i.test(error.message || "")) {
      return "The backend proxy is unreachable or blocked. Check src/config.js and make sure the proxy is deployed and serving /api/chat.";
    }
    return error.message || "The LLM request failed.";
  }

  function sendEnhancementRequest(endpoint, payload, signal) {
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
            endpoint: endpoint,
            payload
          },
          (result) => {
            signal?.removeEventListener("abort", abort);
            const runtimeError = chrome.runtime.lastError;
            if (runtimeError) {
              reject(new Error(runtimeError.message));
              return;
            }
            resolve(result);
          }
        );
      });
    }

    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify(payload)
    }).then(async (response) => ({
      ok: response.ok,
      status: response.status,
      data: await response.json()
    }));
  }

  function loadSettings() {
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.get(["proxyEndpoint", "model"], (res) => {
          if (res.proxyEndpoint) state.settings.proxyEndpoint = res.proxyEndpoint;
          if (res.model) state.settings.model = res.model;
          resolve();
        });
      } else {
        resolve();
      }
    });
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

    await loadSettings();

    const endpoint = state.settings.proxyEndpoint || config.proxyEndpoint;
    if (!endpoint) {
      setStatus("Set Backend Proxy URL in Settings before using LLM enhancement.", true);
      return;
    }

    state.busy = true;
    setStatus("Enhancing prompt...");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      const result = await sendEnhancementRequest(endpoint, {
        model: state.settings.model || config.model || "llama-3.3-70b-versatile",
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
      }, controller.signal);

      if (!result?.ok) {
        throw new Error(result?.data?.error?.message || `Request failed with ${result?.status || 0}`);
      }
      const enhanced = result.data?.choices?.[0]?.message?.content || "";
      if (!enhanced.trim()) {
        throw new Error("The model returned an empty enhancement.");
      }
      setText(state.activeInput, enhanced.trim());
      setStatus("Enhanced prompt applied.");
    } catch (error) {
      setText(state.activeInput, buildDetailedPrompt(text));
      setStatus(`Applied structured enhancement locally. ${enhancementErrorMessage(error)}`, true);
    } finally {
      window.clearTimeout(timeout);
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
