package meetinglease

import (
	"context"
	"testing"
	"time"
)

type fakeRedis struct {
	results []int64
	calls   int
}

func (f *fakeRedis) EvalInt64(
	_ context.Context,
	_ string,
	_ []string,
	_ ...any,
) (int64, error) {
	index :=
		f.calls

	f.calls++

	if index >= len(
		f.results,
	) {
		return 0, nil
	}

	return f.results[index],
		nil
}

func TestAcquireLease(
	t *testing.T,
) {
	t.Parallel()

	redis :=
		&fakeRedis{
			results: []int64{
				7,
			},
		}

	manager, err :=
		New(
			redis,
			15*time.Second,
		)

	if err != nil {
		t.Fatal(err)
	}

	lease, acquired, err :=
		manager.Acquire(
			context.Background(),
			"meeting-1",
			"instance-a",
		)

	if err != nil {
		t.Fatal(err)
	}

	if !acquired {
		t.Fatal(
			"expected lease acquisition",
		)
	}

	if lease.Fence != 7 {
		t.Fatalf(
			"expected fence 7, got %d",
			lease.Fence,
		)
	}

	if lease.Token == "" {
		t.Fatal(
			"expected unique lease token",
		)
	}
}

func TestAcquireReturnsFalseWhenOwned(
	t *testing.T,
) {
	t.Parallel()

	redis :=
		&fakeRedis{
			results: []int64{
				0,
			},
		}

	manager, err :=
		New(
			redis,
			DefaultTTL,
		)

	if err != nil {
		t.Fatal(err)
	}

	_, acquired, err :=
		manager.Acquire(
			context.Background(),
			"meeting-1",
			"instance-b",
		)

	if err != nil {
		t.Fatal(err)
	}

	if acquired {
		t.Fatal(
			"expected acquisition to fail when lease is already owned",
		)
	}
}

func TestRenewLease(
	t *testing.T,
) {
	t.Parallel()

	redis :=
		&fakeRedis{
			results: []int64{
				1,
			},
		}

	manager, err :=
		New(
			redis,
			DefaultTTL,
		)

	if err != nil {
		t.Fatal(err)
	}

	renewed, err :=
		manager.Renew(
			context.Background(),
			Lease{
				MeetingID: "meeting-1",

				OwnerID: "instance-a",

				Token: "token-a",

				Fence: 4,
			},
		)

	if err != nil {
		t.Fatal(err)
	}

	if !renewed {
		t.Fatal(
			"expected lease renewal",
		)
	}
}

func TestReleaseRejectsStaleToken(
	t *testing.T,
) {
	t.Parallel()

	redis :=
		&fakeRedis{
			results: []int64{
				0,
			},
		}

	manager, err :=
		New(
			redis,
			DefaultTTL,
		)

	if err != nil {
		t.Fatal(err)
	}

	released, err :=
		manager.Release(
			context.Background(),
			Lease{
				MeetingID: "meeting-1",

				OwnerID: "instance-old",

				Token: "stale-token",

				Fence: 1,
			},
		)

	if err != nil {
		t.Fatal(err)
	}

	if released {
		t.Fatal(
			"stale lease must not release current ownership",
		)
	}
}

func TestLeaseKeysShareRedisClusterSlot(
	t *testing.T,
) {
	t.Parallel()

	expectedLease :=
		"lumos:meeting:{meeting-1}:runtime-lease"

	expectedFence :=
		"lumos:meeting:{meeting-1}:runtime-fence"

	if LeaseKey(
		"meeting-1",
	) != expectedLease {
		t.Fatalf(
			"unexpected lease key %q",
			LeaseKey(
				"meeting-1",
			),
		)
	}

	if FenceKey(
		"meeting-1",
	) != expectedFence {
		t.Fatalf(
			"unexpected fence key %q",
			FenceKey(
				"meeting-1",
			),
		)
	}
}
