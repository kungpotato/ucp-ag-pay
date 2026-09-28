# Lesson 06 — AI Shopping Agent (OpenRouter · Gemini 3.8 Flash · Tool Calling)

![agent chat demo](media/lesson-06/demo.gif)

## Goal
สร้าง agent ที่ "ซื้อของแทนผู้ใช้" ได้จริงผ่าน UCP endpoint เดิมจาก lesson 02–03 — เพื่อพิสูจน์ว่า commerce surface ที่ออกแบบมาให้มนุษย์ใช้ก็ใช้กับ agent ได้โดยไม่ต้องเปลี่ยนอะไรที่ backend เลยสักบรรทัดเดียว

## สิ่งที่ทำ
`frontend/lib/agent-tools.ts` ประกาศ tool 3 ตัวให้ LLM เรียก:

```
search_catalog(query)          → GET /ucp/catalog?q=
add_to_cart(product_id, qty)   → POST /ucp/cart, POST /ucp/cart/:id/items
checkout()                     → POST /ucp/cart/:id/checkout
```

`frontend/lib/agent-llm.ts` ทำ tool-calling loop กับ OpenRouter (model: `google/gemini-3.8-flash`, ปรับได้ผ่าน `OPENROUTER_MODEL`): ส่ง message + tool schema ไป, ถ้า LLM ขอเรียก tool ก็รันจริงแล้วส่งผลลัพธ์กลับเข้า conversation, วนจนกว่า LLM จะตอบเป็นข้อความล้วน (สูงสุด 4 รอบกันหลุด loop)

System prompt (`SYSTEM_PROMPT`) บังคับกติกา 2 ข้อที่สำคัญมากสำหรับ agentic payment:
1. ห้ามเดา `product_id` เอง ต้อง `search_catalog` ก่อนเสมอ
2. ต้องถามยืนยันสั้น ๆ ก่อนเรียก `checkout` ทุกครั้ง — agent ห้ามจ่ายเงินโดยผู้ใช้ไม่รู้ตัว

## ทำไม fallback แบบ rule-based ต้องมีด้วย
`frontend/lib/agent-fallback.ts` คือ deterministic parser (regex ง่าย ๆ) ที่ทำงานแทนเมื่อไม่ได้ตั้งค่า `OPENROUTER_API_KEY` — จุดประสงค์คือแยกให้ชัดว่า **"เข้าใจภาษาธรรมชาติ" กับ "ทำธุรกรรมถูกต้อง" เป็นคนละเลเยอร์กัน** ถ้า LLM หลอน (hallucinate) เรื่อง tool call ผิด ๆ ความเสียหายที่เกิดได้จำกัดอยู่แค่ "เลือกหนังสือผิดเล่ม" ไม่ใช่ "จ่ายเงินผิดจำนวน" เพราะ backend เองก็ validate ราคา/สต็อกซ้ำอีกชั้นอยู่ดี (`backend/cart.go`)

## เทียบกับแบบอื่น
| แบบ | ข้อดี | ข้อเสีย |
|---|---|---|
| ผูก agent เข้ากับ backend โดยตรง (function เรียก Go code ในโปรเซสเดียวกัน) | เร็วกว่า, ไม่มี network hop | agent ผูกกับ implementation เฉพาะเจาะจง ย้าย backend ไปภาษาอื่นแล้วต้องเขียนใหม่ |
| **Agent เป็น UCP client เหมือน UI ปกติ (ที่เลือกใช้)** | agent framework ไหนก็เชื่อมได้ ตราบใดที่เรียก HTTP ได้ — สลับ LLM provider ได้อิสระ | มี network overhead เพิ่มขึ้นเล็กน้อย |
| ให้ agent เข้าถึง database ตรง ๆ | เร็วที่สุด | ข้าม business logic/validation ทั้งหมดใน backend — อันตรายมากกับเงิน |

## ต่อยอดได้อะไร
- เพิ่ม tool `remove_from_cart`, `view_cart` ให้ agent จัดการตะกร้าซับซ้อนขึ้นได้
- เก็บ conversation state ฝั่ง server (ตอนนี้ client ส่ง history กลับมาเองทุกครั้ง) เพื่อรองรับหลาย device
- ลองสลับ `OPENROUTER_MODEL` เป็นรุ่นอื่นเทียบคุณภาพการเรียก tool
