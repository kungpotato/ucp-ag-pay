// Mirrors backend/*.go JSON shapes 1:1. Kept hand-written and dependency-free
// (no codegen from the Go source) since this workshop is small enough that
// "read both files side by side" is still faster than wiring up a generator.

export type Money = {
  amount: number; // smallest currency unit
  currency: string;
};

export type Product = {
  id: string;
  title: string;
  author: string;
  description: string;
  image_url: string;
  price: Money;
  stock: number;
};

export type LineItem = {
  product_id: string;
  title: string;
  quantity: number;
  unit_price: Money;
};

export type Cart = {
  id: string;
  items: LineItem[];
  created_at: string;
};

export type OrderStatus = "pending_payment" | "paid" | "failed";

export type Order = {
  id: string;
  cart_id: string;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  payment_method?: "stripe_checkout" | "stripe_link_spt";
  shared_payment_token?: string;
  status: OrderStatus;
  total: Money;
  created_at: string;
  updated_at: string;
};

export type CheckoutResult = {
  order_id: string;
  checkout_url?: string;
  session_id?: string;
  status?: string;
  payment_method?: string;
  shared_payment_token?: string;
  payment_intent_id?: string;
  total?: Money;
};

export function formatMoney(m: Money): string {
  const major = m.amount / 100;
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: m.currency.toUpperCase(),
  }).format(major);
}
