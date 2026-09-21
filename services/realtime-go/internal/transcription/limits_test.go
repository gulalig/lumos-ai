package transcription

import (
	"errors"
	"fmt"
	"testing"
)

func TestReserveTrackEnforcesConcurrentLimit(
	t *testing.T,
) {
	manager :=
		&Manager{
			tracks: make(
				map[string]*trackState,
			),
		}

	for index := 0; index <
		maxConcurrentMicrophoneTracks; index++ {

		trackID :=
			fmt.Sprintf(
				"track-%d",
				index,
			)

		reserved, err :=
			manager.reserveTrack(
				trackID,
				&trackState{
					cancel: func() {},
				},
			)

		if err != nil {
			t.Fatalf(
				"reserve track %d: %v",
				index,
				err,
			)
		}

		if !reserved {
			t.Fatalf(
				"expected track %d to reserve capacity",
				index,
			)
		}
	}

	if len(manager.tracks) !=
		maxConcurrentMicrophoneTracks {

		t.Fatalf(
			"expected %d active tracks, got %d",
			maxConcurrentMicrophoneTracks,
			len(manager.tracks),
		)
	}

	// ---------------------------------------------------------
	// One more unique microphone must be rejected.
	// ---------------------------------------------------------

	reserved, err :=
		manager.reserveTrack(
			"track-over-limit",
			&trackState{
				cancel: func() {},
			},
		)

	if reserved {
		t.Fatal(
			"track above resource limit was unexpectedly reserved",
		)
	}

	if !errors.Is(
		err,
		ErrTrackLimitReached,
	) {
		t.Fatalf(
			"expected ErrTrackLimitReached, got %v",
			err,
		)
	}

	if len(manager.tracks) !=
		maxConcurrentMicrophoneTracks {

		t.Fatalf(
			"rejected track changed active count: got %d",
			len(manager.tracks),
		)
	}

	// ---------------------------------------------------------
	// Duplicate callbacks remain idempotent even while full.
	// ---------------------------------------------------------

	reserved, err =
		manager.reserveTrack(
			"track-0",
			&trackState{
				cancel: func() {},
			},
		)

	if err != nil {
		t.Fatalf(
			"duplicate track must not fail with capacity error: %v",
			err,
		)
	}

	if reserved {
		t.Fatal(
			"duplicate track unexpectedly consumed another slot",
		)
	}

	// ---------------------------------------------------------
	// Capacity must become available again after unsubscribe.
	// ---------------------------------------------------------

	manager.stopTrack(
		"track-0",
	)

	if len(manager.tracks) !=
		maxConcurrentMicrophoneTracks-1 {

		t.Fatalf(
			"expected one track slot to be released, got %d active",
			len(manager.tracks),
		)
	}

	reserved, err =
		manager.reserveTrack(
			"track-after-release",
			&trackState{
				cancel: func() {},
			},
		)

	if err != nil {
		t.Fatalf(
			"reserve after capacity release: %v",
			err,
		)
	}

	if !reserved {
		t.Fatal(
			"expected released capacity to be reusable",
		)
	}

	if len(manager.tracks) !=
		maxConcurrentMicrophoneTracks {

		t.Fatalf(
			"expected capacity to return to %d, got %d",
			maxConcurrentMicrophoneTracks,
			len(manager.tracks),
		)
	}
}
