package meetingactor

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"

	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/redisstream"
)

const (
	consumerGroup = "meeting-actor"

	readBatchSize = 16
	readBlockTime = 2 * time.Second

	// Normal runtime retry delay for pending evidence.
	//
	// We deliberately keep a non-zero idle window here
	// so repeatedly failing evidence does not create a
	// tight retry loop.
	pendingRetryMinIdle = 5 * time.Second

	groupProgressRefreshInterval = 5 * time.Second

	drainPollInterval = 100 * time.Millisecond
)

type Consumer struct {
	redis *redisclient.Client
	actor *Actor

	lease meetinglease.Lease

	consumerName string

	logger *slog.Logger
}

func NewConsumer(
	redisClient *redisclient.Client,
	actor *Actor,
	lease meetinglease.Lease,
	consumerName string,
	logger *slog.Logger,
) *Consumer {
	return &Consumer{
		redis: redisClient,

		actor: actor,

		lease: lease,

		consumerName: consumerName,

		logger: logger,
	}
}

func (c *Consumer) Run(
	ctx context.Context,
) error {
	meetingID :=
		c.lease.MeetingID

	stream :=
		redisstream.EvidenceStreamKey(
			meetingID,
		)

	if err :=
		c.redis.XGroupCreateMkStream(
			ctx,
			stream,
			consumerGroup,
			"0",
		); err != nil {

		return err
	}

	// ---------------------------------------------------------
	// Observability: initialize durable PEL state
	// ---------------------------------------------------------
	//
	// A newly-started runtime may inherit pending evidence from
	// the previous owner.
	//
	// Seed this meeting's local metric from Redis before any
	// recovery begins. The Metrics implementation aggregates
	// per-meeting values into one instance-wide gauge without
	// exposing meetingID as a Prometheus label.
	if c.actor.metrics != nil {
		defer c.actor.metrics.
			RemoveMeetingEvidencePending(
				meetingID,
			)

		defer c.actor.metrics.
			RemoveMeetingEvidenceGroupLag(
				meetingID,
			)

		progress, progressErr :=
			c.redis.XGroupProgress(
				ctx,
				stream,
				consumerGroup,
			)

		if progressErr != nil {
			c.logger.Warn(
				"failed to initialize evidence pending metric",

				"meetingId",
				meetingID,

				"error",
				progressErr,
			)
		} else {
			c.actor.metrics.
				SetMeetingEvidencePending(
					meetingID,
					progress.Pending,
				)

			if progress.Lag >= 0 {
				c.actor.metrics.
					SetMeetingEvidenceGroupLag(
						meetingID,
						progress.Lag,
					)
			}
		}
	}

	// Restore the last successfully ACKed actor context
	// before processing any pending or new evidence.
	//
	// This allows bounded adjacent-turn context to survive
	// a realtime service restart.
	contextStore :=
		NewContextStore(
			c.redis,
		)

	checkpoint, exists, err :=
		contextStore.Load(
			ctx,
			meetingID,
		)

	if err != nil {
		return fmt.Errorf(
			"load meeting actor context: %w",
			err,
		)
	}

	if exists {
		if err :=
			c.actor.RestoreContext(
				checkpoint,
			); err != nil {

			return fmt.Errorf(
				"restore meeting actor context: %w",
				err,
			)
		}

		c.logger.Info(
			"meeting actor durable context restored",
			"meetingId",
			meetingID,
			"eventId",
			checkpoint.Turn.EventID,
			"evidenceStreamId",
			checkpoint.EvidenceStreamID,
			"observationCount",
			len(
				checkpoint.Observations,
			),
		)
	}

	// ---------------------------------------------------------
	// Ownership takeover recovery
	// ---------------------------------------------------------
	//
	// This Runtime has already acquired the distributed
	// meeting lease before Consumer.Run is started.
	//
	// Therefore pending evidence left behind by the previous
	// runtime owner can be claimed immediately instead of
	// waiting for the normal retry idle window.
	if err :=
		c.recoverPending(
			ctx,
			stream,
			0,
		); err != nil {

		if ctx.Err() != nil {
			return nil
		}

		return err
	}

	nextGroupProgressRefresh :=
		time.Now().
			Add(
				groupProgressRefreshInterval,
			)

	c.logger.Info(
		"meeting actor consumer started",
		"meetingId",
		meetingID,
		"consumer",
		c.consumerName,
		"stream",
		stream,
		"fence",
		c.lease.Fence,
	)

	for {
		if ctx.Err() != nil {
			return nil
		}

		if c.actor.metrics != nil &&
			!time.Now().
				Before(
					nextGroupProgressRefresh,
				) {

			c.refreshEvidenceGroupLag(
				ctx,
				stream,
				meetingID,
			)

			nextGroupProgressRefresh =
				time.Now().
					Add(
						groupProgressRefreshInterval,
					)
		}

		// -----------------------------------------------------
		// Runtime pending recovery
		// -----------------------------------------------------
		//
		// Retry abandoned / previously-failed evidence
		// throughout the lifetime of the consumer,
		// not only during startup.
		//
		// Unlike ownership takeover recovery, runtime retries
		// use an idle delay to avoid hot-looping a message that
		// repeatedly fails semantic processing.
		if err :=
			c.recoverPending(
				ctx,
				stream,
				pendingRetryMinIdle,
			); err != nil {

			if ctx.Err() != nil {
				return nil
			}

			return err
		}

		streams, err :=
			c.redis.XReadGroup(
				ctx,
				consumerGroup,
				c.consumerName,
				stream,
				readBatchSize,
				readBlockTime,
			)

		if err != nil {
			if ctx.Err() != nil {
				return nil
			}

			return err
		}

		// XREADGROUP with ">" delivers NEW messages into the PEL.
		//
		// XAUTOCLAIM is intentionally not counted here because
		// reclaimed messages were already pending and therefore
		// already contribute to the gauge.
		if c.actor.metrics != nil {
			var delivered int64

			for _, result := range streams {

				delivered +=
					int64(
						len(
							result.Messages,
						),
					)
			}

			if delivered > 0 {
				c.actor.metrics.
					AddMeetingEvidencePending(
						meetingID,
						delivered,
					)
			}
		}

		for _, result := range streams {

			for _, message := range result.Messages {

				err :=
					c.process(
						ctx,
						stream,
						message,
					)

				if err == nil {
					continue
				}

				deadLettered, fatalErr :=
					c.resolveProcessFailure(
						ctx,
						stream,
						message,
						err,
					)

				if fatalErr != nil {
					return fmt.Errorf(
						"meeting actor fatal evidence processing failure: %w",
						fatalErr,
					)
				}

				if deadLettered {
					continue
				}

				c.logger.Error(
					"meeting actor failed to process evidence",

					"meetingId",
					meetingID,

					"streamId",
					message.ID,

					"error",
					err,
				)

				// Deliberately no ACK.
				//
				// The message remains durable in the PEL until either:
				//
				// 1. a later retry succeeds, or
				// 2. maxEvidenceDeliveryCount is reached and the message is
				//    atomically moved to the fenced DLQ.
			}
		}
	}
}

