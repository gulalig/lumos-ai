# Live demo flow

## What is prerecorded and what is real

`apps/web/public/demo-audio` contains `alex-01.wav`, `alex-02.wav`, `maya-01.wav` and `maya-02.wav`. `useDemoParticipants.ts` plays these recordings through separate LiveKit participant rooms/identities (`demo:alex` and `demo:maya`). They are prerecorded voices, not generated human dialogue.

The user's microphone is real. LiveKit transport, AssemblyAI transcription, Groq extraction, Redis evidence/semantics/gaps, API execution, PostgreSQL items and Jira sync are real backend/provider operations. Landing-page illustrative animations are not proof of execution. The live demo must be evaluated using persisted state and issue mappings.

## Prerequisites

Complete signup/email verification, workspace/workflow onboarding and Jira project selection; ensure the demo prerequisite gate allows entry. API, Go, PostgreSQL, Redis and provider credentials must be healthy. Allow microphone/audio playback permissions and use HTTPS (or localhost).

Use a dedicated test workspace/Jira project. Do not wipe a shared DB/Redis instance to obtain a clean demo; provision disposable isolated state for clean-run acceptance. Provider usage is chargeable even when a participant is prerecorded.

## Expected sequence

1. Starting the demo creates a real workspace-bound meeting and joins LiveKit.
2. Alex/Maya publish their WAV tracks. The user can speak through the normal microphone participant path. Final transcripts arrive asynchronously.
3. Maya offers to handle the final review. A later statement about owning the final check continues/refines that open responsibility.
4. The actor emits one commitment lineage, preserving Maya as the grounded owner. The API creates one SprintItem and a Jira outbox entry; sync maps it to one Jira issue.
5. The missing due date opens a `missing_due_date` intervention gap. The UI can show the unresolved clarification while Go queues the spoken question.
6. Lumos waits until participant speech finishes and the floor remains quiet for approximately **500ms**. Demo WAV playback also respects the assistant floor.
7. Lumos speaks the due-date clarification through Edge TTS and LiveKit. Human barge-in cancels playback and clears queued audio.
8. The user can answer `On Monday.`, `By Tuesday.`, `Wednesday works.`, `Next Thursday.`, `On Friday.` or another supported date. No specific weekday is hardcoded. A due-only answer can come from someone other than Maya.
9. Actor context links the answer through `supersedesObservationId`, including after an ordinary intervening sentence. Maya remains owner; the commitment gains due text.
10. The projector replaces the old commitment. Execution updates the same SprintItem ID and persists a non-null due date. Jira updates the mapped issue without changing its key.
11. The missing-due gap becomes resolved; the clarification card disappears/resolves and the Commitment and Execution cards show the due date.
12. End the meeting through the UI. Runtime cancellation, demo room cleanup and transcription shutdown must complete without duplicate disconnect/unpublish work.

## Speech retry expectations

Participant speech during the pre-speech quiet window revokes the grant and restarts waiting. Expected floor cancellation stays in-flight and retries promptly after quiet; it does **not** wait for the generic 5-second Redis recovery interval. Before each attempt, Go checks whether the gap remains unresolved.

If the user answers while Lumos waits or barges in, the gap can resolve before another spoken attempt. In that case the queued question is stale and acknowledged without being spoken again. If the answer did not resolve the gap, the same intervention may retry after the floor becomes quiet. Actual TTS/network failures retain durable pending delivery semantics.

## Acceptance checklist

- No new Alex/Maya WAV begins over Lumos; human barge-in stops Lumos audio.
- Maya's two related statements result in one semantic lineage, one SprintItem and one Jira issue.
- Capture the SprintItem ID and Jira issue key before answering; both remain identical afterward.
- Owner is Maya before and after the cross-speaker answer.
- `sprint_items.due_at` is non-null after refinement; Jira due date is updated on the same issue.
- The refined semantic observation supersedes the previous commitment observation.
- `missing_due_date` is resolved in backend state and no stale/repeated spoken question plays.
- Current snapshot Commitment and Execution cards agree about the due date.
- Dashboard, activity, sprint and meeting views show real persisted outcomes.
- Ending the meeting stops participant playback and runtime work.
- A deleted meeting's detail API returns 404 and the browser returns to `/app/meetings`; real 500/network errors retain Retry/error UI.

Automated integration tests use real local PostgreSQL/Redis but stub external Jira requests. Passing them does not prove a live hosted provider run. Record hosted smoke-test results separately from build/unit-test verification.
