package meetinglease

import (
	"context"
	"errors"
	"testing"
	"time"
)

type fakeRenewer struct {
	results []bool
	errs    []error
	calls   int
}

func (f *fakeRenewer) Renew(
	_ context.Context,
	_ Lease,
) (bool, error) {
	index :=
		f.calls

	f.calls++

	var renewed bool

	if index < len(
		f.results,
	) {
		renewed =
			f.results[index]
	}

	var err error

	if index < len(
		f.errs,
	) {
		err =
			f.errs[index]
	}

	return renewed,
		err
}

func testLease() Lease {
	return Lease{
		MeetingID: "meeting-1",

		OwnerID: "instance-a",

		Token: "token-a",

		Fence: 1,
	}
}

func TestKeeperRenewsLease(
	t *testing.T,
) {
	t.Parallel()

	renewer :=
		&fakeRenewer{
			results: []bool{
				true,
				true,
				true,
			},
		}

	keeper, err :=
		NewKeeper(
			renewer,
			5*time.Millisecond,
		)

	if err != nil {
		t.Fatal(err)
	}

	ctx, cancel :=
		context.WithTimeout(
			context.Background(),
			18*time.Millisecond,
		)

	defer cancel()

	err =
		keeper.Run(
			ctx,
			testLease(),
		)

	if err != nil {
		t.Fatalf(
			"expected graceful context shutdown, got %v",
			err,
		)
	}

	if renewer.calls < 2 {
		t.Fatalf(
			"expected multiple lease renewals, got %d",
			renewer.calls,
		)
	}
}

func TestKeeperFailsWhenLeaseLost(
	t *testing.T,
) {
	t.Parallel()

	renewer :=
		&fakeRenewer{
			results: []bool{
				false,
			},
		}

	keeper, err :=
		NewKeeper(
			renewer,
			time.Millisecond,
		)

	if err != nil {
		t.Fatal(err)
	}

	ctx, cancel :=
		context.WithTimeout(
			context.Background(),
			time.Second,
		)

	defer cancel()

	err =
		keeper.Run(
			ctx,
			testLease(),
		)

	if !errors.Is(
		err,
		ErrLeaseLost,
	) {
		t.Fatalf(
			"expected ErrLeaseLost, got %v",
			err,
		)
	}
}

func TestKeeperFailsClosedOnRedisError(
	t *testing.T,
) {
	t.Parallel()

	expected :=
		errors.New(
			"redis unavailable",
		)

	renewer :=
		&fakeRenewer{
			results: []bool{
				false,
			},

			errs: []error{
				expected,
			},
		}

	keeper, err :=
		NewKeeper(
			renewer,
			time.Millisecond,
		)

	if err != nil {
		t.Fatal(err)
	}

	err =
		keeper.Run(
			context.Background(),
			testLease(),
		)

	if err == nil {
		t.Fatal(
			"expected renewal error",
		)
	}

	if !errors.Is(
		err,
		expected,
	) {
		t.Fatalf(
			"expected wrapped redis error, got %v",
			err,
		)
	}
}

func TestManagerRenewalInterval(
	t *testing.T,
) {
	t.Parallel()

	manager, err :=
		New(
			&fakeRedis{},
			15*time.Second,
		)

	if err != nil {
		t.Fatal(err)
	}

	if manager.RenewalInterval() !=
		5*time.Second {

		t.Fatalf(
			"expected 5s renewal interval, got %s",
			manager.RenewalInterval(),
		)
	}
}
