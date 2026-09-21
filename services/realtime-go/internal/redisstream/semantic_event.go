package redisstream

import (
	"encoding/json"
	"fmt"

	"lumos/realtime-go/internal/redisclient"
	"lumos/realtime-go/internal/semantics"
)

const SemanticEventType = "semantic.observation.v1"

func EncodeSemanticStreamEntry(
	observation semantics.Observation,
) (
	redisclient.FencedStreamEntry,
	error,
) {
	if err :=
		observation.Validate(); err != nil {

		return redisclient.FencedStreamEntry{},
			fmt.Errorf(
				"validate semantic observation: %w",
				err,
			)
	}

	payload, err :=
		json.Marshal(
			observation,
		)

	if err != nil {
		return redisclient.FencedStreamEntry{},
			fmt.Errorf(
				"marshal semantic observation: %w",
				err,
			)
	}

	return redisclient.FencedStreamEntry{
		EventType: SemanticEventType,
		EventID:   observation.ID,
		Payload:   string(payload),
	}, nil
}
