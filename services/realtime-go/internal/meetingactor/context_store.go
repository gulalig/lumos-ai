package meetingactor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/redis/go-redis/v9"

	"lumos/realtime-go/internal/redisclient"
)

type ContextStore struct {
	redis *redisclient.Client
}

func NewContextStore(
	redisClient *redisclient.Client,
) *ContextStore {
	return &ContextStore{
		redis: redisClient,
	}
}

func (s *ContextStore) Load(
	ctx context.Context,
	meetingID string,
) (
	ContextCheckpoint,
	bool,
	error,
) {
	key :=
		ContextCheckpointKey(
			meetingID,
		)

	value, err :=
		s.redis.Get(
			ctx,
			key,
		)

	if err != nil {
		if errors.Is(
			err,
			redis.Nil,
		) {
			return ContextCheckpoint{},
				false,
				nil
		}

		return ContextCheckpoint{},
			false,
			fmt.Errorf(
				"load actor context checkpoint: %w",
				err,
			)
	}

	var checkpoint ContextCheckpoint

	if err := json.Unmarshal(
		[]byte(value),
		&checkpoint,
	); err != nil {
		return ContextCheckpoint{},
			false,
			fmt.Errorf(
				"decode actor context checkpoint: %w",
				err,
			)
	}

	if err :=
		checkpoint.Validate(); err != nil {

		return ContextCheckpoint{},
			false,
			fmt.Errorf(
				"validate actor context checkpoint: %w",
				err,
			)
	}

	return checkpoint,
		true,
		nil
}

func EncodeContextCheckpoint(
	checkpoint ContextCheckpoint,
) (string, error) {
	if err := checkpoint.Validate(); err != nil {
		return "",
			err
	}

	payload, err :=
		json.Marshal(
			checkpoint,
		)

	if err != nil {
		return "",
			fmt.Errorf(
				"encode actor context checkpoint: %w",
				err,
			)
	}

	return string(payload),
		nil
}
