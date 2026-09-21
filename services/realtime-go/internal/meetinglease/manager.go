package meetinglease

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

const DefaultTTL = 15 * time.Second

var (
	ErrMissingMeetingID = errors.New(
		"meeting id is required",
	)

	ErrMissingOwnerID = errors.New(
		"lease owner id is required",
	)

	ErrInvalidTTL = errors.New(
		"lease ttl must be positive",
	)

	ErrInvalidFence = errors.New(
		"lease fence must be positive",
	)
)

type RedisEvaluator interface {
	EvalInt64(
		ctx context.Context,
		script string,
		keys []string,
		args ...any,
	) (int64, error)
}

type Lease struct {
	MeetingID string

	// Identifies the realtime service instance.
	OwnerID string

	// Unique per acquisition.
	//
	// Even the same process cannot accidentally renew or
	// release a newer lease using an older runtime handle.
	Token string

	// Monotonically increasing ownership generation.
	//
	// Later we can propagate this to state-changing work
	// as a fencing token.
	Fence int64
}

type Manager struct {
	redis RedisEvaluator
	ttl   time.Duration
}

func New(
	redis RedisEvaluator,
	ttl time.Duration,
) (*Manager, error) {
	if redis == nil {
		return nil,
			errors.New(
				"redis evaluator is required",
			)
	}

	if ttl <= 0 {
		return nil,
			ErrInvalidTTL
	}

	return &Manager{
		redis: redis,
		ttl:   ttl,
	}, nil
}

func (m *Manager) Acquire(
	ctx context.Context,
	meetingID string,
	ownerID string,
) (
	Lease,
	bool,
	error,
) {
	meetingID =
		strings.TrimSpace(
			meetingID,
		)

	ownerID =
		strings.TrimSpace(
			ownerID,
		)

	if meetingID == "" {
		return Lease{},
			false,
			ErrMissingMeetingID
	}

	if ownerID == "" {
		return Lease{},
			false,
			ErrMissingOwnerID
	}

	token :=
		uuid.NewString()

	fence, err :=
		m.redis.EvalInt64(
			ctx,
			acquireScript,
			[]string{
				LeaseKey(
					meetingID,
				),
				FenceKey(
					meetingID,
				),
			},
			token,
			m.ttl.Milliseconds(),
		)

	if err != nil {
		return Lease{},
			false,
			fmt.Errorf(
				"acquire meeting lease: %w",
				err,
			)
	}

	if fence == 0 {
		return Lease{},
			false,
			nil
	}

	if fence < 0 {
		return Lease{},
			false,
			ErrInvalidFence
	}

	return Lease{
			MeetingID: meetingID,

			OwnerID: ownerID,

			Token: token,

			Fence: fence,
		},
		true,
		nil
}

func (m *Manager) Renew(
	ctx context.Context,
	lease Lease,
) (
	bool,
	error,
) {
	if err :=
		validateLease(
			lease,
		); err != nil {

		return false,
			err
	}

	result, err :=
		m.redis.EvalInt64(
			ctx,
			renewScript,
			[]string{
				LeaseKey(
					lease.MeetingID,
				),
			},
			lease.Token,
			m.ttl.Milliseconds(),
		)

	if err != nil {
		return false,
			fmt.Errorf(
				"renew meeting lease: %w",
				err,
			)
	}

	return result == 1,
		nil
}

func (m *Manager) Release(
	ctx context.Context,
	lease Lease,
) (
	bool,
	error,
) {
	if err :=
		validateLease(
			lease,
		); err != nil {

		return false,
			err
	}

	result, err :=
		m.redis.EvalInt64(
			ctx,
			releaseScript,
			[]string{
				LeaseKey(
					lease.MeetingID,
				),
			},
			lease.Token,
		)

	if err != nil {
		return false,
			fmt.Errorf(
				"release meeting lease: %w",
				err,
			)
	}

	return result == 1,
		nil
}

func LeaseKey(
	meetingID string,
) string {
	return "lumos:meeting:{" +
		meetingID +
		"}:runtime-lease"
}

func FenceKey(
	meetingID string,
) string {
	return "lumos:meeting:{" +
		meetingID +
		"}:runtime-fence"
}

func validateLease(
	lease Lease,
) error {
	if strings.TrimSpace(
		lease.MeetingID,
	) == "" {
		return ErrMissingMeetingID
	}

	if strings.TrimSpace(
		lease.OwnerID,
	) == "" {
		return ErrMissingOwnerID
	}

	if strings.TrimSpace(
		lease.Token,
	) == "" {
		return errors.New(
			"lease token is required",
		)
	}

	if lease.Fence <= 0 {
		return ErrInvalidFence
	}

	return nil
}

func (m *Manager) RenewalInterval() time.Duration {
	interval :=
		m.ttl / 3

	if interval <= 0 {
		return time.Millisecond
	}

	return interval
}
