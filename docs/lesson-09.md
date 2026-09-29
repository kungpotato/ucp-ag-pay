# Lesson 09 — Autonomous Settlement: Stripe Shared Payment Tokens (SPT) & Link Wallet Protocol

![autonomous settlement demo](media/lesson-09/demo.gif)

## Goal
ก้าวข้ามข้อจำกัดของ **"Human-in-the-loop Checkout"** ที่ผู้ใช้ต้องกดลิงก์ออกไปหน้า Stripe Checkout เพื่อจ่ายเงินเองทุกครั้ง — เข้าสู่ **"True Autonomous Agentic Commerce"** ที่ AI Agent สามารถร้องขอโทเคนการชำระเงินที่ถูกจำกัดสิทธิ์ (**Shared Payment Token - SPT**) จากกระเป๋าเงิน **Stripe Link Wallet Protocol** แล้วทำการ settle เงินบน Backend จบได้ด้วยตนเองในคำสั่งเดียว

## ทำไม Shared Payment Tokens (SPT) ถึงเป็นหัวใจของ Agentic Commerce
ในบทเรียนที่ 06–07 เมื่อ Agent สั่งซื้อของ มันทำได้สูงสุดแค่สร้าง `checkout_url` แล้วส่งลิงก์ให้ผู้ใช้คลิกไปจ่ายเงินเอง ถ้าในชีวิตจริงเราต้องการให้ Agent ทำงานอัตโนมัติเต็มรูปแบบ (เช่น สั่งซื้อวัตถุดิบเติมสต็อกเมื่อของหมด, ซื้อบัตรสัมมนาทันทีที่เปิดขาย) การต้องรอให้คนมากดอนุมัติทุกรอบจะทำให้สูญเสียความเป็น Agentic ไป

แต่การจะให้ Agent ตัดเงินเองโดยตรง **มีโจทย์ความปลอดภัยที่ห้ามละเมิดเด็ดขาด**:
1. **ห้ามให้ Agent ถือเลขบัตรเครดิตจริง (PAN/CVC):** เสี่ยงต่อ Prompt Injection, Data Leak และผิดกฎหมาย PCI-DSS
2. **ห้ามให้อำนาจไม่จำกัด (Blank Check):** ผู้ใช้ต้องกำหนดขอบเขตวงเงิน (Spending Mandate) ได้

Stripe และมาตรฐาน **Agentic Commerce Protocol (ACP)** จึงออกแบบ **Shared Payment Token (SPT)** ขึ้นมา:
* **Token ถูก Scoped เฉพาะเจาะจง:** ผูกกับร้านค้าหนึ่งร้าน (`merchant`), วงเงินไม่เกินยอดในตะกร้า (`cart total`), และมีอายุสั้นมาก (`TTL`)
* **Agent ไม่เห็นข้อมูลบัตร:** Agent คุยกับ Stripe Link Wallet เพื่อขอ SPT (`spt_link_...`) แล้วส่งต่อให้ Merchant Backend นำไปตัดเงินผ่าน Stripe PaymentIntent ได้โดยตรง

## สถาปัตยกรรม Stripe Link Agent Wallet Protocol
```
[ผู้ใช้]
   │ 1. อนุญาตสิทธิ์กระเป๋าเงิน (Delegated Spending Mandate สูงสุด 2,500 บาท/ครั้ง)
   ▼
[AI Shopping Agent]
   │ 2. ค้นหาหนังสือ (search_catalog) & หยิบใส่ตะกร้า (add_to_cart)
   │ 3. ขอ Shared Payment Token ตามยอดเงินจริงจาก Link Wallet Protocol
   ▼
[Stripe Link Wallet Protocol]
   │ 4. ออก Shared Payment Token (spt_link_9a41de08) ที่ถูกจำกัดสิทธิ์
   ▼
[AI Shopping Agent]
   │ 5. ส่งคำสั่งชำระเงิน machine-to-machine พร้อมแนบ SPT
   ▼
[Go Backend - UCP Engine]
   │ 6. เรียก Stripe PaymentIntent (confirm: true, payment_method: spt_...)
   ▼
[Stripe Settlement Engine]
   │ 7. Settle เงินสำเร็จทันที (สถานะ: paid) โดยไม่ต้อง redirect ผู้ใช้ออกไป
   ▼
[AI Shopping Agent] ── 8. ตอบยืนยันใบเสร็จและ Order ID ให้ผู้ใช้ในแชททันที
```

## สิ่งที่ทำ (Implementation)

