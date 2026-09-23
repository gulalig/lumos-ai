package semantics

import "strings"

// ResolveSpeakerOwner converts a first-person commitment owner
// into trusted speaker metadata.
//
// It is deliberately narrow:
//   - commitment only
//   - explicit commitment only
//   - explicit first-person wording must exist in evidence
//   - only empty/pronoun/generic-speaker owners are rewritten
//
// A different named owner is NEVER overwritten.
func ResolveSpeakerOwner(
	candidate Candidate,
	evidenceText string,
	speakerIdentity string,
) Candidate {
	if candidate.Kind != KindCommitment ||
		!candidate.Explicit {
		return candidate
	}

	speakerIdentity =
		strings.TrimSpace(
			speakerIdentity,
		)

	if speakerIdentity == "" {
		return candidate
	}

	hasSpeakerOwnershipEvidence :=
		containsExplicitFirstPersonCommitment(
			evidenceText,
		) ||
			containsExplicitOwnershipAcceptance(
				evidenceText,
			)

	if !hasSpeakerOwnershipEvidence {
		return candidate
	}

	switch normalizeEvidence(
		candidate.Owner,
	) {
	case "",
		"i",
		"me",
		"myself",
		"speaker",
		"the speaker":

		candidate.Owner =
			speakerIdentity
	}

	return candidate
}
