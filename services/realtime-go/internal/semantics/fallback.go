package semantics

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"lumos/realtime-go/internal/evidence"
)

type fallbackReason string

const (
	fallbackReasonNone fallbackReason = ""

	fallbackReasonPrimaryEmpty fallbackReason = "primary_empty"

	fallbackReasonNoValidCandidates fallbackReason = "no_valid_candidates"

	fallbackReasonOnlyUnknown fallbackReason = "only_unknown"

	fallbackReasonCoverageGap fallbackReason = "coverage_gap"
)

type FallbackExtractor struct {
	primary Extractor

	fallback Extractor

	logger *slog.Logger
}

func NewFallbackExtractor(
	primary Extractor,
	fallback Extractor,
	logger *slog.Logger,
) *FallbackExtractor {
	return &FallbackExtractor{
		primary: primary,

		fallback: fallback,

		logger: logger,
	}
}

func (e *FallbackExtractor) Extract(
	ctx context.Context,
	turn evidence.Turn,
) ([]Candidate, error) {
	primaryCandidates, err :=
		e.primary.Extract(
			ctx,
			turn,
		)

	if err != nil {
		e.logger.Warn(
			"primary semantic extractor failed, using fallback",
			"meetingId",
			turn.MeetingID,
			"eventId",
			turn.EventID,
			"error",
			err,
		)

		return e.extractFallback(
			ctx,
			turn,
		)
	}

	reason :=
		fallbackReasonFor(
			primaryCandidates,
			turn,
		)

	if reason ==
		fallbackReasonNone {
		return primaryCandidates,
			nil
	}

	e.logger.Info(
		"primary semantic extraction requires fallback",
		"meetingId",
		turn.MeetingID,
		"eventId",
		turn.EventID,
		"reason",
		reason,
	)

	fallbackCandidates, err :=
		e.extractFallback(
			ctx,
			turn,
		)

	if err != nil {
		return nil,
			err
	}

	switch reason {
	case fallbackReasonPrimaryEmpty,
		fallbackReasonNoValidCandidates,
		fallbackReasonOnlyUnknown:

		return fallbackCandidates,
			nil

	case fallbackReasonCoverageGap:
		merged :=
			mergeCoverageCandidates(
				primaryCandidates,
				fallbackCandidates,
				turn,
			)

		e.logger.Info(
			"semantic fallback results merged",
			"meetingId",
			turn.MeetingID,
			"eventId",
			turn.EventID,
			"primaryCandidateCount",
			len(
				primaryCandidates,
			),
			"fallbackCandidateCount",
			len(
				fallbackCandidates,
			),
			"mergedCandidateCount",
			len(
				merged,
			),
		)

		return merged,
			nil

	default:
		return fallbackCandidates,
			nil
	}
}

// ExtractContext preserves the same primary/fallback behavior
// while allowing grounding against a bounded adjacent-turn
// evidence window.
//
// Previous evidence is context only. Coverage detection still
// belongs to the CURRENT turn so an old decision marker does not
// cause an already-existing decision to be emitted again.
func (e *FallbackExtractor) ExtractContext(
	ctx context.Context,
	input EvidenceContext,
) ([]Candidate, error) {
	primaryCandidates, err :=
		extractFromContext(
			ctx,
			e.primary,
			input,
		)

	if err != nil {
		e.logger.Warn(
			"primary contextual semantic extractor failed, using fallback",
			"meetingId",
			input.Current.MeetingID,
			"eventId",
			input.Current.EventID,
			"error",
			err,
		)

		return e.extractFallbackContext(
			ctx,
			input,
		)
	}

	reason :=
		fallbackReasonForContext(
			primaryCandidates,
			input,
		)

	if reason ==
		fallbackReasonNone {
		return primaryCandidates,
			nil
	}

	e.logger.Info(
		"primary contextual semantic extraction requires fallback",
		"meetingId",
		input.Current.MeetingID,
		"eventId",
		input.Current.EventID,
		"reason",
		reason,
	)

	fallbackCandidates, err :=
		e.extractFallbackContext(
			ctx,
			input,
		)

	if err != nil {
		return nil,
			err
	}

	switch reason {
	case fallbackReasonPrimaryEmpty,
		fallbackReasonNoValidCandidates,
		fallbackReasonOnlyUnknown:

		return fallbackCandidates,
			nil

	case fallbackReasonCoverageGap:
		merged :=
			mergeCoverageCandidatesContext(
				primaryCandidates,
				fallbackCandidates,
				input,
			)

		e.logger.Info(
			"contextual semantic fallback results merged",
			"meetingId",
			input.Current.MeetingID,
			"eventId",
			input.Current.EventID,
			"primaryCandidateCount",
			len(
				primaryCandidates,
			),
			"fallbackCandidateCount",
			len(
				fallbackCandidates,
			),
			"mergedCandidateCount",
			len(
				merged,
			),
		)

		return merged,
			nil

	default:
		return fallbackCandidates,
			nil
	}
}

