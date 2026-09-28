"use client";

import { useState } from "react";
import { addItem, checkout, createCart } from "@/lib/backend";

export default function BuyButton({ productId }: { productId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function handleBuy() {
    setState("loading");
    setError("");
    try {
      // The three UCP calls a "manual" checkout makes — an agent makes the
      // exact same three calls from app/api/agent/route.ts, see lesson 06.
      const cart = await createCart();
      await addItem(cart.id, productId, 1);
      const origin = window.location.origin;
      const { checkout_url } = await checkout(
        cart.id,
        `${origin}/success?order_id={ORDER_ID}`,
        `${origin}/cancel`,
      );
      window.location.href = checkout_url;
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="mt-6">
      <button
        onClick={handleBuy}
        disabled={state === "loading"}
        className="rounded-md bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-400 disabled:opacity-60"
      >
        {state === "loading" ? "กำลังสร้าง Checkout..." : "ซื้อเลย (Stripe Checkout)"}
      </button>
      {state === "error" && (
        <p className="mt-2 text-xs text-red-400">เกิดข้อผิดพลาด: {error}</p>
      )}
    </div>
  );
}
