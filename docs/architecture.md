# Current architecture

## Responsibility boundaries and data flow

```text
Browser: demo WAVs + real user microphone
   -> LiveKit room/audio/data
   -> realtime-go track subscription and native audio decoding
   -> AssemblyAI streaming final transcripts
   -> evidence stream
   -> Groq structured extraction with actor context
   -> grounded semantic observations / supersedesObservationId
   -> Redis semantic stream
   -> NestJS semantic execution worker
   -> PostgreSQL SprintItem + execution observation links + Jira outbox
   -> Jira issue mapping / external issue update
   -> API snapshot / dashboard queries
   -> browser Commitment, Clarification and Execution cards
```

The web is presentation and authenticated transport; its demo playback state is not execution truth. PostgreSQL persists identity, meetings, sprints, items, mappings, OAuth tokens, usage policies and outbox work. Redis persists evidence, semantics, actor checkpoints, leases, intervention gaps/delivery state and consumer progress. Jira is the external execution mirror, not a frontend simulation.

NestJS uses Fastify, TypeORM and a separate PostgreSQL health/query pool. Go does not write SprintItems directly. API workers perform semantic execution and Jira synchronization; there is no separate Node worker application.

## Meeting lifecycle

The authenticated API creates workspace-bound meetings, issues scoped participant tokens and publishes lifecycle events to `lumos:meetings:lifecycle`. Go's lifecycle consumer replays/reconciles events and its supervisor acquires a Redis meeting lease with fencing before starting per-meeting work. A runtime connects the bot to the corresponding LiveKit room, manages subscribed human/demo audio, transcription, evidence processing and interventions.

Ending a meeting goes through the API lifecycle path. Cancellation stops its runtime, audio/TTS and transcription and releases ownership. OS SIGTERM stops new work and shuts down the metrics server and supervisor. Lifecycle consumers/checkpoints and expiring leases allow restart recovery; an old fenced owner cannot commit new results after ownership changes.

## Transcription, evidence and actor context

Human/demo tracks are decoded into PCM and observed by the speech floor before the AssemblyAI network round trip. Final transcripts become evidence turns associated with the meeting, participant identity and evidence event. Groq extraction is contextual, with a configured primary model and fallback model; candidates are validated/grounded before an observation is emitted.

`services/realtime-go/internal/meetingactor` prepares evidence, builds extraction/refinement context, validates observations and checkpoints context with progress. The durable `ContextCheckpoint` includes the processed evidence stream ID, recent turn/observations, `LatestCommitmentTurn`, `LatestCommitmentObservation` and `OpenCommitments`. Losing an ordinary intervening turn does not erase the latest unresolved commitment memory. The Redis commit is fenced and coordinates checkpoint/result publication with evidence acknowledgment using Lua.

Malformed/oversized or poison evidence has tested DLQ handling; evidence is not silently treated as a successful commitment. Extraction/network errors retain retryable work. The checkpoints are meaningful durable state: deleting Redis is not harmless cache clearing.

## Commitment refinement and execution identity

A later statement about the same open responsibility is linked in the actor's commitment context, not by dangerous global fuzzy-title matching in the API. `supersedesObservationId` carries the lineage to the semantic stream. Field-preservation/grounding rules keep an already established owner when another participant supplies only a deadline.

A short due-only answer can refine an unambiguous unresolved commitment across speakers and after an ordinary intervening turn. Supported weekday/date parsing is generic, not a hardcoded Friday rule. When multiple unrelated open commitments make an answer ambiguous, the system must not guess a global title match.

The semantic projector replaces superseded commitment observations in the current snapshot. The API worker polls every 750ms, reads workspace meetings and per-meeting semantics, and maintains durable execution cursors plus an activation watermark. `ExecutionService` follows observation links, updates the exact existing SprintItem on refinement and records links from multiple lineage observations to that item. PostgreSQL constraints and transaction handling guard repeat processing. The model can still produce multiple items for genuinely different responsibilities.

`resolve-due-date.ts` resolves supported textual deadlines using the observation time. The resulting `dueAt` persists in PostgreSQL. Snapshot/UI commitment and execution cards must reflect the refined observation and stored due date, not an optimistic substitute.

