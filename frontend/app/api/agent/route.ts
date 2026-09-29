import { NextRequest, NextResponse } from "next/server";
import { runFallbackAgent } from "@/lib/agent-fallback";
import { runLLMAgent } from "@/lib/agent-llm";
import type { AgentContext } from "@/lib/agent-tools";

type ChatTurn = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const body = await req.json();
  const message: string = body.message ?? "";
  const history: ChatTurn[] = body.history ?? [];
  const cartId: string | null = body.cart_id ?? null;

  if (!message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const ctx: AgentContext = { cartId, origin: req.nextUrl.origin };
  const usingLLM = Boolean(process.env.OPENROUTER_API_KEY);

  try {
    const result = usingLLM
      ? await runLLMAgent(history, message, ctx)
      : await runFallbackAgent(message, ctx);

    return NextResponse.json({
      reply: result.reply,
      cart_id: ctx.cartId,
      checkout_url: result.checkoutUrl ?? null,
      settled_order: result.settledOrder ?? null,
      backend: usingLLM ? "openrouter-gemini" : "rule-based-fallback",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
