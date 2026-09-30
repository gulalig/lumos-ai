package semantics

import (
	"regexp"
	"strings"
)

var deadlineAnswer = regexp.MustCompile(`(?i)^(?:(?:yeah|yes|okay|ok),?\s+)?((?:(?:on|by)\s+)?(?:(?:this|next)\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:(?:on|by)\s+)?(?:today|tomorrow)|(?:(?:on|by)\s+)?\d{4}-\d{2}-\d{2})(?:\s+(?:works|should work|is fine|is good))?[.!?]*$`)

// DeadlineAnswer recognizes a bounded clarification, preserving literal wording.
func DeadlineAnswer(text string) (string, bool) {
	match := deadlineAnswer.FindStringSubmatch(strings.TrimSpace(text))
	if len(match) != 2 {
		return "", false
	}
	return match[1], true
}

var responsibilityObject = regexp.MustCompile(`(?i)\bi can (?:also )?(?:take care of|take ownership of|handle)\s+(.+?)[.!?]*$`)

// SameResponsibility compares exact action objects in bounded meeting context,
// never fuzzy persisted execution titles. Only scoped check/review is normalized;
// every other object word must match so distinct deliverables stay distinct.
func SameResponsibility(previous, current string) bool {
	object := func(text string) string {
		match := responsibilityObject.FindStringSubmatch(strings.TrimSpace(text))
		if len(match) != 2 {
			return ""
		}
		words := strings.Fields(strings.Trim(strings.ToLower(match[1]), " .!?"))
		if len(words) > 0 && (words[0] == "the" || words[0] == "a") {
			words = words[1:]
		}
		if len(words) > 1 && words[len(words)-1] == "check" {
			words[len(words)-1] = "review"
		}
		return strings.Join(words, " ")
	}
	first, second := object(previous), object(current)
	return first != "" && first == second
}
