package meetingstate

type Snapshot struct {
	MeetingID string `json:"meetingId"`
	Version   uint64 `json:"version"`

	Decisions   []Item `json:"decisions"`
	Commitments []Item `json:"commitments"`
	Proposals   []Item `json:"proposals"`
	Questions   []Item `json:"questions"`
}

func cloneItems(
	items []Item,
) []Item {
	result :=
		make(
			[]Item,
			len(items),
		)

	copy(
		result,
		items,
	)

	for index := range result {

		result[index].
			SupportingEvidenceEventIDs =
			append(
				[]string(nil),
				items[index].
					SupportingEvidenceEventIDs...,
			)
	}

	return result
}
