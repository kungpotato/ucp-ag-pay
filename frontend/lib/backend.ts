import type { Cart, CheckoutResult, Order, Product } from "./types";

// The Go backend's CORS policy is wide open (see backend/main.go), so this
// same client works unmodified from a Server Component (Node fetch), a
// Client Component (browser fetch) and the /api/agent route (Node fetch).
export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080";

async function asJSON<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function listCatalog(query = ""): Promise<Product[]> {
  const url = new URL("/ucp/catalog", BACKEND_URL);
  if (query) url.searchParams.set("q", query);
  const res = await fetch(url, { cache: "no-store" });
  const data = await asJSON<{ products: Product[] }>(res);
  return data.products;
}

export async function getProduct(id: string): Promise<Product> {
  const res = await fetch(new URL(`/ucp/catalog/${id}`, BACKEND_URL), {
    cache: "no-store",
  });
  return asJSON<Product>(res);
}

export async function createCart(): Promise<Cart> {
  const res = await fetch(new URL("/ucp/cart", BACKEND_URL), {
    method: "POST",
  });
  return asJSON<Cart>(res);
}

export async function getCart(id: string): Promise<Cart> {
  const res = await fetch(new URL(`/ucp/cart/${id}`, BACKEND_URL), {
    cache: "no-store",
  });
  return asJSON<Cart>(res);
}

export async function addItem(
  cartId: string,
  productId: string,
  quantity: number,
): Promise<Cart> {
  const res = await fetch(new URL(`/ucp/cart/${cartId}/items`, BACKEND_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_id: productId, quantity }),
  });
  return asJSON<Cart>(res);
}

export async function checkout(
  cartId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ order_id: string; checkout_url: string; session_id: string }> {
  const res = await fetch(
    new URL(`/ucp/cart/${cartId}/checkout`, BACKEND_URL),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success_url: successUrl, cancel_url: cancelUrl }),
    },
  );
  return asJSON(res);
}

export async function settleWithSPT(
  cartId: string,
  sharedPaymentToken?: string,
): Promise<CheckoutResult> {
  const res = await fetch(
    new URL(`/ucp/cart/${cartId}/checkout`, BACKEND_URL),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shared_payment_token: sharedPaymentToken,
        wallet_type: "stripe_link",
      }),
    },
  );
  return asJSON<CheckoutResult>(res);
}

export async function getOrder(id: string): Promise<Order> {
  const res = await fetch(new URL(`/orders/${id}`, BACKEND_URL), {
    cache: "no-store",
  });
  return asJSON<Order>(res);
}
