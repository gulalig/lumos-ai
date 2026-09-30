package intervention

import (
	"context"
	"errors"
	"fmt"
	"lumos/realtime-go/internal/redisclient"
)

var ErrStale = errors.New("intervention gap is already resolved")

func CheckCurrent(ctx context.Context, client *redisclient.Client, event Event) error {
	resolved, err := client.EvalInt64(ctx, `
local resolved = redis.call('HGET', KEYS[1], 'resolved_at_ms')
if resolved and resolved ~= '' then return 1 end
return 0
`, []string{fmt.Sprintf("lumos:meeting:{%s}:intervention-gap:%s", event.MeetingID, event.GapID)})
	if err != nil {
		return err
	}
	if resolved == 1 {
		return ErrStale
	}
	return nil
}
