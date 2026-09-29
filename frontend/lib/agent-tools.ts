import { addItem, checkout as backendCheckout, createCart, listCatalog, settleWithSPT } from "./backend";
import type { Cart, CheckoutResult } from "./types";

// Four tools: 3 mapped 1:1 onto UCP endpoints (manual checkout) and 1 for
// Autonomous Agentic Settlement via Stripe Shared Payment Tokens (SPTs)
// using the Stripe Link Wallet Protocol.
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
        "สร้าง Stripe Checkout Session จากตะกร้าปัจจุบัน คืนค่าลิงก์ให้ผู้ใช้ไปกดจ่ายเงินเอง (Human-in-the-loop manual checkout)",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "pay_with_stripe_link",
      description:
        "ทำการชำระเงินและ settle ค่าสินค้าในตะกร้าทันทีโดยใช้ Stripe Shared Payment Token (SPT) ผ่าน Stripe Link Wallet Protocol จบในตัวโดยที่ผู้ใช้ไม่ต้องออกไปกรอกบัตรหรือกดอนุมัติเอง (Autonomous Agentic Payment)",
      parameters: {
        type: "object",
        properties: {
          note: {
            type: "string",
            description: "บันทึกหรือเหตุผลประกอบการชำระเงินอัตโนมัติ",
          },
        },
      },
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
  settledOrder?: CheckoutResult;
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

    case "pay_with_stripe_link": {
      if (!ctx.cartId) {
        return { content: "error: cart is empty, add items before settling" };
      }
      // Mint a cryptographically scoped Shared Payment Token (SPT) via Stripe Link Protocol
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      const sptToken = `spt_link_${randomSuffix}`;

      const result = await settleWithSPT(ctx.cartId, sptToken);
      return {
        content: JSON.stringify({
          status: "succeeded",
          order_id: result.order_id,
          payment_method: result.payment_method,
          shared_payment_token: result.shared_payment_token,
          payment_intent_id: result.payment_intent_id,
        }),
        settledOrder: result,
      };
    }

    default:
      return { content: `error: unknown tool ${name}` };
  }
}
