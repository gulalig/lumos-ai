package meetingactor

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"lumos/realtime-go/internal/evidence"
	"lumos/realtime-go/internal/observability"
	"lumos/realtime-go/internal/semantics"
)

type Actor struct {
	meetingID string

	extractor semantics.Extractor

	logger *slog.Logger

	metrics *observability.Metrics

	// Consumer currently invokes Actor serially.
	//
	// These values are only committed after an
	// evidence event has been successfully processed.
	previousTurn         *evidence.Turn
	previousObservations []semantics.Observation
}

func New(
	meetingID string,
	extractor semantics.Extractor,
	logger *slog.Logger,
	metrics ...*observability.Metrics,
) *Actor {
	var metricsRecorder *observability.Metrics

	if len(metrics) > 0 {
		metricsRecorder =
			metrics[0]
	}

	return &Actor{
		meetingID: meetingID,

		extractor: extractor,

		logger: logger,

		metrics: metricsRecorder,
	}
}

func (a *Actor) HandleEvidence(
	ctx context.Context,
	payload string,
) error {
	prepared, err :=
		a.PrepareEvidence(
			ctx,
			payload,
		)

	if err != nil {
		return err
	}

	a.commitPrepared(
		prepared,
	)

	return nil
}

func (a *Actor) buildObservation(
	candidate semantics.Candidate,
	input semantics.EvidenceContext,
) (
	semantics.Observation,
	bool,
	error,
) {
	// Unknown is an extractor classification, not a durable
	// meeting outcome. Never publish it to the semantic stream.
	if candidate.Kind == semantics.KindUnknown {
		return semantics.Observation{},
			false,
			nil
	}

	if candidate.RefinesPrevious {
		if !input.HasPrevious() {
			return semantics.Observation{},
				false,
				fmt.Errorf(
					"candidate claims previous refinement without adjacent evidence",
				)
		}

		// Refinements behave like patches.
		//
		// If the current answer only supplies the missing field,
		// preserve already-grounded fields from the previous
		// commitment.
		//
		// Example:
		//
		// previous:
		//   owner = "Lumos developer"
		//   due   = ""
		//
		// current:
		//   "On Friday."
		//
		// model candidate:
		//   owner = ""
		//   due   = "Friday"
		//
		// result:
		//   owner = "Lumos developer"
		//   due   = "Friday"
		candidate =
			a.preserveCommitmentRefinementFields(
				candidate,
			)

		candidate =
			semantics.ResolveSpeakerOwner(
				candidate,
				input.GroundingText(),
				input.Current.ParticipantID,
			)

		supersedesID :=
			a.findSupersededObservation(
				candidate,
			)

		if supersedesID == "" {
			// Fail closed.
			//
			// If the model says "this refines previous"
			// but we cannot deterministically identify
			// the previous observation, publishing it as
			// a new item would create false duplicates.
			return semantics.Observation{},
				false,
				fmt.Errorf(
					"no deterministic previous observation matches refinement",
				)
		}

		if err :=
			semantics.ValidateGroundingForSpeaker(
				candidate,
				input.GroundingText(),
				input.Current.ParticipantID,
			); err != nil {

			return semantics.Observation{},
				false,
				err
		}

		observation, err :=
			candidate.ToContextObservation(
				input,
				supersedesID,
			)

		if err != nil {
			return semantics.Observation{},
				false,
				err
		}

		return observation,
			true,
			nil
	}

	// A normal candidate must be grounded solely in
	// the current turn. Previous context cannot lend
	// facts to a brand-new observation.
	candidate =
		semantics.ResolveSpeakerOwner(
			candidate,
			input.Current.Text,
			input.Current.ParticipantID,
		)

	if err :=
		semantics.ValidateGroundingForSpeaker(
			candidate,
			input.Current.Text,
			input.Current.ParticipantID,
		); err != nil {

		return semantics.Observation{},
			false,
			err
	}

	observation, err :=
		candidate.ToObservation(
			input.Current,
		)

	if err != nil {
		return semantics.Observation{},
			false,
			err
	}

	return observation,
		true,
		nil
}

func (a *Actor) preserveCommitmentRefinementFields(
	candidate semantics.Candidate,
) semantics.Candidate {
	if !candidate.RefinesPrevious ||
		candidate.Kind !=
			semantics.KindCommitment {

		return candidate
	}

	var previous *semantics.Observation

	for index := range a.previousObservations {

		observation :=
			&a.previousObservations[index]

		if observation.Kind !=
			semantics.KindCommitment {

			continue
		}

		// We only preserve fields when exactly one previous
		// commitment can be selected deterministically.
		if previous != nil {
			return candidate
		}

		previous =
			observation
	}

	if previous == nil {
		return candidate
	}

	if strings.TrimSpace(
		candidate.Summary,
	) == "" {

		candidate.Summary =
			previous.Summary
	}

	if strings.TrimSpace(
		candidate.Owner,
	) == "" {

		candidate.Owner =
			previous.Owner
	}

	if strings.TrimSpace(
		candidate.DueText,
	) == "" {

		candidate.DueText =
			previous.DueText
	}

	return candidate
}