## Intervention gaps, stale checks and turn-taking

The API evaluates missing-owner/deadline gaps and publishes durable interventions. Gap state records resolution; lineage/refinement closes the corresponding missing-field gap. History and current gap state feed the clarification UI.

Go's intervention consumer checks current gap state and ownership before every attempt. TTS prepares audio, waits for a floor grant and checks validity again before publishing. A resolved gap is acknowledged as stale without speaking. Successful speech commits a durable delivery marker and ACK; real delivery/network/provider failures remain pending for durable recovery.

`speechfloor.QuietWindow` is **500ms**. New participant audio or a demo floor reservation resets/revokes the quiet grant. Participant speech during Lumos playback cancels it and clears queued audio (barge-in). Expected typed floor interruption stays in the consumer's in-flight retry loop: wait for a quiet floor and promptly retry the same still-valid intervention, not the generic **5-second** pending recovery timer. Real failures still use pending recovery. Shutdown/ownership failures are not reclassified as expected floor interruptions.

Browser prerecorded participants request floor reservations through LiveKit data coordination before starting each WAV and renew/release them. They do not start a new recording while the assistant owns the floor. Real human PCM remains authoritative for barge-in. Cleanup of demo rooms/tracks is idempotent; it avoids operating on disconnected rooms or unpublishing/disconnecting twice.

## TTS and audio path

The implemented provider is `edge` via `github.com/kolonist/edgetts`. Text is synthesized to MP3, decoded and resampled into publishable audio using the native audio toolchain, then delivered on the LiveKit bot track. Timeout/retry/voice/rate/volume are configured per service. There is no Edge TTS API-key variable in current code. This library-backed external service should not be represented as a contracted production SLA.

The bot's generated speech is not counted as a human commitment. Participant transcription and assistant playback have separate responsibilities; UI state alone does not arbitrate the room.

## Jira outbox and retry boundaries

Execution creates/upserts durable PostgreSQL outbox work for the SprintItem. The Jira worker drains eligible outbox entries and retains failure/retry state. OAuth access tokens can be refreshed after an upstream 401; encrypted token storage uses a stable 32-byte key.

`JiraSyncService` first checks the existing `jira_issue_mappings` record and updates that issue. When a mapping is missing, it searches Jira for the item's stable Lumos identifier before creating, allowing recovery when the external create succeeded but local mapping persistence failed. Mapping uniqueness binds an item to one external issue. This is idempotent lineage-based recovery; external API failures are not magically exactly-once transactions across databases.

Back up the outbox and mapping tables together. Never delete mappings to retry synchronization: that risks losing external identity. A refinement must retain `sprint_item_id` and `jira_issue_key`.

## Redis streams and state

- `lumos:meetings:lifecycle`: durable meeting start/end events and replay.
- `lumos:meeting:{<meetingId>}:evidence`: final transcript evidence, consumer groups/pending recovery.
- `lumos:meeting:{<meetingId>}:semantics`: grounded observations and refinement lineage, projector/execution cursor reads.
- `lumos:meeting:{<meetingId>}:interventions`: clarification publication/history/durable delivery.
- `lumos:meeting:{<meetingId>}:evidence-dlq`: quarantined problematic evidence.
- Related keys store actor context, lease/fence, gap hashes, deduplication and execution cursor state. Meeting hash tags keep multi-key Lua operations co-located.

Use native TCP Redis clients with TLS in production, not the Upstash REST SDK. See the command-level compatibility checklist and retention risks in [production deployment](production-deployment.md). TTLs on individual keys do not establish a complete archival/retention policy for transcript streams.

## Failure and observability boundaries

API liveness/readiness check the process and PostgreSQL/Redis respectively; they do not guarantee Jira/LiveKit/AI health. Go checks Redis, LiveKit and AssemblyAI before starting its metrics server. It currently has no separate HTTP liveness/readiness route. Metrics remain on the private runtime port and support bearer protection.

Logs and metrics expose operational state, not an invitation to publish transcripts or secrets. Expected barge-in is not a delivery failure. Provider quota limits, request latency, database capacity and Redis durable state are production dependencies that require hosted smoke tests and monitoring.
