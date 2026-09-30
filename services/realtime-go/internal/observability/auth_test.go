package observability

import (
	"bytes"
	"go/ast"
	"go/parser"
	"go/token"
	"log"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestProtectMetrics(t *testing.T) {
	for _, test := range []struct {
		token, header string
		status        int
	}{
		{"fixture", "", 401}, {"fixture", "Bearer wrong", 401},
		{"fixture", "Bearer fixture", 204}, {"", "", 204},
	} {
		handler := ProtectMetrics(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNoContent)
		}), test.token)
		request := httptest.NewRequest("GET", "/metrics", nil)
		request.Header.Set("Authorization", test.header)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != test.status {
			t.Errorf("got %d, want %d", response.Code, test.status)
		}
	}
}

func TestProtectMetricsReachesRealHandlerOnlyWithValidCredentials(t *testing.T) {
	for _, header := range []string{"", "Bearer invalid", "Basic fixture", "bearer fixture", "Bearer fixture extra", "Bearer fixture"} {
		t.Run(header, func(t *testing.T) {
			called := false
			metrics := NewMetrics()
			handler := ProtectMetrics(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				called = true
				metrics.Handler().ServeHTTP(w, r)
			}), "fixture")
			request := httptest.NewRequest(http.MethodGet, "/metrics", nil)
			request.Header.Set("Authorization", header)
			// Forwarded addresses must never bypass bearer authentication.
			request.Header.Set("X-Forwarded-For", "127.0.0.1")
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if header == "Bearer fixture" {
				if !called || response.Code != http.StatusOK || response.Body.Len() == 0 {
					t.Fatal("valid credentials did not reach the metrics handler")
				}
			} else if called || response.Code != http.StatusUnauthorized || response.Header().Get("WWW-Authenticate") != "Bearer" {
				t.Fatal("invalid credentials reached metrics or lacked a 401 challenge")
			}
		})
	}
}

func TestProtectMetricsWithoutTokenPreservesInternalHandler(t *testing.T) {
	handler := http.NewServeMux()
	handler.Handle("/metrics", NewMetrics().Handler())
	if ProtectMetrics(handler, "") != handler {
		t.Fatal("unconfigured internal metrics handler must remain unchanged")
	}
}

// Timing benchmarks cannot reliably prove constant-time behavior. Inspect the
// implementation instead: both inputs are fixed-length SHA-256 digests, and the
// standard library constant-time primitive compares those digests.
func TestProtectMetricsUsesFixedLengthConstantTimeComparison(t *testing.T) {
	source, err := parser.ParseFile(token.NewFileSet(), "auth.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	hashes, comparisons := 0, 0
	ast.Inspect(source, func(node ast.Node) bool {
		call, ok := node.(*ast.CallExpr)
		if !ok {
			return true
		}
		selector, ok := call.Fun.(*ast.SelectorExpr)
		if !ok {
			return true
		}
		pkg, ok := selector.X.(*ast.Ident)
		if !ok {
			return true
		}
		if pkg.Name == "sha256" && selector.Sel.Name == "Sum256" {
			hashes++
		}
		if pkg.Name == "subtle" && selector.Sel.Name == "ConstantTimeCompare" {
			comparisons++
			for _, arg := range call.Args {
				if _, ok := arg.(*ast.SliceExpr); !ok {
					t.Fatal("constant-time comparison must receive fixed-length digest slices")
				}
			}
		}
		return true
	})
	if hashes != 2 || comparisons != 1 {
		t.Fatal("metrics credentials must use two fixed-length hashes and one constant-time comparison")
	}
}

func TestProtectMetricsDoesNotEmitSecrets(t *testing.T) {
	const secret = "metrics-test-secret-not-a-real-credential"
	var output bytes.Buffer
	originalOutput, originalLogger := log.Writer(), slog.Default()
	log.SetOutput(&output)
	slog.SetDefault(slog.New(slog.NewJSONHandler(&output, nil)))
	defer func() {
		slog.SetDefault(originalLogger)
		log.SetOutput(originalOutput)
	}()
	for _, supplied := range []string{secret + "-invalid", secret} {
		handler := ProtectMetrics(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNoContent)
		}), secret)
		request := httptest.NewRequest(http.MethodGet, "/metrics", nil)
		request.Header.Set("Authorization", "Bearer "+supplied)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if strings.Contains(response.Body.String(), secret) || strings.Contains(response.Header().Get("WWW-Authenticate"), secret) {
			t.Fatal("credential appeared in HTTP response")
		}
	}
	if output.Len() != 0 {
		t.Fatal("metrics authentication should not log credentials or failed authorization headers")
	}
}
