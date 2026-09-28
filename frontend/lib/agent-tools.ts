import { addItem, checkout as backendCheckout, createCart, listCatalog } from "./backend";
import type { Cart } from "./types";

// Three tools, mapped 1:1 onto the same three UCP calls the manual "Buy Now"
// button makes (see app/book/[id]/buy-button.tsx). The agent has no special
// backend access — it is just another UCP client, which is the whole point
// of the protocol: the same commerce surface serves a human clicking
// buttons and an LLM calling functions. See docs/lesson-06.md.
export const toolSchemas = [
  {
    type: "function",
    function: {
      name: "search_catalog",
      description:
        "ค้นหาหนังสือในร้านจากชื่อเรื่อง ผู้แต่ง หรือคำอธิบาย คืนค่ารายการสินค้าพร้อมราคาและสต็อก",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "คำค้นหา เช่น ชื่อหนังสือหรือหัวข้อ" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_to_cart",
      description: "เพิ่มหนังสือลงตะกร้า (สร้างตะกร้าใหม่อัตโนมัติถ้ายังไม่มี)",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          quantity: { type: "integer", minimum: 1, default: 1 },
        },
        required: ["product_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "checkout",
      description:
        "สร้าง Stripe Checkout Session จากตะกร้าปัจจุบัน คืนค่าลิงก์ให้ผู้ใช้ไปจ่ายเงิน ใช้เมื่อผู้ใช้ยืนยันจะซื้อแล้วเท่านั้น",
      parameters: { type: "object", properties: {} },
    },
  },
] as const;

export type AgentContext = {
  cartId: string | null;
  origin: string;
};

export type ToolResult = {
  content: string; // fed back to the LLM as the tool result
  cart?: Cart;
  checkoutUrl?: string;
};

export async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  switch (name) {
    case "search_catalog": {
      const query = typeof args.query === "string" ? args.query : "";
      const products = await listCatalog(query);
      const slim = products.map((p) => ({
        id: p.id,
        title: p.title,
        author: p.author,
        price_thb: p.price.amount / 100,
        stock: p.stock,
      }));
      return { content: JSON.stringify(slim) };
    }

    case "add_to_cart": {
      const productId = String(args.product_id ?? "");
      const quantity = Number(args.quantity ?? 1) || 1;
      if (!ctx.cartId) {
        const cart = await createCart();
        ctx.cartId = cart.id;
      }
      const cart = await addItem(ctx.cartId, productId, quantity);
      return { content: JSON.stringify(cart), cart };
    }

    case "checkout": {
      if (!ctx.cartId) {
        return { content: "error: cart is empty, add items before checking out" };
      }
      const result = await backendCheckout(
        ctx.cartId,
        `${ctx.origin}/success?order_id={ORDER_ID}`,
        `${ctx.origin}/cancel`,
      );
      return {
        content: JSON.stringify({ checkout_url: result.checkout_url }),
        checkoutUrl: result.checkout_url,
      };
    }

    default:
      return { content: `error: unknown tool ${name}` };
  }
}
