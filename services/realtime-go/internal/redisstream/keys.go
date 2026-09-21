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

func SemanticStreamKey(
	meetingID string,
) string {
	return fmt.Sprintf(
		"lumos:meeting:{%s}:semantics",
		meetingID,
	)
}

func EvidenceDeadLetterStreamKey(
	meetingID string,
) string {
	return fmt.Sprintf(
		"lumos:meeting:{%s}:evidence-dlq",
		meetingID,
	)
}
