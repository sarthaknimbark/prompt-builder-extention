window.PROMPTFORGE_TEMPLATES = [
  {
    id: "tpl-email-campaign",
    title: "Campaign Email",
    description: "Write a conversion-focused campaign email.",
    category: "Email",
    persona: "Marketer",
    tags: ["email", "marketing", "conversion"],
    sections: [
      { type: "role", title: "Role", content: "You are a senior lifecycle marketer.", required: true },
      { type: "context", title: "Context", content: "The audience is {{audience}}. The product is {{product}}. The campaign goal is {{goal}}.", required: true },
      { type: "task", title: "Task", content: "Write a concise email campaign that motivates the reader to take the desired action.", required: true },
      { type: "constraints", title: "Constraints", content: "Keep the tone clear, useful, and specific. Avoid hype. Include one primary CTA.", required: false },
      { type: "output_format", title: "Output Format", content: "Return: subject line, preview text, body copy, and CTA.", required: true }
    ]
  },
  {
    id: "tpl-code-review",
    title: "Code Review",
    description: "Review code for bugs, regressions, and missing tests.",
    category: "Code",
    persona: "Developer",
    tags: ["code", "review", "quality"],
    sections: [
      { type: "role", title: "Role", content: "You are a senior software engineer reviewing a pull request.", required: true },
      { type: "context", title: "Context", content: "The code is written in {{language}} and belongs to {{system_context}}.", required: true },
      { type: "task", title: "Task", content: "Identify correctness bugs, behavioral regressions, security issues, and missing tests.", required: true },
      { type: "constraints", title: "Constraints", content: "Prioritize actionable findings. Do not comment on style unless it creates real risk.", required: false },
      { type: "output_format", title: "Output Format", content: "Return findings ordered by severity with file/line references when available.", required: true }
    ]
  },
  {
    id: "tpl-research-synthesis",
    title: "Research Synthesis",
    description: "Summarize and compare research notes.",
    category: "Analysis",
    persona: "Researcher",
    tags: ["research", "summary", "analysis"],
    sections: [
      { type: "role", title: "Role", content: "You are a careful research analyst.", required: true },
      { type: "context", title: "Context", content: "The source material covers {{topic}} for {{audience}}.", required: true },
      { type: "task", title: "Task", content: "Synthesize the key claims, evidence, disagreements, and practical implications.", required: true },
      { type: "constraints", title: "Constraints", content: "Separate facts from inferences. Flag uncertainty clearly.", required: false },
      { type: "output_format", title: "Output Format", content: "Return executive summary, key points, evidence table, open questions, and recommended next steps.", required: true }
    ]
  },
  {
    id: "tpl-creative-brief",
    title: "Creative Brief",
    description: "Generate a structured brief for a creative project.",
    category: "Creative Writing",
    persona: "Content Creator",
    tags: ["creative", "brief", "content"],
    sections: [
      { type: "role", title: "Role", content: "You are a creative director with strong editorial judgment.", required: true },
      { type: "context", title: "Context", content: "The project is {{project}}. The audience is {{audience}}. The desired feeling is {{tone}}.", required: true },
      { type: "task", title: "Task", content: "Create a practical creative brief that a production team can execute.", required: true },
      { type: "constraints", title: "Constraints", content: "Keep the concept distinctive but feasible. Avoid generic slogans.", required: false },
      { type: "output_format", title: "Output Format", content: "Return objective, audience insight, concept, message pillars, deliverables, and acceptance criteria.", required: true }
    ]
  },d
  {
    id: "tpl-support-reply",
    title: "Support Reply",
    description: "Draft a clear customer support response.",
    category: "Support",
    persona: "Support",
    tags: ["support", "customer", "reply"],
    sections: [
      { type: "role", title: "Role", content: "You are a helpful customer support specialist.", required: true },
      { type: "context", title: "Context", content: "Customer idddddssue: {{issue}}. Account status: {{account_status}}.", required: true },
      { type: "task", title: "Task", content: "Write a response that acknowledges the issue and gives the customer a clear next step.", required: true },
      { type: "constraints", title: "Constraints", content: "Be direct, calm, and specific. Do not promise outcomes that are not confirmed.", required: false },
      { type: "output_format", title: "Output Format", content: "Return subject and reply body.", required: true }
    ]
  },
  {
    id: "tpl-json-extraction",
    title: "JSON Extraction",
    description: "Extract structured data from unstructured text.",
    category: "Analysis",
    persona: "Developer",
    tags: ["json", "extraction", "structured-output"],
    sections: [
      { type: "role", title: "Role", content: "You are an information extraction system.", required: true },
      { type: "context", title: "Context", content: "Extract data from the provided text about {{domain}}.", required: true },
      { type: "task", title: "Task", content: "Extract only the fields requested by the schema.", required: true },
      { type: "constraints", title: "Constraints", content: "Return null for unknown fields. Do not invent values.", required: false },
      { type: "output_format", title: "Output Format", content: "Return valid JSON matching this schema: {{schema}}", required: true }
    ]
  }
];