func (a *Actor) hasSingleOwnerlessCommitment() bool {
	if len(
		a.previousObservations,
	) != 1 {

		return false
	}

	previous :=
		a.previousObservations[0]

	if previous.Kind !=
		semantics.KindCommitment {

		return false
	}

	return strings.TrimSpace(
		previous.Owner,
	) == ""
}

func (a *Actor) findSupersededObservation(
	candidate semantics.Candidate,
) string {
	matches :=
		make(
			[]semantics.Observation,
			0,
			1,
		)

	for _, previous := range a.previousObservations {

		if previous.Kind !=
			candidate.Kind {

			continue
		}

		switch candidate.Kind {
		case semantics.KindCommitment:
			previousOwner :=
				strings.TrimSpace(
					previous.Owner,
				)

			candidateOwner :=
				strings.TrimSpace(
					candidate.Owner,
				)

			// Existing ownership must not disappear.
			if previousOwner != "" &&
				candidateOwner == "" {

				continue
			}

			// Missing ownership may be completed later.
			//
			// Existing ownership may only change when the
			// difference looks like a narrow STT correction.
			if previousOwner != "" &&
				!strings.EqualFold(
					previousOwner,
					candidateOwner,
				) &&
				!likelyOwnerTranscriptionCorrection(
					previousOwner,
					candidateOwner,
				) {

				continue
			}

		case semantics.KindDecision:
			// A previous turn may contain multiple
			// decisions. We only accept a revision
			// when exactly one deterministic match
			// survives this filter.

		default:
			// Revision semantics for proposal/question
			// are intentionally not enabled yet.
			continue
		}

		matches =
			append(
				matches,
				previous,
			)
	}

	if len(matches) != 1 {
		return ""
	}

	return matches[0].ID
}

func likelyOwnerTranscriptionCorrection(
	previous string,
	current string,
) bool {
	previous =
		strings.ToLower(
			strings.Join(
				strings.Fields(
					previous,
				),
				" ",
			),
		)

	current =
		strings.ToLower(
			strings.Join(
				strings.Fields(
					current,
				),
				" ",
			),
		)

	if previous == "" ||
		current == "" {

		return false
	}

	if previous == current {
		return true
	}

	previousRunes :=
		[]rune(
			previous,
		)

	currentRunes :=
		[]rune(
			current,
		)

	// Avoid fuzzy-merging short names such as
	// "Alex" and "Alec".
	if len(previousRunes) < 8 ||
		len(currentRunes) < 8 {

		return false
	}

	lengthDifference :=
		len(previousRunes) -
			len(currentRunes)

	if lengthDifference < 0 {
		lengthDifference =
			-lengthDifference
	}

	if lengthDifference > 1 {
		return false
	}

	return editDistanceAtMostOne(
		previousRunes,
		currentRunes,
	)
}

func editDistanceAtMostOne(
	left []rune,
	right []rune,
) bool {
	if len(left) == len(right) {
		differences := 0

		for index := range left {

			if left[index] ==
				right[index] {

				continue
			}

			differences++

			if differences > 1 {
				return false
			}
		}

		return differences <= 1
	}

	if len(left) >
		len(right) {

		left,
			right =
			right,
			left
	}

	leftIndex := 0
	rightIndex := 0
	differences := 0

	for leftIndex < len(left) &&
		rightIndex < len(right) {

		if left[leftIndex] ==
			right[rightIndex] {

			leftIndex++
			rightIndex++

			continue
		}

		differences++

		if differences > 1 {
			return false
		}

		rightIndex++
	}

	return true
}

func (a *Actor) ContextCheckpoint(
	evidenceStreamID string,
) ContextCheckpoint {
	checkpoint :=
		ContextCheckpoint{
			SchemaVersion: ContextCheckpointSchemaVersion,

			MeetingID: a.meetingID,

			EvidenceStreamID: evidenceStreamID,

			Observations: append(
				[]semantics.Observation(nil),
				a.previousObservations...,
			),
		}

	if a.previousTurn != nil {
		checkpoint.Turn =
			*a.previousTurn
	}

	return checkpoint
}

func (a *Actor) RestoreContext(
	checkpoint ContextCheckpoint,
) error {
	if err :=
		checkpoint.Validate(); err != nil {

		return err
	}

	if checkpoint.MeetingID !=
		a.meetingID {

		return fmt.Errorf(
			"actor context meeting mismatch: expected %q, got %q",
			a.meetingID,
			checkpoint.MeetingID,
		)
	}

	turnCopy :=
		checkpoint.Turn

	a.previousTurn =
		&turnCopy

	a.previousObservations =
		append(
			[]semantics.Observation(nil),
			checkpoint.Observations...,
		)

	a.logger.Info(
		"meeting actor context restored",
		"meetingId",
		a.meetingID,
		"eventId",
		turnCopy.EventID,
		"evidenceStreamId",
		checkpoint.EvidenceStreamID,
		"observationCount",
		len(
			checkpoint.Observations,
		),
	)

	return nil
}
