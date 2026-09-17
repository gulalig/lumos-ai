package redisstream

import "fmt"

func EvidenceStreamKey(
	meetingID string,
) string {
	return fmt.Sprintf(
		"lumos:meeting:{%s}:evidence",
		meetingID,
	)
}
