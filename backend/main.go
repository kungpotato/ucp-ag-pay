package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
)

type Server struct {
	catalog       *Catalog
	carts         *CartStore
	orders        *OrderStore
	stripe        *StripeClient
	webhookSecret string
}

func main() {
	loadDotEnv("../.env", ".env")

	port := getenv("PORT", "8080")
	s := &Server{
		catalog:       NewCatalog(),
		carts:         NewCartStore(),
		orders:        NewOrderStore(),
		stripe:        NewStripeClient(os.Getenv("STRIPE_SECRET_KEY")),
		webhookSecret: os.Getenv("STRIPE_WEBHOOK_SECRET"),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.handleHealth)

	// --- UCP-inspired commerce surface -------------------------------
	mux.HandleFunc("GET /ucp/catalog", s.handleListCatalog)
	mux.HandleFunc("GET /ucp/catalog/{id}", s.handleGetProduct)
	mux.HandleFunc("POST /ucp/cart", s.handleCreateCart)
	mux.HandleFunc("GET /ucp/cart/{id}", s.handleGetCart)
	mux.HandleFunc("POST /ucp/cart/{id}/items", s.handleAddItem)
	mux.HandleFunc("POST /ucp/cart/{id}/checkout", s.handleCheckout)

	// --- Settlement / post-purchase handoff ---------------------------
	mux.HandleFunc("GET /orders/{id}", s.handleGetOrder)
	mux.HandleFunc("POST /webhooks/stripe", s.handleStripeWebhook)

	log.Printf("ucp-ag-pay backend listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, withCORS(withLogging(mux))))
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// --- middleware ---------------------------------------------------------

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}

// withCORS is permissive on purpose: this is a local workshop backend the
// Next.js dev server (a different origin/port) calls directly from the
// browser. Lock this down to a real allow-list before deploying anywhere.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- JSON helpers ---------------------------------------------------------

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func decodeJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		return err
	}
	if len(strings.TrimSpace(string(body))) == 0 {
		return nil
	}
	return json.Unmarshal(body, v)
}

// --- handlers ---------------------------------------------------------

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleListCatalog(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	writeJSON(w, http.StatusOK, map[string]any{"products": s.catalog.Find(q)})
}

func (s *Server) handleGetProduct(w http.ResponseWriter, r *http.Request) {
	p, ok := s.catalog.Get(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusNotFound, "product not found")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) handleCreateCart(w http.ResponseWriter, r *http.Request) {
	cart := s.carts.Create()
	writeJSON(w, http.StatusCreated, cart)
}

func (s *Server) handleGetCart(w http.ResponseWriter, r *http.Request) {
	cart, ok := s.carts.Get(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusNotFound, "cart not found")
		return
	}
	writeJSON(w, http.StatusOK, cart)
}

type addItemRequest struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
}

func (s *Server) handleAddItem(w http.ResponseWriter, r *http.Request) {
	var req addItemRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	cart, err := s.carts.AddItem(r.PathValue("id"), s.catalog, req.ProductID, req.Quantity)
	switch err {
	case nil:
		writeJSON(w, http.StatusOK, cart)
	case ErrNotFound:
		writeError(w, http.StatusNotFound, "cart or product not found")
	case ErrOutOfStock:
		writeError(w, http.StatusConflict, "requested quantity exceeds stock")
	default:
		writeError(w, http.StatusInternalServerError, err.Error())
	}
}

type checkoutRequest struct {
	SuccessURL         string `json:"success_url"`
	CancelURL          string `json:"cancel_url"`
	SharedPaymentToken string `json:"shared_payment_token,omitempty"`
	WalletType         string `json:"wallet_type,omitempty"`
}

