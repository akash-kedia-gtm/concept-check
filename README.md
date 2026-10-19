# Concept Check — Web Frontend (Version 0.4)

Concept Check is a focused conceptual diagnostic and verification web frontend designed for technical learners to evaluate core web architecture and engineering concepts through Socratic probing.

---

## 1. Architecture & Screen Structure

The application replaces earlier iterations with a unified 4-screen state model:
1. **Signup / Profile Setup Screen**: Requires exclusively `Name` (spaces allowed) and `Username` (no whitespace). No emails, passwords, verification codes, or third-party auth widgets.
2. **Start Screen**: Uncluttered launch screen displaying `"Let's test your concepts for Module 2"` with unstarted session parameters and a single `"Start"` action.
3. **Question Chat Workspace**: Unified multi-state workspace featuring an **Assessment Rail** left sidebar (strictly question history, e.g., `Question 1`, `Question 2`) and a primary conversational transcript.
   - **State A (Original Question)**: Displays the prepared prompt from `Concept Check` with an empty composer.
   - **State B (First Answer)**: Displays learner response under their real display name (e.g., `Akash Kedia`); composer shows inline `"Thinking…"`.
   - **State C (Follow-Up Inquiry)**: Appends one direct, plain-text Socratic follow-up without highlighting, praise, or grading.
   - **State D (Retry Submission)**: Appends a second learner message; shows `"Saving…"`. Max two learner answers per round.
   - **State E (Continue State)**: Composer is removed; displays `"You have now reached the next step."` and a single `"Continue"` button.
   - **State F (Next Question / Completion)**: Advances through 10 rounds without creating Question 11.
4. **Thank-You Screen**: Displays `"Thanks for completing all 10 questions."` with session retention metrics and an isolated, unconfigured Retry control.

---

## 2. Mock vs. Connected Services

- **Preview Adapter Mode**: The app ships with `PreviewIdentityAdapter` (`src/services/identityService.ts`) and `PreviewAssessmentAdapter` (`src/services/assessmentService.ts`). Sessions persist in browser `sessionStorage`.
- **Notice in UI**: A subtle, non-interactive badge (`Preview mode — AI & database not connected`) is displayed in the application header.
- **Supabase & Antigravity Handoff Points**:
  - `identityService.setupProfile(name, username)`: Designed to call Supabase Anonymous Auth `supabase.auth.signInAnonymously()` and attach `{ name, username }` to `raw_user_meta_data`.
  - `assessmentService.submitFirstAnswer(...)`: Designed to trigger the server-side Supabase Edge Function running Groq / model inference to evaluate conceptual gaps.
  - `assessmentService.submitRetry(...)`: Saves retry to the `Sessions` / `Messages` table without making an unnecessary second LLM call.
  - `assessmentService.advanceToNextQuestion(...)`: Queries the next Golden Pair record from the server.

---

## 3. Data Integrity & Invariants

- **Internal Roles vs. Public Display Names**: Application messages are rendered under `Concept Check`. Learner messages use their exact display name entered during signup. Roles (`assistant`, `learner`) and message types (`question`, `first_attempt`, `follow_up`, `retry`) remain internal.
- **Sidebar Discipline**: Entries appear in the Assessment Rail only when the question has actually commenced. Future questions are never prepopulated. Earlier questions open in read-only mode, preserving the draft for the active question.
- **Plain-Text Interactions**: No arbitrary phrase highlighting, color annotations, or diagnostic grades are rendered.

---

## 4. Unresolved Final Retry Action

- In Section 6 of the specification, the post-assessment **Retry** button behavior is explicitly documented as unconfirmed by the course administrator.
- **Implementation**: The button on the Thank-You screen is intentionally styled in a disabled state with an accessible explanatory tooltip describing that the restart flow is not yet configured, preventing accidental state corruption or unconfirmed restarts.

---

## 5. Verification Checks Run

1. **Signup Validation**:
   - Rejects empty Name and empty Username.
   - Real-time detection and error flag for any whitespace in Username (`"Spaces or whitespace are not permitted"`).
   - Validates display name retention throughout all subsequent messages.
2. **Start Screen Integrity**:
   - Matches exact title: `"Let's test your concepts for Module 2"`.
   - Sidebar is not visible prior to Question 1.
   - Disables button and displays `"Starting…"` while initializing.
3. **Workspace Conversation Flow**:
   - Question 1 loads prepared Golden Pair question text.
   - Submitting first answer renders learner name and triggers inline `"Thinking…"`.
   - Single follow-up question arrives in the same conversation thread without highlighting.
   - Submitting retry appends second response and transitions to Continue state.
   - Composer is removed; transition copy reads `"You have now reached the next step."`.
4. **History Rail & Draft Isolation**:
   - Question 1 is visible in rail. Advancing to Question 2 adds Question 2.
   - Clicking Question 1 renders read-only past transcript. Returning to Question 2 preserves pending draft.
5. **Question 10 Termination**:
   - Question 10 continues directly to Thank-You screen; never attempts to load Question 11.
