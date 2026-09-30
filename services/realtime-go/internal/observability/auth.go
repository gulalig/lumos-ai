package observability

import (
	"crypto/sha256"
	"crypto/subtle"
	"net/http"
	"strings"
)

// Empty tokens are permitted only by config validation for local development
// or an explicitly private deployment port. Never trust forwarded headers here.
func ProtectMetrics(next http.Handler, token string) http.Handler {
	if token == "" {
		return next
	}
	expected := sha256.Sum256([]byte(token))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		value, bearer := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		actual := sha256.Sum256([]byte(value))
		// Hash both inputs to the same length before the constant-time comparison.
		// Evaluate the comparison even when the header scheme is invalid.
		valid := subtle.ConstantTimeCompare(actual[:], expected[:]) == 1
		if !bearer || !valid {
			w.Header().Set("WWW-Authenticate", "Bearer")
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