func (s *Server) handleCheckout(w http.ResponseWriter, r *http.Request) {
	var req checkoutRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	cart, ok := s.carts.Get(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusNotFound, "cart not found")
		return
	}
	if len(cart.Items) == 0 {
		writeError(w, http.StatusUnprocessableEntity, "cart is empty")
		return
	}

	// Autonomous Agentic Settlement via Stripe Link Wallet Protocol (SPT):
	// AI agent settles directly without redirecting the user to interactive checkout.
	if req.SharedPaymentToken != "" || req.WalletType == "stripe_link" {
		token := req.SharedPaymentToken
		if token == "" {
			token = "spt_link_" + newID("tok")[4:]
		}
		order := s.orders.Create(cart.ID, cart.Subtotal())
		pi, err := s.stripe.SettlePaymentWithSPT(cart, order.ID, token)
		if err != nil {
			writeError(w, http.StatusBadGateway, "stripe settlement error: "+err.Error())
			return
		}
		s.orders.MarkPaidWithSPT(order.ID, pi.ID, token)
		writeJSON(w, http.StatusOK, map[string]any{
			"order_id":             order.ID,
			"status":               "paid",
			"payment_method":       "stripe_link_spt",
			"shared_payment_token": token,
			"payment_intent_id":    pi.ID,
			"total":                order.Total,
		})
		return
	}

	if req.SuccessURL == "" || req.CancelURL == "" {
		writeError(w, http.StatusBadRequest, "success_url and cancel_url are required")
		return
	}

	order := s.orders.Create(cart.ID, cart.Subtotal())
	// Mirrors Stripe's own {CHECKOUT_SESSION_ID} templating: the caller
	// doesn't know order.ID until we've created it, so it sends a
	// placeholder and we substitute the real id before redirecting.
	successURL := strings.ReplaceAll(req.SuccessURL, "{ORDER_ID}", order.ID)
	session, err := s.stripe.CreateCheckoutSession(cart, order.ID, successURL, req.CancelURL)
	if err != nil {
		writeError(w, http.StatusBadGateway, "stripe error: "+err.Error())
		return
	}
	s.orders.AttachSession(order.ID, session.ID)

	writeJSON(w, http.StatusCreated, map[string]any{
		"order_id":     order.ID,
		"checkout_url": session.URL,
		"session_id":   session.ID,
	})
}

func (s *Server) handleGetOrder(w http.ResponseWriter, r *http.Request) {
	order, ok := s.orders.Get(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusNotFound, "order not found")
		return
	}
	writeJSON(w, http.StatusOK, order)
}

// stripeEvent is only the sliver of Stripe's event envelope this workshop
// reacts to. A production integration should handle far more event types
// (async payment failures, disputes, refunds...) — see docs/lesson-07.md.
type stripeEvent struct {
	Type string `json:"type"`
	Data struct {
		Object struct {
			ID string `json:"id"`
		} `json:"object"`
	} `json:"data"`
}

func (s *Server) handleStripeWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		writeError(w, http.StatusBadRequest, "cannot read body")
		return
	}
	defer r.Body.Close()

	if err := verifyStripeSignature(body, r.Header.Get("Stripe-Signature"), s.webhookSecret, defaultTolerance); err != nil {
		writeError(w, http.StatusBadRequest, "signature verification failed: "+err.Error())
		return
	}

	var evt stripeEvent
	if err := json.Unmarshal(body, &evt); err != nil {
		writeError(w, http.StatusBadRequest, "invalid event payload")
		return
	}

	switch evt.Type {
	case "checkout.session.completed", "checkout.session.async_payment_succeeded":
		if order, ok := s.orders.MarkBySessionID(evt.Data.Object.ID, OrderPaid); ok {
			log.Printf("order %s marked paid via %s", order.ID, evt.Type)
		}
	case "checkout.session.async_payment_failed", "checkout.session.expired":
		if order, ok := s.orders.MarkBySessionID(evt.Data.Object.ID, OrderFailed); ok {
			log.Printf("order %s marked failed via %s", order.ID, evt.Type)
		}
	default:
		// Idempotent no-op: unrecognised events are acknowledged, not errored,
		// so Stripe doesn't retry-storm us for events we simply don't act on.
	}

	writeJSON(w, http.StatusOK, map[string]bool{"received": true})
}
