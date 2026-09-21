package meetingactor

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/meetinglease"
	"lumos/realtime-go/internal/observability"
	"lumos/realtime-go/internal/redisstream"
)

func TestDeadLetterUpdatesPendingAndDLQMetrics(
	t *testing.T,
) {
	client, rawClient :=
		atomicCommitRedisClients(
			t,
		)

	ctx, cancel :=
		context.WithTimeout(
			context.Background(),
			10*time.Second,
		)

	defer cancel()

	meetingID :=
		fmt.Sprintf(
			"pending-dlq-metrics-%d",
			time.Now().UnixNano(),
		)

	evidenceStream :=
		redisstream.EvidenceStreamKey(
			meetingID,
		)

	deadLetterStream :=
		redisstream.EvidenceDeadLetterStreamKey(
			meetingID,
		)

	semanticStream :=
		redisstream.SemanticStreamKey(
			meetingID,
		)

	checkpointKey :=
		ContextCheckpointKey(
			meetingID,
		)

	leaseKey :=
		meetinglease.LeaseKey(
			meetingID,
		)

	fenceKey :=
		meetinglease.FenceKey(
			meetingID,
		)

	cleanupActorAtomicKeys(
		t,
		rawClient,
		leaseKey,
		fenceKey,
		evidenceStream,
		deadLetterStream,
		semanticStream,
		checkpointKey,
	)

	lease :=
		meetinglease.Lease{
			MeetingID: meetingID,

			OwnerID: "metrics-owner",

			Token: "metrics-owner-token",

			Fence: 1,
		}

	seedActorAtomicLease(
		t,
		rawClient,
		ctx,
		lease,
	)

	if err :=
		client.XGroupCreateMkStream(
			ctx,
			evidenceStream,
			consumerGroup,
			"0",
		); err != nil {

		t.Fatalf(
			"create consumer group: %v",
			err,
		)
	}

	_, err :=
		client.XAdd(
			ctx,
			evidenceStream,
			map[string]any{
				"event_type": evidence.EventType,

				"schema_version": evidence.SchemaVersion,

				"event_id": "poison-metrics-event",

				"payload": `{"poison":true}`,
			},
		)

	if err != nil {
		t.Fatalf(
			"seed evidence: %v",
			err,
		)
	}

	streams, err :=
		client.XReadGroup(
			ctx,
			consumerGroup,
			"metrics-consumer",
			evidenceStream,
			1,
			time.Second,
		)

	if err != nil {
		t.Fatalf(
			"deliver evidence: %v",
			err,
		)
	}

	if len(streams) != 1 ||
		len(streams[0].Messages) != 1 {

		t.Fatal(
			"expected exactly one delivered message",
		)
	}

	message :=
		streams[0].
			Messages[0]

	// Initial delivery count is 1.
	//
	// Reclaim four more times so the poison message reaches
	// the configured retry budget of 5 deliveries.
	for delivery :=
		int64(2); delivery <=
		maxEvidenceDeliveryCount; delivery++ {

		claimed, _, err :=
			client.XAutoClaim(
				ctx,
				evidenceStream,
				consumerGroup,
				"metrics-consumer",
				0,
				"0-0",
				1,
			)

		if err != nil {
			t.Fatalf(
				"claim delivery %d: %v",
				delivery,
				err,
			)
		}

		if len(claimed) != 1 {
			t.Fatalf(
				"expected one claimed message on delivery %d, got %d",
				delivery,
				len(claimed),
			)
		}

		message =
			claimed[0]
	}

	metrics :=
		observability.NewMetrics()

	logger :=
		slog.New(
			slog.NewTextHandler(
				io.Discard,
				nil,
			),
		)

	actor :=
		New(
			meetingID,
			nil,
			logger,
			metrics,
		)

	consumer :=
		NewConsumer(
			client,
			actor,
			lease,
			"metrics-consumer",
			logger,
		)

	// Simulate the value that Consumer.Run seeds from
	// XGroupProgress when ownership starts.
	metrics.SetMeetingEvidencePending(
		meetingID,
		1,
	)

	deadLettered, fatalErr :=
		consumer.resolveProcessFailure(
			ctx,
			evidenceStream,
			message,
			errors.New(
				"permanent semantic failure",
			),
		)

	if fatalErr != nil {
		t.Fatalf(
			"resolve poison failure: %v",
			fatalErr,
		)
	}

	if !deadLettered {
		t.Fatal(
			"expected poison evidence to be dead-lettered",
		)
	}

	request :=
		httptest.NewRequest(
			http.MethodGet,
			"/metrics",
			nil,
		)

	recorder :=
		httptest.NewRecorder()

	metrics.Handler().
		ServeHTTP(
			recorder,
			request,
		)

	if recorder.Code !=
		http.StatusOK {

		t.Fatalf(
			"metrics endpoint returned %d",
			recorder.Code,
		)
	}

	body :=
		recorder.Body.String()

	expected :=
		[]string{
			"lumos_realtime_evidence_pending 0",
			"lumos_realtime_dead_letters_total 1",
		}

	for _, metric := range expected {

		if !strings.Contains(
			body,
			metric,
		) {

			t.Fatalf(
				"metrics output missing %q",
				metric,
			)
		}
	}

	progress, err :=
		client.XGroupProgress(
			ctx,
			evidenceStream,
			consumerGroup,
		)

	if err != nil {
		t.Fatalf(
			"read final consumer group progress: %v",
			err,
		)
	}

	if progress.Pending != 0 {
		t.Fatalf(
			"expected Redis PEL to be empty, got %d",
			progress.Pending,
		)
	}
}