func (
	c *Consumer,
) refreshEvidenceGroupLag(
	ctx context.Context,
	stream string,
	meetingID string,
) {
	if c.actor.metrics == nil {
		return
	}

	progress, err :=
		c.redis.XGroupProgress(
			ctx,
			stream,
			consumerGroup,
		)

	if err != nil {
		if ctx.Err() != nil {
			return
		}

		c.actor.metrics.IncFailure(
			"redis_stream",
			"group_progress",
		)

		c.logger.Warn(
			"failed to refresh evidence consumer group lag",
			"meetingId",
			meetingID,
			"error",
			err,
		)

		return
	}

	// Redis returns -1 when consumer-group lag cannot
	// currently be determined. Do not publish a false zero.
	if progress.Lag < 0 {
		return
	}

	c.actor.metrics.
		SetMeetingEvidenceGroupLag(
			meetingID,
			progress.Lag,
		)
}

func (
	c *Consumer,
) Drain(
	ctx context.Context,
) error {
	meetingID :=
		c.lease.MeetingID

	stream :=
		redisstream.EvidenceStreamKey(
			meetingID,
		)

	// EvidenceDispatcher has already been closed before
	// this method is called, therefore this is a stable
	// high-water mark: no later evidence should appear
	// for this runtime.
	targetID, err :=
		c.redis.XLastID(
			ctx,
			stream,
		)

	if err != nil {
		return fmt.Errorf(
			"capture evidence drain target: %w",
			err,
		)
	}

	c.logger.Info(
		"meeting actor drain started",
		"meetingId",
		meetingID,
		"targetStreamId",
		targetID,
	)

	if targetID == "0-0" {
		c.logger.Info(
			"meeting actor evidence drained",
			"meetingId",
			meetingID,
			"targetStreamId",
			targetID,
		)

		return nil
	}

	ticker :=
		time.NewTicker(
			drainPollInterval,
		)

	defer ticker.Stop()

	for {
		progress, err :=
			c.redis.XGroupProgress(
				ctx,
				stream,
				consumerGroup,
			)

		if err != nil {
			return fmt.Errorf(
				"read evidence drain progress: %w",
				err,
			)
		}

		if progress.Pending == 0 &&
			progress.LastDeliveredID ==
				targetID {

			c.logger.Info(
				"meeting actor evidence drained",
				"meetingId",
				meetingID,
				"targetStreamId",
				targetID,
			)

			return nil
		}

		select {
		case <-ctx.Done():
			return fmt.Errorf(
				"drain meeting evidence: %w",
				ctx.Err(),
			)

		case <-ticker.C:
		}
	}
}