1. **Backend รองรับ Autonomous SPT Settlement (`backend/`)**:
   * [`backend/stripe.go`](file:///Users/kittisak/workspace/agentic-payment/ucp-ag-pay/backend/stripe.go): เพิ่มฟังก์ชัน `SettlePaymentWithSPT` ยิง Stripe PaymentIntent API (`POST /v1/payment_intents`) ส่ง `payment_method: spt_...`, `confirm: true`, พร้อม metadata กำกับ `agentic_spt`
   * [`backend/orders.go`](file:///Users/kittisak/workspace/agentic-payment/ucp-ag-pay/backend/orders.go): บันทึกข้อมูลการชำระเงินของคำสั่งซื้อเป็น `payment_method: "stripe_link_spt"` และบันทึก `shared_payment_token`
   * [`backend/main.go`](file:///Users/kittisak/workspace/agentic-payment/ucp-ag-pay/backend/main.go): ปรับ `handleCheckout` ให้ตรวจจับคำขอที่มี `shared_payment_token` หรือ `wallet_type: "stripe_link"` ถ้าพบจะ settle เงินทันทีและส่งผลลัพธ์ `status: paid` กลับโดยไม่ต้องพึ่งพา session redirect

2. **Frontend Agent Tools & LLM System Prompt (`frontend/lib/`)**:
   * [`frontend/lib/agent-tools.ts`](file:///Users/kittisak/workspace/agentic-payment/ucp-ag-pay/frontend/lib/agent-tools.ts): เพิ่มเครื่องมือ `pay_with_stripe_link` ทำหน้าที่จำลองการ mint SPT จาก Link Wallet Protocol แล้วเรียก `settleWithSPT`
   * [`frontend/lib/agent-llm.ts`](file:///Users/kittisak/workspace/agentic-payment/ucp-ag-pay/frontend/lib/agent-llm.ts): ปรับ System Prompt ให้เข้าใจสิทธิ์ของ Stripe Link Wallet (Pre-authorized Mandate) และรู้ว่าเมื่อผู้ใช้บอกให้ "ซื้อและตัดเงินเลย" หรือ "ใช้ Stripe Link" ให้เรียก `pay_with_stripe_link` เพื่อจบธุรกรรมได้ทันที
   * [`frontend/lib/agent-fallback.ts`](file:///Users/kittisak/workspace/agentic-payment/ucp-ag-pay/frontend/lib/agent-fallback.ts): รองรับคำสั่งเสียง/ข้อความที่ระบุความจำนงอัตโนมัติ เช่น `"ซื้อ Settlement Layers แล้วตัดเงินผ่าน Stripe Link ให้ด้วย"`

3. **UI แสดงสถานะกระเป๋าเงินและใบเสร็จอัตโนมัติ (`frontend/app/agent/page.tsx`)**:
   * เพิ่มแถบ Badge แสดงสถานะ `Stripe Link Agent Wallet Protocol (SPT Active · Mandate Limit: ฿2,500/tx)`
   * ปรับแต่งการแสดงผลในห้องแชทให้แยกประเภทกล่องข้อความที่มี Shared Payment Token ออกมาเป็น Card ใบเสร็จพิเศษพร้อมสถานะ `Paid ✅`

## เปรียบเทียบ: Manual Checkout (Lesson 04) vs Autonomous SPT (Lesson 09)

| คุณสมบัติ | Manual Stripe Checkout (Lesson 04) | Autonomous Stripe Link SPT (Lesson 09) |
|---|---|---|
| **ประสบการณ์ผู้ใช้ (UX)** | ต้องคลิกลิงก์ออกไปหน้า Stripe, กรอกข้อมูล, กดยืนยัน | พิมพ์สั่งคำเดียวในแชท จบกระบวนการทันที |
| **ระดับความเป็น Agentic** | Assisted (Agent แค่ช่วยหยิบของใส่ตะกร้า) | **Fully Autonomous** (Agent ทำการสั่งซื้อและชำระเงินแทน) |
| **ความปลอดภัยของข้อมูลบัตร** | ไม่ผ่านเซิร์ฟเวอร์เรา (ผู้ใช้พิมพ์บนหน้า Stripe) | **ไม่ผ่านทั้ง Agent และเซิร์ฟเวอร์เรา** (Link Wallet จ่ายผ่าน Token) |
| **การควบคุมความเสี่ยง** | มนุษย์ตรวจสอบยอดก่อนคลิกจ่ายทุกครั้ง | ควบคุมผ่าน **Delegated Spending Mandate** (จำกัดเพดานวงเงิน/ประเภทร้าน) |
| **ความเหมาะสม** | การซื้อสินค้ามูลค่าสูง, การตัดสินใจเฉพาะหน้า | การซื้อสินค้าประจำ, การตั้งโปรแกรมสั่งซื้ออัตโนมัติ (M2M) |

## ต่อยอดได้อะไร
* **Dynamic Approval Threshold:** กำหนดยอดเงินขั้นต่ำ เช่น ถ้ายอดไม่เกิน 500 บาท ให้ Agent ตัดผ่าน SPT อัตโนมัติทันที แต่ถ้าเกิน 500 บาท ให้ fallback กลับไปส่งลิงก์ Checkout ถามยืนยัน
* **Multi-Network Tokenization:** เชื่อมต่อกับ Visa Intelligent Commerce หรือ Mastercard Agent Pay ผ่านมาตรฐาน Shared Payment Token เดียวกัน
* **Subscription & Recurring Mandate:** ให้ Agent บริหารจัดการค่าสมาชิกรายเดือนหรือการเติมโควตา API ด้วย Link Wallet Protocol
