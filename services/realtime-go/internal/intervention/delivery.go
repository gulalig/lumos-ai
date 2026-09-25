package intervention

import (
	"fmt"
	"strings"
)

const deliveryStateDelivered = "delivered"

func deliveryKey(
	meetingID string,
	eventID string,
) string {
	meetingID =
		strings.TrimSpace(
			meetingID,
		)

	eventID =
		strings.TrimSpace(
			eventID,
		)

	return fmt.Sprintf(
		"lumos:meeting:{%s}:intervention-delivery:%s",
		meetingID,
		eventID,
	)
}
