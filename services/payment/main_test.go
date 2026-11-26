package main

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestMockPayment(t *testing.T) {
	h := newHandler()
	for _, tc := range []struct {
		body string
		code int
	}{
		{`{"orderId":"demo-one","amountCents":100}`, 201},
		{`{"orderId":"demo-one","amountCents":100}`, 200},
		{`{"orderId":"demo-one","amountCents":200}`, 409},
		{`{"orderId":"real-one","amountCents":100}`, 400},
		{`{"orderId":"demo-two","amountCents":-1}`, 400},
	} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("POST", "/payments", strings.NewReader(tc.body)))
		if w.Code != tc.code {
			t.Fatalf("got %d, want %d: %s", w.Code, tc.code, w.Body.String())
		}
	}
}
