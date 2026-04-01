# AI Settings Onboarding — Pattern Examples

This doc outlines options for prompting users to set up AI features before or when using the app.

---

## 1. **Strict gate (block app until setup or skip)**

- **When:** First launch (or when `onboarding_completed` is not set).
- **Behavior:** Show a full-screen onboarding page. User cannot reach the main app until they either:
  - Complete setup (choose provider, add API key, enable AI), then click **Continue to app**, or
  - Click **Skip for now** (use app without AI; can set up later from header).
- **Pros:** Ensures everyone sees AI setup once; clear “first run” experience.
- **Cons:** Some users may skip and never configure.

---

## 2. **Soft gate (show once, allow skip)**

- **When:** First run only.
- **Behavior:** Same full-screen onboarding, but copy emphasizes “Get the most out of NocLense” rather than “Required.” Prominent **Skip for now**.
- **Pros:** No feeling of being blocked; AI is clearly optional.
- **Cons:** Easy to skip and forget.

---

## 3. **Conditional gate (only when AI not configured)**

- **When:** Every time the app loads **and** no API key is configured for the selected provider.
- **Behavior:** Show onboarding (or a compact banner) until the user configures AI or dismisses.
- **Pros:** Surfaces setup again if they cleared data or switched device.
- **Cons:** Can feel repetitive if they intentionally don’t want AI.

---

## 4. **Inline empty state**

- **When:** User opens the AI assistant (e.g. AI panel or shortcut) but API key is missing or AI is disabled.
- **Behavior:** Instead of the normal chat UI, show a short message: “Set up AI to analyze logs” + **Open AI Settings** (and optionally **Skip**).
- **Pros:** No global gate; setup is in context.
- **Cons:** Users who never open AI may never see the prompt.

---

## 5. **Banner + modal**

- **When:** App has loaded; AI not configured (or onboarding not completed).
- **Behavior:** Show a dismissible banner at top: “Set up AI to get log analysis and insights” → **Set up** opens AI Settings modal; **Later** dismisses banner (and sets “onboarding seen” so it doesn’t show again, or only once per session).
- **Pros:** Non-blocking; main app is usable immediately.
- **Cons:** Easy to ignore; less prominent than full-screen.

---

## 6. **Stepped wizard**

- **When:** Same as 1 or 2 (e.g. first run).
- **Behavior:** Multi-step onboarding: Step 1 “Welcome”, Step 2 “Choose provider”, Step 3 “Add API key & test”, Step 4 “Enable AI and go”.
- **Pros:** Clear progression; can explain each step (privacy, limits).
- **Cons:** More UI and state; some users prefer one screen.

---

## Implemented: Soft gate walkthrough

NocLense uses a **soft gate (2)** on first run with a multi-step walkthrough:

1. **Step 1 — Welcome:** "Get the most out of NocLense" — benefits (log analysis, call-flow insights, free tiers). Skip available.
2. **Step 2 — Choose provider:** Cards for Gemini, Claude, Codex, Codex CLI, Ollama — each links to provider docs.
3. **Step 3 — How to get API key:** Provider-specific how-to steps and links (ai.google.dev, console.anthropic.com, etc.).
4. **Step 4 — Configure & go:** Open AI Settings, add key, enable AI. **Continue to app** or **Skip for now**.

- **Persistence:** `noclense_onboarding_completed` in `localStorage` — shows only until user completes or skips.
- **Skip for now:** Available on every step so users can bypass the walkthrough anytime.

---

## Other options (reference)

See patterns 1-6 above for alternative approaches.

- (Legacy) Strict/Soft gate with single page:
  - Welcomes the user and briefly explains AI features (log analysis, insights).
  - Offers **Open AI Settings** (reuses `AISettingsPanel` in a modal).
  - **Continue to app** (after they’re done) and **Skip for now** (use app without AI).
- **Persistence:** `noclense_onboarding_completed` in `localStorage` so we show onboarding only until they complete or skip.
- **Later:** Optional **banner (5)** or **inline empty state (4)** when they open AI without being configured, to re-prompt without a full gate.