func (e *FallbackExtractor) extractFallback(
	ctx context.Context,
	turn evidence.Turn,
) ([]Candidate, error) {
	candidates, err :=
		e.fallback.Extract(
			ctx,
			turn,
		)

	if err != nil {
		return nil,
			fmt.Errorf(
				"fallback semantic extraction: %w",
				err,
			)
	}

	e.logger.Info(
		"fallback semantic extraction completed",
		"meetingId",
		turn.MeetingID,
		"eventId",
		turn.EventID,
		"candidateCount",
		len(
			candidates,
		),
	)

	return candidates,
		nil
}

func (e *FallbackExtractor) extractFallbackContext(
	ctx context.Context,
	input EvidenceContext,
) ([]Candidate, error) {
	candidates, err :=
		extractFromContext(
			ctx,
			e.fallback,
			input,
		)

	if err != nil {
		return nil,
			fmt.Errorf(
				"fallback contextual semantic extraction: %w",
				err,
			)
	}

	e.logger.Info(
		"fallback contextual semantic extraction completed",
		"meetingId",
		input.Current.MeetingID,
		"eventId",
		input.Current.EventID,
		"candidateCount",
		len(
			candidates,
		),
	)

	return candidates,
		nil
}

func extractFromContext(
	ctx context.Context,
	extractor Extractor,
	input EvidenceContext,
) ([]Candidate, error) {
	contextual, ok := extractor.(ContextualExtractor)

	if !ok ||
		!input.HasPrevious() {

		return extractor.Extract(
			ctx,
			input.Current,
		)
	}

	return contextual.ExtractContext(
		ctx,
		input,
	)
}

func fallbackReasonFor(
	candidates []Candidate,
	turn evidence.Turn,
) fallbackReason {
	if len(candidates) == 0 {
		return fallbackReasonPrimaryEmpty
	}

	validCount := 0
	usefulCount := 0

	for _, candidate := range candidates {

		if !candidateIsValid(
			candidate,
			turn,
		) {
			continue
		}

		validCount++

		if candidate.Kind !=
			KindUnknown {
			usefulCount++
		}
	}

	if validCount == 0 {
		return fallbackReasonNoValidCandidates
	}

	if usefulCount == 0 {
		return fallbackReasonOnlyUnknown
	}

	coverage :=
		AnalyzeCoverage(
			candidates,
			turn,
		)

	if coverage.HasGap() {
		return fallbackReasonCoverageGap
	}

	return fallbackReasonNone
}

func fallbackReasonForContext(
	candidates []Candidate,
	input EvidenceContext,
) fallbackReason {
	if len(candidates) == 0 {
		return fallbackReasonPrimaryEmpty
	}

	validCount := 0
	usefulCount := 0

	groundingText :=
		input.GroundingText()

	for _, candidate := range candidates {

		if !candidateIsValidWithEvidence(
			candidate,
			input.Current,
			groundingText,
		) {
			continue
		}

		validCount++

		if candidate.Kind !=
			KindUnknown {
			usefulCount++
		}
	}

	if validCount == 0 {
		return fallbackReasonNoValidCandidates
	}

	if usefulCount == 0 {
		return fallbackReasonOnlyUnknown
	}

	// Coverage deliberately examines only the current
	// evidence turn.
	//
	// Example:
	//
	// previous:
	//   "We decided to launch Friday."
	//
	// current:
	//   "Actually at 9 AM."
	//
	// The old decision marker must not cause us to
	// generate a second decision solely because it
	// appears in previous context.
	coverage :=
		AnalyzeCoverage(
			candidates,
			input.Current,
		)

	if coverage.HasGap() {
		return fallbackReasonCoverageGap
	}

	return fallbackReasonNone
}

