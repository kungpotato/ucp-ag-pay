# Lesson 08 — End-to-End Recap & ต่อยอดยังไงต่อ

![full journey](media/lesson-08/demo.gif)

## Goal
เดินผ่าน flow เต็มอีกครั้งแบบไม่มีขั้นไหนถูกข้าม และสรุปว่าแต่ละชิ้นต่อกันยังไง เตรียมพร้อมสำหรับตอนที่จะเอาไปต่อยอดเป็นระบบจริง

## Flow เต็ม (อ้างอิง lesson ที่เกี่ยวข้อง)
1. **[01]** Go backend + Next.js frontend รันแยกกัน คุยกันผ่าน HTTP ล้วน
2. **[02]** ผู้ใช้ (หรือ agent) เรียก `GET /ucp/catalog` เพื่อค้นสินค้า
3. **[03]** สร้าง cart → เพิ่มสินค้า → `POST /ucp/cart/:id/checkout` ได้ Stripe Checkout URL กลับมา
4. **[04]** ผู้ใช้จ่ายเงินจริงบนหน้า Stripe (sandbox) — backend ไม่เห็นเลขบัตรเลย
5. **[05]** Stripe ยิง webhook กลับมาพร้อมลายเซ็น → backend verify แล้ว mark order เป็น `paid`
6. **[06]** เส้นทางเดียวกันทั้งหมดนี้ทำซ้ำได้โดย AI agent ผ่าน tool-calling แทนการคลิก
7. **[07]** สอง client (มนุษย์ / agent) อยู่บน data contract เดียวกันโดยไม่มี logic ซ้ำซ้อน

## สิ่งที่ยืนยันด้วยการรันจริง (ไม่ใช่ทฤษฎี)
ทุก gif/image ใน `docs/media/` ถูก capture จากแอปที่รันจริง (`docs/scripts/capture.mjs`) ผ่าน headless Chrome, จ่ายเงินด้วยบัตรทดสอบมาตรฐานของ Stripe, และยืนยัน order ด้วย webhook ที่เซ็นลายเซ็นถูกต้องจริง — ไม่ใช่ screenshot ที่ตัดต่อ ถ้าโค้ดพัง gif จะสร้างไม่ได้เลย นี่คือเหตุผลที่สคริปต์ capture ถูก commit ไว้ในโปรเจกต์ด้วย ไม่ใช่แค่รูปผลลัพธ์

## ทำไมถึงออกแบบให้ "รันซ้ำได้" แบบนี้
ทางเลือกที่เร็วกว่าคือถ่าย screenshot มือแล้ว paste ใส่ doc แต่จะเจอปัญหาเมื่อโค้ดเปลี่ยนแล้ว docs ล้าสมัยโดยไม่มีใครรู้ตัว การมี `capture.mjs` ที่รันจริงทุกครั้งทำให้ docs กับโค้ด sync กันเสมอ — รันคำสั่งเดียว (`node docs/scripts/capture.mjs`) แล้วรูปทั้งหมดอัปเดตตามพฤติกรรมจริงของแอป

## ต่อยอดได้อะไร (ถัดจาก workshop นี้)
- **Multi-agent**: ให้ agent อีกตัวจัดการ inventory/pricing แล้วให้ shopping agent คุยกับมันผ่าน UCP เหมือนที่คุยกับ backend ตอนนี้
- **Refund flow**: เพิ่ม `POST /orders/:id/refund` ที่เรียก Stripe Refunds API แล้วส่ง webhook `charge.refunded` กลับมา
- **Auth จริง**: ผูก cart กับ user session แทนการสร้าง cart ใหม่ทุกครั้ง
- **Production settlement**: สลับจากยิง Stripe REST ตรง ๆ (lesson 03) กลับไปใช้ `stripe-go` SDK เพื่อได้ retry/idempotency key ที่ครบมือขึ้น
- **Deploy จริง**: ตั้ง webhook endpoint ใน Stripe Dashboard ให้ชี้มาที่ backend ที่ deploy แล้ว (ไม่ต้องพึ่ง `stripe listen` อีกต่อไป)
