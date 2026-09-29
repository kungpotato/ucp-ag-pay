"use client";

import { useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };

export default function AgentPage() {
  const [turns, setTurns] = useState<Turn[]>([
    { role: "assistant", content: "สวัสดีครับ อยากได้หนังสือแนวไหนวันนี้? ลองพิมพ์ เช่น \"อยากได้หนังสือเกี่ยวกับ AI agent\"" },
  ]);
  const [input, setInput] = useState("");
  const [cartId, setCartId] = useState<string | null>(null);
  const [backendUsed, setBackendUsed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, loading]);

  async function send() {
    const message = input.trim();
    if (!message || loading) return;
    setInput("");
    const nextTurns: Turn[] = [...turns, { role: "user", content: message }];
    setTurns(nextTurns);
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: nextTurns.slice(0, -1),
          cart_id: cartId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "agent error");

      setCartId(data.cart_id);
      setBackendUsed(data.backend);
      setTurns((t) => [...t, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setTurns((t) => [
        ...t,
        { role: "assistant", content: `เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : String(err)}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Shopping Agent</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Agent ตัวนี้เชื่อมต่อกับ UCP API เพื่อค้นหาและจัดการตะกร้าสินค้า พร้อมรองรับทั้ง Manual Checkout และ 
        <strong className="text-emerald-400 font-medium"> Autonomous Agentic Settlement</strong> ด้วย Stripe Shared Payment Tokens (SPT)
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-3 py-1 font-medium text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Stripe Link Agent Wallet Protocol (SPT Active · Mandate Limit: ฿2,500/tx)
        </span>
        {backendUsed && (
          <span className="rounded-full bg-neutral-800 px-2.5 py-1 text-neutral-400 border border-neutral-700">
            engine: {backendUsed}
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="mt-6 flex h-[420px] flex-col gap-3 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-900/40 p-4"
      >
        {turns.map((t, i) => {
          const isSPT = t.content.includes("Shared Payment Token") || t.content.includes("spt_link_");
          return (
            <div
              key={i}
              className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                t.role === "user"
                  ? "self-end bg-emerald-600 text-white"
                  : isSPT
                  ? "self-start border border-emerald-500/50 bg-neutral-900/90 text-neutral-100 shadow-lg shadow-emerald-950/30"
                  : "self-start bg-neutral-800 text-neutral-100"
              }`}
            >
              {isSPT && (
                <div className="mb-2 flex items-center gap-1.5 border-b border-emerald-800/60 pb-1.5 text-xs font-semibold text-emerald-400">
                  <span>⚡ Stripe Link Wallet · Autonomous Settlement</span>
                </div>
              )}
              {t.content}
            </div>
          );
        })}
        {loading && <div className="self-start text-xs text-neutral-500">กำลังคิด...</div>}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder='ลองพิมพ์ "ซื้อ Settlement Layers แล้วตัดเงินผ่าน Stripe Link ให้ด้วย"'
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <button
          onClick={send}
          disabled={loading}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          ส่ง
        </button>
      </div>
    </div>
  );
}
