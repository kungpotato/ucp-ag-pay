# Lesson 05 — Webhook & Order Confirmation

![webhook confirms order](media/lesson-05/demo.gif)

## Goal
เข้าใจว่าทำไม order ที่ "จ่ายเงินจริง" ต้องได้รับการยืนยันผ่าน webhook เท่านั้น ไม่ใช่จาก response ตอน redirect กลับมา — และรู้วิธี verify webhook signature ด้วยมือแบบไม่พึ่ง SDK

## สิ่งที่ทำ
`backend/webhook.go` implement การ verify ลายเซ็นของ Stripe ตาม[สเปกที่ Stripe เอกสารไว้](https://docs.stripe.com/webhooks#verify-manually) เองทั้งหมด:

```
header: Stripe-Signature: t=<timestamp>,v1=<hex hmac>
signed_payload = "<timestamp>.<raw request body>"
expected = HMAC-SHA256(signed_payload, STRIPE_WEBHOOK_SECRET)
```

ถ้า signature ตรงและ timestamp ไม่เก่าเกิน 5 นาที (กัน replay attack) → `backend/main.go` → `handleStripeWebhook` จะ mark order เป็น `paid` ผ่าน `OrderStore.MarkBySessionID`

## ทำไมต้อง verify signature เอง (ไม่เชื่อ body เฉย ๆ)
Endpoint `/webhooks/stripe` เป็น public endpoint — ใครก็ยิง POST เข้ามาได้ ถ้าไม่ verify ลายเซ็น ใครก็ปลอม event `checkout.session.completed` มาสั่งให้ order กลายเป็น "จ่ายแล้ว" ได้ทันทีโดยไม่ต้องจ่ายเงินจริง นี่คือช่องโหว่คลาสสิกของระบบ payment ที่เขียน webhook handler มือใหม่

## ทำไม status ต้องขยับ "จาก webhook เท่านั้น" ไม่ใช่จาก checkout call
ดู `backend/orders.go`: `Create()` ตั้งค่าเริ่มต้นเป็น `pending_payment` เสมอ และมีแค่ `MarkBySessionID` เท่านั้นที่เปลี่ยนสถานะได้ — เจตนาคือปิดทางไม่ให้ endpoint อื่นใน backend เผลอ mark ว่า "จ่ายแล้ว" ได้โดยไม่ผ่านการ verify กับ Stripe จริง

## เทียบกับแบบอื่น
| แบบ | ข้อดี | ข้อเสีย |
|---|---|---|
| เชื่อ query param ตอน redirect กลับ (`?paid=true`) | ง่ายมาก | **ปลอมได้ 100%** แค่พิมพ์ URL เอง — ห้ามใช้เด็ดขาดกับเงินจริง |
| Poll Stripe API เองเป็นระยะ | ไม่ต้องเปิด public endpoint | ช้า, สิ้นเปลือง API call, ยังพลาด event บางประเภทที่ไม่มีใน object หลัก |
| **Webhook + signature verify (ที่เลือกใช้)** | เรียลไทม์, Stripe การันตี delivery พร้อม retry ให้ | ต้องรันเครื่องมือ forward เวลา dev local (`stripe listen`) |

## ต่อยอดได้อะไร
- handle event เพิ่ม: `checkout.session.async_payment_failed`, `payment_intent.payment_failed`, การ refund
- เก็บ webhook event ที่ประมวลผลแล้วไว้กันซ้ำ (idempotency key) เผื่อ Stripe retry ส่งซ้ำ