func mergeCoverageCandidates(
	primaryCandidates []Candidate,
	fallbackCandidates []Candidate,
	turn evidence.Turn,
) []Candidate {
	result :=
		append(
			[]Candidate(nil),
			primaryCandidates...,
		)

	coverage :=
		AnalyzeCoverage(
			primaryCandidates,
			turn,
		)

	seen :=
		make(
			map[string]struct{},
			len(primaryCandidates)+
				len(
					fallbackCandidates,
				),
		)

	for _, candidate := range result {

		seen[candidateMergeKey(
			candidate,
		)] = struct{}{}
	}

	if coverage.ExpectsDecision &&
		!coverage.HasDecision {

		for _, candidate := range fallbackCandidates {

			if candidate.Kind !=
				KindDecision {
				continue
			}

			if !candidateIsValid(
				candidate,
				turn,
			) {
				continue
			}

			key :=
				candidateMergeKey(
					candidate,
				)

			if _, exists :=
				seen[key]; exists {
				continue
			}

			result =
				append(
					result,
					candidate,
				)

			seen[key] =
				struct{}{}
		}
	}

	return result
}

func mergeCoverageCandidatesContext(
	primaryCandidates []Candidate,
	fallbackCandidates []Candidate,
	input EvidenceContext,
) []Candidate {
	result :=
		append(
			[]Candidate(nil),
			primaryCandidates...,
		)

	// Again, coverage belongs to the CURRENT turn.
	coverage :=
		AnalyzeCoverage(
			primaryCandidates,
			input.Current,
		)

	seen :=
		make(
			map[string]struct{},
			len(primaryCandidates)+
				len(
					fallbackCandidates,
				),
		)

	for _, candidate := range result {

		seen[candidateMergeKey(
			candidate,
		)] = struct{}{}
	}

	if !coverage.ExpectsDecision ||
		coverage.HasDecision {
		return result
	}

	groundingText :=
		input.GroundingText()

	for _, candidate := range fallbackCandidates {

		if candidate.Kind !=
			KindDecision {
			continue
		}

		if !candidateIsValidWithEvidence(
			candidate,
			input.Current,
			groundingText,
		) {
			continue
		}

		key :=
			candidateMergeKey(
				candidate,
			)

		if _, exists :=
			seen[key]; exists {
			continue
		}

		result =
			append(
				result,
				candidate,
			)

		seen[key] =
			struct{}{}
	}

	return result
}

func candidateIsValid(
	candidate Candidate,
	turn evidence.Turn,
) bool {
	return candidateIsValidWithEvidence(
		candidate,
		turn,
		turn.Text,
	)
}

func candidateIsValidWithEvidence(
	candidate Candidate,
	turn evidence.Turn,
	groundingText string,
) bool {
	candidate = ResolveSpeakerOwner(
		candidate,
		groundingText,
		turn.ParticipantID,
	)

	if err :=
		ValidateGroundingForSpeaker(
			candidate,
			groundingText,
			turn.ParticipantID,
		); err != nil {

		return false
	}

	if _, err :=
		candidate.ToObservation(
			turn,
		); err != nil {

		return false
	}

	return true
}

func candidateMergeKey(
	candidate Candidate,
) string {
	return strings.Join(
		[]string{
			string(
				candidate.Kind,
			),

			normalizeEvidence(
				candidate.Summary,
			),

			normalizeEvidence(
				candidate.Owner,
			),

			normalizeEvidence(
				candidate.DueText,
			),
		},
		"|",
	)
}
