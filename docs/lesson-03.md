# Lesson 03 — Manual Checkout: Cart → Stripe Checkout Session

![buy flow demo](media/lesson-03/demo.gif)

## Goal
เข้าใจ flow การสร้าง Stripe Checkout Session จากตะกร้า UCP และทำไมปุ่ม "ซื้อเลย" ของมนุษย์ธรรมดาต้องเรียก endpoint เดียวกับที่ agent จะใช้ในบทถัดไป

## สิ่งที่ทำ
`frontend/app/book/[id]/buy-button.tsx` ทำ 3 ขั้นตอนตรง ๆ:

```ts
const cart = await createCart();               // POST /ucp/cart
await addItem(cart.id, productId, 1);           // POST /ucp/cart/:id/items
const { checkout_url } = await checkout(        // POST /ucp/cart/:id/checkout
  cart.id, successUrl, cancelUrl
);
window.location.href = checkout_url;
```

ฝั่ง Go (`backend/stripe.go`) สร้าง Checkout Session ด้วยการยิง Stripe REST API ตรง ๆ ผ่าน `net/http` (ไม่ใช้ SDK) โดยส่ง line item แบบ `price_data` ทำให้ไม่ต้องสร้าง Stripe Price object ล่วงหน้า — แคตตาล็อกอยู่ใน process ของเราเอง ราคาก็กำหนดสด ๆ ตอน checkout ได้เลย

## ทำไมไม่ใช้ stripe-go SDK
| แบบ | ข้อดี | ข้อเสีย |
|---|---|---|
| **stripe-go SDK** | type-safe, มี retry/version pinning ให้ | เพิ่ม dependency, ซ่อนรายละเอียด request/response ไว้หลัง builder pattern |
| **net/http ตรง ๆ (ที่เลือกใช้)** | เห็นทุก field ที่ยิงไปจริง ๆ, backend ยังคง zero-dependency ตามที่ตั้งใจไว้ตั้งแต่ lesson 01 | ต้อง handle error/response เองมือ ๆ |

สำหรับงาน production จริงควรสลับกลับไปใช้ SDK — แต่สำหรับ workshop ที่อยากให้เห็น "จริง ๆ แล้ว Stripe คุยกับเรายังไง" การยิง HTTP ตรงมีค่าทางการศึกษามากกว่า

## จุดสำคัญ: `{ORDER_ID}` placeholder
`success_url` ที่ส่งไปมี placeholder `{ORDER_ID}` เพราะฝั่ง frontend ยังไม่รู้ order id ตอนเรียก (backend เพิ่งสร้าง order ระหว่างประมวลผล request) — backend จึงแทนที่ placeholder นี้ด้วย order id จริงก่อนส่งให้ Stripe (`backend/main.go` → `handleCheckout`) ซึ่งเลียนแบบวิธีที่ Stripe เองใช้ `{CHECKOUT_SESSION_ID}` ใน success_url ของตัวเอง

## ต่อยอดได้อะไร
- เพิ่มหลายรายการในตะกร้าได้แล้วในโค้ดปัจจุบัน (`AddItem` รองรับ) — ลองต่อ UI ตะกร้าแบบเต็มดู
- สลับไปใช้ Stripe Elements แบบ embed แทน Checkout Session ที่ redirect ออกไป ถ้าอยากคุม UI เองทั้งหมด
