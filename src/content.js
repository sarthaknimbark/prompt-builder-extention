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

  // Platform-specific selectors for the main prompt textarea on every supported LLM site
  const PLATFORM_SELECTORS = [
    // ChatGPT
    "#prompt-textarea",
    "[data-id='root'][contenteditable='true']",
    // Claude
    "[data-testid='chat-input']",
    "[contenteditable='true'][aria-label*='message']",
    "[contenteditable='true'][aria-label*='chat']",
    "[contenteditable='true'][aria-placeholder]",
    // Gemini
    "rich-textarea .ql-editor",
    ".input-area .ql-editor",
    ".prompt-box .ql-editor",
    ".query-text[contenteditable='true']",
    "[aria-label*='Gemini']",
    // Grok
    "textarea[placeholder*='message']",
    "textarea[placeholder*='Ask']",
    "textarea[placeholder*='prompt']",
    "textarea[data-testid*='input']",
    // Perplexity
    "textarea[placeholder*='Perplexity']",
    "textarea.resize-none",
    // Generic fallbacks
    "[contenteditable='true'][role='textbox']",
    "[contenteditable='true'][spellcheck='true']",
    "textarea:not([hidden]):not([aria-hidden='true'])"
  ];

  function getEditableContainer(element) {
    if (!element) return null;
    // Direct TEXTAREA or text INPUT → use as-is
    if (element.tagName === "TEXTAREA" || (element.tagName === "INPUT" && ["text", "search"].includes(element.type))) {
      return element;
    }
    // Element itself is contenteditable → walk up to root editable ancestor
    if (element.isContentEditable || element.getAttribute("contenteditable") === "true") {
      let root = element;
      while (root.parentElement && (root.parentElement.isContentEditable || root.parentElement.getAttribute("contenteditable") === "true")) {
        root = root.parentElement;
      }
      return root;
    }
    // Climb ancestors to find any editable parent
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
      if (parent.isContentEditable || parent.getAttribute("contenteditable") === "true") {
        let root = parent;
        while (root.parentElement && (root.parentElement.isContentEditable || root.parentElement.getAttribute("contenteditable") === "true")) {
          root = root.parentElement;
        }
        return root;
      }
      parent = parent.parentElement;
    }
    return null;
  }

  function probeForPromptInput() {
    for (const selector of PLATFORM_SELECTORS) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 0) return el;
        }
      } catch (e) { /* invalid selector on this page, skip */ }
    }
    return null;
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

  let tooltip = null;

  function createTooltip() {
    tooltip = document.createElement("div");
    tooltip.className = "promptforge-tooltip";
    tooltip.hidden = true;
    document.documentElement.appendChild(tooltip);
  }

  function showTooltip(message, isError = false, duration = 3000) {
    if (!tooltip) createTooltip();
    tooltip.textContent = message;
    tooltip.classList.toggle("error", isError);
    tooltip.hidden = false;

    // Position the tooltip right above the floating button
    if (state.button) {
      const rect = state.button.getBoundingClientRect();
      const tooltipLeft = Math.min(window.innerWidth - 220, Math.max(12, rect.left + rect.width / 2 - 90));
      const tooltipTop = Math.max(12, rect.top - 46);
      tooltip.style.left = `${tooltipLeft}px`;
      tooltip.style.top = `${tooltipTop}px`;
    }

    // Auto fade out
    if (state.tooltipTimeout) clearTimeout(state.tooltipTimeout);
    state.tooltipTimeout = setTimeout(() => {
      tooltip.hidden = true;
    }, duration);
  }

  const LOGO_URL = (typeof chrome !== "undefined" && chrome.runtime?.getURL)
    ? chrome.runtime.getURL("icons/logo.png")
    : "icons/logo.png";
  const LOGO_HTML = `<img src="${LOGO_URL}" style="width: 28px; height: 28px; display: block; border-radius: 50%;" alt="Prompt Builder">`;

  const WIZARD_HAT_SVG = `
    <div class="promptforge-magic-sphere">
      <div class="promptforge-sphere-ring ring-x"></div>
      <div class="promptforge-sphere-ring ring-y"></div>
      <div class="promptforge-sphere-ring ring-z"></div>
      <div class="promptforge-sphere-glow"></div>
      <div class="promptforge-hat-container">
        <svg viewBox="0 0 24 24" class="promptforge-hat-svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2 C10.5 6.5, 8.5 12, 6 15 C10 16.5, 14 16.5, 18 15 C15.5 12, 13.5 6.5, 12 2 Z" />
          <path d="M2 17 C6 20, 18 20, 22 17 C18 15.5, 6 15.5, 2 17 Z" fill="currentColor" fill-opacity="0.2" />
          <path d="M2 17 C6 20, 18 20, 22 17" />
          <path d="M6.3 14.5 C10 16, 14 16, 17.7 14.5" />
        </svg>
      </div>
    </div>
  `;

  const CHECKMARK_SVG = `
    <svg viewBox="0 0 24 24" class="promptforge-checkmark-svg" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  `;

  const WARNING_SVG = `
    <svg viewBox="0 0 24 24" class="promptforge-warning-svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  `;

  function createButton() {
    const button = document.createElement("button");
    button.className = "promptforge-assist-button";
    button.type = "button";
    button.innerHTML = LOGO_HTML;
    button.title = "Enhance with LLM";
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      if (state.busy) return;
      await applySuggestion("enhance");
    });
    document.documentElement.appendChild(button);
    state.button = button;
  }

  function ensureUi() {
    if (!state.button) createButton();
  }

  function findSendButton(activeInput) {
    if (!activeInput) return null;
    
    let container = activeInput.closest("form") || 
                    activeInput.closest("[class*='input']") || 
                    activeInput.closest("[class*='prompt']") || 
                    activeInput.closest("[class*='chat']") ||
                    activeInput.parentElement;
                    
    while (container && container !== document.body) {
      const buttons = Array.from(container.querySelectorAll("button"));
      
      const sendBtn = buttons.find(btn => {
        const label = (btn.getAttribute("aria-label") || btn.getAttribute("title") || btn.className || "").toLowerCase();
        if (label.includes("send") || label.includes("submit") || label.includes("prompt")) return true;
        
        const svg = btn.querySelector("svg");
        if (svg) {
          const svgHtml = svg.outerHTML.toLowerCase();
          if (svgHtml.includes("send") || svgHtml.includes("paper-plane") || svgHtml.includes("arrow") || svgHtml.includes("submit")) return true;
        }
        return false;
      });
      
      if (sendBtn) {
        const rect = sendBtn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return sendBtn;
      }
      
      const rightmost = buttons.reduce((best, btn) => {
        const r = btn.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.width > 80 || r.height > 80) return best;
        if (!best) return btn;
        const b = best.getBoundingClientRect();
        return r.right > b.right ? btn : best;
      }, null);
      
      if (rightmost) {
        return rightmost;
      }
      
      container = container.parentElement;
    }
    
    const inputRect = activeInput.getBoundingClientRect();
    const allButtons = Array.from(document.querySelectorAll("button"));
    const nearbySend = allButtons.find(btn => {
      const r = btn.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const isNearby = r.right > inputRect.right - 100 && r.right < inputRect.right + 100 &&
                       r.bottom > inputRect.bottom - 100 && r.bottom < inputRect.bottom + 100;
      if (!isNearby) return false;
      const label = (btn.getAttribute("aria-label") || btn.getAttribute("title") || btn.className || "").toLowerCase();
      return label.includes("send") || label.includes("submit") || btn.querySelector("svg");
    });
    
    return nearbySend || null;
  }

  function positionUi() {
    if (!state.activeInput || !state.button) return;
    
    const inputRect = state.activeInput.getBoundingClientRect();
    const sendBtn = findSendButton(state.activeInput);
    
    let left = 0;
    let top = 0;
    
    if (sendBtn) {
      const sendRect = sendBtn.getBoundingClientRect();
      left = sendRect.left - 42; 
      top = sendRect.top + (sendRect.height - 40) / 2;
    } else {
      left = Math.min(window.innerWidth - 48, Math.max(8, inputRect.right - 44));
      top = Math.min(window.innerHeight - 48, Math.max(8, inputRect.bottom - 44));
    }
    
    state.button.style.left = `${left}px`;
    state.button.style.top = `${top}px`;
  }

  function showButtonFor(input) {
    state.activeInput = input;
    ensureUi();
    state.button.hidden = false;
    positionUi();
  }

  function setStatus(message, isError = false) {
    if (message) {
      showTooltip(message, isError);
    }
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
You are an expert retrieval-focused AI assistant.

Answer only after grounding the response in the most relevant available context.

---

## Objective
Solve the user’s request accurately and efficiently.

## Active Request
${draft}

The request may involve:
* Coding
* Debugging
* AI/ML
* System design
* Research
* Mathematics
* Architecture
* Optimization
* Data analysis
* General reasoning

---

## Retrieval Strategy
Retrieve and prioritize:
* Authoritative sources
* Official documentation
* Recent and version-specific information
* Relevant frameworks, libraries, APIs, tools, and standards
* Edge cases, constraints, and implementation details
* Performance and scalability considerations
* Security and production best practices

Expand retrieval using:
* Synonyms
* Related technologies
* Version names
* Framework ecosystems
* Alternative implementations
* Domain-specific terminology

---

## Reasoning Rules
* Do not hallucinate facts
* Clearly separate facts from assumptions
* If information is insufficient, ask only the minimum required clarification
* Prefer practical implementation over theory
* For coding tasks:
  * Write production-quality code
  * Use modular structure
  * Add type hints
  * Include error handling
  * Optimize for readability and performance
* For AI/ML tasks:
  * Consider compute efficiency
  * Mention memory/GPU optimization when relevant
  * Warn about overfitting, leakage, or bad architecture choices

---

## Response Format
### 1. Direct Solution
* Clear and concise answer
* Step-by-step implementation if needed

### 2. Key Technical Insights
* Important concepts
* Trade-offs
* Performance considerations
* Architecture decisions

### 3. Caveats / Edge Cases
* Limitations
* Assumptions
* Security concerns
* Version compatibility

### 4. References
* Official docs
* Papers
* APIs
* Source links when available

---

## Output Style
* Use short sections
* Split topics into separate lines
* Avoid unnecessary explanation
* Prioritize clarity and efficiency
* Keep responses structured and easy to scan
* Use tables or bullets for comparisons
* For complex problems, think step-by-step internally before answering`;
  }

  function enhancementErrorMessage(error) {
    if (error.name === "AbortError") return "The LLM request timed out.";
    if (/context invalidated/i.test(error.message || "")) {
      return "Extension was reloaded. Please refresh this webpage to reconnect.";
    }
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

  async function loadSettings() {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      try {
        const res = await chrome.storage.local.get(["proxyEndpoint", "model"]);
        if (res) {
          let proxyVal = res.proxyEndpoint;
          if (proxyVal && typeof proxyVal === "string" && (proxyVal.includes(":8789") || proxyVal.includes("promptforge-proxy.onrender.com"))) {
            proxyVal = "http://localhost:8787/api/chat";
            try {
              await chrome.storage.local.set({ proxyEndpoint: proxyVal });
            } catch (setErr) {
              console.warn("Failed to update proxyEndpoint in storage:", setErr);
            }
          }
          if (proxyVal) state.settings.proxyEndpoint = proxyVal;
          if (res.model) state.settings.model = res.model;
        }
      } catch (error) {
        console.warn("Failed to load settings from storage:", error);
        throw error;
      }
    }
  }

  async function applySuggestion(action) {
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
      setStatus("Extension was reloaded. Please refresh this webpage to reconnect.", true);
      return;
    }
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

    state.busy = true;
    if (state.button) {
      state.button.classList.add("busy");
      state.button.innerHTML = WIZARD_HAT_SVG;
    }

    setStatus("Enhancing prompt...");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    let endpoint = "";
    try {
      await loadSettings();

      endpoint = state.settings.proxyEndpoint || config.proxyEndpoint;
      if (!endpoint) {
        setStatus("Set Backend Proxy URL in Settings before using LLM enhancement.", true);
        state.busy = false;
        if (state.button) {
          state.button.classList.remove("busy");
          state.button.innerHTML = LOGO_HTML;
        }
        return;
      }

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

      // Success animation transition
      if (state.button) {
        state.button.classList.remove("busy");
        state.button.classList.add("success");
        state.button.innerHTML = CHECKMARK_SVG;
        setTimeout(() => {
          state.button.classList.remove("success");
          state.button.innerHTML = LOGO_HTML;
        }, 1500);
      }
    } catch (error) {
      const targetSuffix = endpoint ? ` (Target: ${endpoint})` : "";
      setStatus(`LLM enhancement failed: ${enhancementErrorMessage(error)}${targetSuffix}`, true);

      // Failure animation transition
      if (state.button) {
        state.button.classList.remove("busy");
        state.button.classList.add("failed");
        state.button.innerHTML = WARNING_SVG;
        setTimeout(() => {
          state.button.classList.remove("failed");
          state.button.innerHTML = LOGO_HTML;
        }, 1500);
      }
    } finally {
      window.clearTimeout(timeout);
      state.busy = false;
    }
  }

  function handleFocus(event) {
    const target = event.target;
    // First try direct detection
    const container = getEditableContainer(target);
    if (container) {
      const rect = container.getBoundingClientRect();
      // Relaxed size gate: width > 100 and height > 0 (handles all platforms including Gemini)
      if (rect.width > 100 && rect.height > 0) {
        showButtonFor(container);
        return;
      }
    }
    // Fallback: use platform selector probe for this site
    const probed = probeForPromptInput();
    if (probed && probed !== state.activeInput) {
      showButtonFor(probed);
    }
  }

  // Watch for dynamic DOM changes and late-rendered editors (e.g. Gemini's Quill editor)
  let mutationProbeTimer = null;
  const observer = new MutationObserver(() => {
    if (mutationProbeTimer) return;
    mutationProbeTimer = setTimeout(() => {
      mutationProbeTimer = null;
      if (state.button && !state.button.hidden) return; // already visible
      const probed = probeForPromptInput();
      if (probed && probed !== state.activeInput) {
        // Only auto-activate if user already interacted with the page
        if (document.hasFocus()) {
          // Don't auto-show – wait for actual focus event
        }
      }
    }, 500);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener("focusin", handleFocus, true);
  
  // Also trigger on click inside known editable areas
  document.addEventListener("click", (event) => {
    if (!state.button) {
      // button not yet created – try to show on click on any input
      handleFocus(event);
      return;
    }
    const target = event.target;
    const isInsideInput = state.activeInput && state.activeInput.contains(target);
    const isInsideButton = state.button && state.button.contains(target);
    const isInsideTooltip = tooltip && tooltip.contains(target);

    if (isInsideButton || isInsideTooltip) return;

    // Check if click is on a different editable element
    const container = getEditableContainer(target);
    if (container) {
      const rect = container.getBoundingClientRect();
      if (rect.width > 100 && rect.height > 0) {
        showButtonFor(container);
        return;
      }
    }

    if (!isInsideInput) {
      state.button.hidden = true;
      if (tooltip) tooltip.hidden = true;
    }
  }, true);

  document.addEventListener("input", (event) => {
    if (state.activeInput && state.activeInput.contains(event.target)) {
      positionUi();
    } else {
      // Input happened in an element we're not tracking - try to activate
      handleFocus(event);
    }
  }, true);

  window.addEventListener("scroll", positionUi, true);
  window.addEventListener("resize", positionUi);
})();