func (
	c *Consumer,
) process(
	ctx context.Context,
	stream string,
	message redis.XMessage,
) error {
	processingStarted :=
		time.Now()

	defer func() {
		if c.actor.metrics != nil {
			c.actor.metrics.
				ObserveEvidenceProcessing(
					time.Since(
						processingStarted,
					),
				)
		}
	}()

	meetingID :=
		c.lease.MeetingID

	eventType, ok :=
		message.Values["event_type"].(string)

	if !ok {
		return fmt.Errorf(
			"stream event missing event_type",
		)
	}

	if eventType !=
		"evidence.turn.final" {

		return fmt.Errorf(
			"unsupported event type %q",
			eventType,
		)
	}

	payload, ok :=
		message.Values["payload"].(string)

	if !ok {
		return fmt.Errorf(
			"stream event missing payload",
		)
	}

	// ---------------------------------------------------------
	// Phase 1: prepare
	// ---------------------------------------------------------
	//
	// Extraction + grounding + domain validation happen here,
	// but NO durable semantic write and NO actor-context
	// mutation is allowed yet.
	prepared, err :=
		c.actor.PrepareEvidence(
			ctx,
			payload,
		)

	if err != nil {
		return classifyProcessError(
			err,
		)
	}

	semanticEntries :=
		make(
			[]redisclient.FencedStreamEntry,
			0,
			len(
				prepared.Observations,
			),
		)

	for _, observation := range prepared.Observations {

		entry, err :=
			redisstream.EncodeSemanticStreamEntry(
				observation,
			)

		if err != nil {
			return fmt.Errorf(
				"encode semantic observation %q: %w",
				observation.ID,
				err,
			)
		}

		semanticEntries =
			append(
				semanticEntries,
				entry,
			)
	}

	checkpoint :=
		prepared.ContextCheckpoint(
			message.ID,
		)

	checkpointPayload, err :=
		EncodeContextCheckpoint(
			checkpoint,
		)

	if err != nil {
		return fmt.Errorf(
			"encode meeting actor context: %w",
			err,
		)
	}

	// ---------------------------------------------------------
	// Phase 2: one fenced durable commit
	// ---------------------------------------------------------
	//
	// All of these operations execute inside one Redis Lua
	// execution:
	//
	// 1. validate active lease token
	// 2. validate fence
	// 3. verify evidence is still pending
	// 4. append ALL semantic observations
	// 5. persist actor checkpoint
	// 6. ACK source evidence
	//
	// No newer runtime may interleave between those steps.
	commitStarted :=
		time.Now()

	committedObservations, err :=
		c.redis.FencedXAddBatchAckAndSet(
			ctx,

			meetinglease.LeaseKey(
				meetingID,
			),

			meetinglease.FenceKey(
				meetingID,
			),

			c.lease.Token,

			c.lease.Fence,

			stream,

			consumerGroup,

			message.ID,

			ContextCheckpointKey(
				meetingID,
			),

			checkpointPayload,

			redisstream.SemanticStreamKey(
				meetingID,
			),

			semanticEntries,
		)

	if c.actor.metrics != nil {
		c.actor.metrics.
			ObserveRedisCommit(
				time.Since(
					commitStarted,
				),
			)
	}

	if err != nil {
		if c.actor.metrics != nil {
			c.actor.metrics.
				IncFailure(
					"meeting_actor",
					"redis_commit",
				)
		}

		return classifyProcessError(
			err,
		)
	}

	// Redis has definitely committed and ACKed the evidence.
	//
	// Decrement the local PEL contribution only after definite
	// success. In particular, do NOT decrement on an ambiguous
	// atomic-commit outcome because the caller cannot know
	// whether Redis committed.
	if c.actor.metrics != nil {
		c.actor.metrics.
			AddMeetingEvidencePending(
				meetingID,
				-1,
			)
	}

	// ---------------------------------------------------------
	// Phase 3: in-memory commit
	// ---------------------------------------------------------
	//
	// Actor context moves forward ONLY after Redis has
	// durably accepted the semantic batch + checkpoint + ACK.
	c.actor.commitPrepared(
		prepared,
	)

	c.logger.Info(
		"meeting actor atomically committed evidence",
		"meetingId",
		meetingID,
		"streamId",
		message.ID,
		"eventId",
		checkpoint.Turn.EventID,
		"semanticObservationCount",
		committedObservations,
		"fence",
		c.lease.Fence,
	)

	for _, observation := range prepared.Observations {

		c.logger.Info(
			"semantic observation committed",
			"meetingId",
			meetingID,
			"observationId",
			observation.ID,
			"kind",
			observation.Kind,
			"supersedesObservationId",
			observation.
				SupersedesObservationID,
		)
	}

	return nil
}

