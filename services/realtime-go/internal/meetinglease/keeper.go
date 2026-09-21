package meetinglease

import (
	"context"
	"errors"
	"fmt"
	"time"
)

var ErrLeaseLost = errors.New(
	"meeting lease ownership lost",
)

type Renewer interface {
	Renew(
		ctx context.Context,
		lease Lease,
	) (bool, error)
}

type Keeper struct {
	renewer  Renewer
	interval time.Duration
}

func NewKeeper(
	renewer Renewer,
	interval time.Duration,
) (*Keeper, error) {
	if renewer == nil {
		return nil,
			errors.New(
				"lease renewer is required",
			)
	}

	if interval <= 0 {
		return nil,
			errors.New(
				"lease renewal interval must be positive",
			)
	}

	return &Keeper{
		renewer:  renewer,
		interval: interval,
	}, nil
}

func (k *Keeper) Run(
	ctx context.Context,
	lease Lease,
) error {
	if err :=
		validateLease(
			lease,
		); err != nil {

		return err
	}

	ticker :=
		time.NewTicker(
			k.interval,
		)

	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil

		case <-ticker.C:
			renewed, err :=
				k.renewer.Renew(
					ctx,
					lease,
				)

			if err != nil {
				return fmt.Errorf(
					"%w: renew meeting lease: %w",
					ErrLeaseLost,
					err,
				)
			}

			if !renewed {
				return ErrLeaseLost
			}
		}
	}
}
