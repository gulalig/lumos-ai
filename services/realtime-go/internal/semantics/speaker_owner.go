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

	normalizedOwner :=
		normalizeEvidence(
			candidate.Owner,
		)

	// Demo participants use trusted LiveKit identities such as
	// "demo:maya" and "demo:alex".
	//
	// The semantic model may naturally return "Maya" or "Alex"
	// as the owner even when the evidence is first-person speech.
	//
	// Treat the suffix of the trusted speaker identity as an alias
	// for that same speaker.
	speakerAlias := ""

	if separator :=
		strings.LastIndex(
			speakerIdentity,
			":",
		); separator >= 0 &&
		separator+1 < len(speakerIdentity) {

		speakerAlias =
			normalizeEvidence(
				speakerIdentity[separator+1:],
			)
	}

	switch normalizedOwner {
	case "",
		"i",
		"me",
		"myself",
		"speaker",
		"the speaker":

		candidate.Owner =
			speakerIdentity

	default:
		if speakerAlias != "" &&
			normalizedOwner == speakerAlias {

			candidate.Owner =
				speakerIdentity
		}
	}

	return candidate
}