func (
	c *Consumer,
) recoverPending(
	ctx context.Context,
	stream string,
	minIdle time.Duration,
) error {
	meetingID :=
		c.lease.MeetingID

	start :=
		"0-0"

	for {
		if ctx.Err() != nil {
			return nil
		}

		messages, next, err :=
			c.redis.XAutoClaim(
				ctx,
				stream,
				consumerGroup,
				c.consumerName,
				minIdle,
				start,
				readBatchSize,
			)

		if err != nil {
			if ctx.Err() != nil {
				return nil
			}

			return fmt.Errorf(
				"recover pending evidence: %w",
				err,
			)
		}

		for _, message := range messages {

			c.logger.Info(
				"meeting actor recovered pending evidence",
				"meetingId",
				meetingID,
				"streamId",
				message.ID,
				"minIdle",
				minIdle,
			)

			err :=
				c.process(
					ctx,
					stream,
					message,
				)

			if err == nil {
				continue
			}

			deadLettered, fatalErr :=
				c.resolveProcessFailure(
					ctx,
					stream,
					message,
					err,
				)

			if fatalErr != nil {
				return fmt.Errorf(
					"meeting actor fatal pending evidence processing failure: %w",
					fatalErr,
				)
			}

			if deadLettered {
				continue
			}

			c.logger.Error(
				"meeting actor failed to process recovered evidence",

				"meetingId",
				meetingID,

				"streamId",
				message.ID,

				"error",
				err,
			)

			// Still deliberately no ACK.
			//
			// The message becomes eligible again after
			// pendingRetryMinIdle until the retry budget is exhausted.
		}

		if next == "0-0" {
			return nil
		}

		start =
			next
	}
}

func classifyProcessError(
	err error,
) error {
	if err == nil {
		return nil
	}

	if errors.Is(
		err,
		redisclient.ErrFencedWriteRejected,
	) {
		// Preserve BOTH meanings:
		//
		// - higher layers see distributed ownership loss
		// - tests/debugging can still identify the exact
		//   Redis fencing rejection.
		return fmt.Errorf(
			"%w: %w",
			meetinglease.ErrLeaseLost,
			err,
		)
	}

	return err
}

func isFatalProcessError(
	err error,
) bool {
	if err == nil {
		return false
	}

	// Ownership loss is always fail-closed.
	if errors.Is(
		err,
		meetinglease.ErrLeaseLost,
	) {
		return true
	}

	// The atomic Lua command may have executed successfully while
	// its response was lost.
	//
	// Continuing would risk:
	//
	//   Redis checkpoint = N
	//   Actor memory      = N-1
	//
	// Runtime restart is required so Actor memory is rebuilt from
	// the durable checkpoint.
	if errors.Is(
		err,
		redisclient.ErrAtomicCommitOutcomeUnknown,
	) {
		return true
	}

	// Redis key types / structural state are corrupted.
	//
	// Retrying the same evidence cannot repair this and would only
	// create an infinite reclaim/fail loop.
	if errors.Is(
		err,
		redisclient.ErrFencedBatchInvalidState,
	) {
		return true
	}

	if errors.Is(
		err,
		redisclient.ErrFencedDeadLetterInvalidState,
	) {
		return true
	}

	// If an entry disappeared from the PEL between processing and
	// commit, the commit invariant no longer holds.
	if errors.Is(
		err,
		redisclient.ErrFencedXAckNotPending,
	) {
		return true
	}

	return false
}
