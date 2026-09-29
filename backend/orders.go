package main

import (
	"sync"
	"time"
)

type OrderStatus string

const (
	OrderPendingPayment OrderStatus = "pending_payment"
	OrderPaid           OrderStatus = "paid"
	OrderFailed         OrderStatus = "failed"
)

// Order is UCP's "post-purchase handoff" object: what the buyer (human or
// agent) polls after checkout to know whether settlement finished. Status
// only ever moves forward via the Stripe webhook — never from the checkout
// call itself, because the checkout call only proves a session was created,
// not that money moved.
type Order struct {
	ID                  string      `json:"id"`
	CartID              string      `json:"cart_id"`
	StripeSessionID     string      `json:"stripe_session_id,omitempty"`
	StripePaymentIntent string      `json:"stripe_payment_intent_id,omitempty"`
	PaymentMethod       string      `json:"payment_method,omitempty"`
	SharedPaymentToken  string      `json:"shared_payment_token,omitempty"`
	Status              OrderStatus `json:"status"`
	Total               Money       `json:"total"`
	CreatedAt           time.Time   `json:"created_at"`
	UpdatedAt           time.Time   `json:"updated_at"`
}

type OrderStore struct {
	mu          sync.RWMutex
	orders      map[string]*Order
	bySessionID map[string]string // stripe session id -> order id
}

func NewOrderStore() *OrderStore {
	return &OrderStore{orders: map[string]*Order{}, bySessionID: map[string]string{}}
}

func (s *OrderStore) Create(cartID string, total Money) *Order {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	o := &Order{
		ID:        newID("order"),
		CartID:    cartID,
		Status:    OrderPendingPayment,
		Total:     total,
		CreatedAt: now,
		UpdatedAt: now,
	}
	s.orders[o.ID] = o
	return o
}

func (s *OrderStore) AttachSession(orderID, sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if o, ok := s.orders[orderID]; ok {
		o.StripeSessionID = sessionID
		s.bySessionID[sessionID] = orderID
	}
}

func (s *OrderStore) Get(id string) (*Order, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	o, ok := s.orders[id]
	return o, ok
}

func (s *OrderStore) MarkBySessionID(sessionID string, status OrderStatus) (*Order, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	orderID, ok := s.bySessionID[sessionID]
	if !ok {
		return nil, false
	}
	o := s.orders[orderID]
	o.Status = status
	o.UpdatedAt = time.Now()
	return o, true
}

func (s *OrderStore) MarkPaidWithSPT(orderID, paymentIntentID, sptToken string) (*Order, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	o, ok := s.orders[orderID]
	if !ok {
		return nil, false
	}
	o.Status = OrderPaid
	o.PaymentMethod = "stripe_link_spt"
	o.StripePaymentIntent = paymentIntentID
	o.SharedPaymentToken = sptToken
	o.UpdatedAt = time.Now()
	return o, true
}

