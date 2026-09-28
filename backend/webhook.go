package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"time"
)

const defaultTolerance = 5 * time.Minute

// verifyStripeSignature re-implements Stripe's documented webhook check by
// hand (https://docs.stripe.com/webhooks#verify-manually) instead of
// pulling in stripe-go, since this is the one piece of the whole workshop
// worth seeing in the open: the header is "t=<timestamp>,v1=<hex hmac>",
// the signed payload is "<timestamp>.<raw body>", and the secret is the
// whsec_... value `stripe listen` prints.
func verifyStripeSignature(payload []byte, sigHeader, secret string, tolerance time.Duration) error {
	if secret == "" {
		return fmt.Errorf("STRIPE_WEBHOOK_SECRET is not set")
	}

	var timestamp string
	var signatures []string
	for _, part := range strings.Split(sigHeader, ",") {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		switch kv[0] {
		case "t":
			timestamp = kv[1]
		case "v1":
			signatures = append(signatures, kv[1])
		}
	}
	if timestamp == "" || len(signatures) == 0 {
		return fmt.Errorf("malformed Stripe-Signature header")
	}

	signedPayload := timestamp + "." + string(payload)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signedPayload))
	expected := hex.EncodeToString(mac.Sum(nil))

	match := false
	for _, sig := range signatures {
		if hmac.Equal([]byte(sig), []byte(expected)) {
			match = true
			break
		}
	}
	if !match {
		return fmt.Errorf("signature mismatch")
	}

	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid timestamp")
	}
	age := time.Since(time.Unix(ts, 0))
	if age > tolerance || age < -tolerance {
		return fmt.Errorf("timestamp outside tolerance (replay protection)")
	}
	return nil
}
