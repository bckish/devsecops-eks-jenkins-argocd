package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"regexp"
	"sync"
	"time"
)

var orderPattern = regexp.MustCompile(`^demo-[a-zA-Z0-9-]{1,48}$`)

type payment struct {
	OrderID     string `json:"orderId"`
	AmountCents int64  `json:"amountCents"`
	Status      string `json:"status"`
	Synthetic   bool   `json:"synthetic"`
}

func newHandler() http.Handler {
	var mu sync.Mutex
	records := map[string]payment{}
	mux := http.NewServeMux()
	write := func(w http.ResponseWriter, status int, value any) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(value)
	}
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		write(w, 200, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("POST /payments", func(w http.ResponseWriter, r *http.Request) {
		var in payment
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&in); err != nil || decoder.Decode(new(any)) != io.EOF || !orderPattern.MatchString(in.OrderID) || in.AmountCents < 1 || in.AmountCents > 100000 || in.Status != "" || in.Synthetic {
			write(w, 400, map[string]string{"error": "invalid synthetic payment"})
			return
		}
		mu.Lock()
		defer mu.Unlock()
		if prior, ok := records[in.OrderID]; ok {
			if prior.AmountCents != in.AmountCents {
				write(w, 409, map[string]string{"error": "order amount conflict"})
				return
			}
			write(w, 200, prior)
			return
		}
		if len(records) >= 1000 {
			write(w, 503, map[string]string{"error": "demo capacity reached"})
			return
		}
		in.Status = "MOCK_APPROVED"
		in.Synthetic = true
		records[in.OrderID] = in
		write(w, 201, in)
	})
	return mux
}

func main() {
	server := &http.Server{Addr: ":8080", Handler: newHandler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 30 * time.Second}
	log.Fatal(server.ListenAndServe())
}
