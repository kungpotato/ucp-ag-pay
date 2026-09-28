# Lesson 01 — Setup & Architecture

![architecture](media/lesson-01/result.png)

## Goal
ตั้งโครงโปรเจกต์และเข้าใจภาพรวมสถาปัตยกรรมก่อนลงมือเขียนโค้ดจริง: อะไรอยู่ที่ไหน, ใครคุยกับใคร, และทำไมถึงแยกส่วนแบบนี้

## สิ่งที่ทำ
- `backend/` — Go server (stdlib ล้วน ไม่มี dependency ภายนอก) ทำหน้าที่เป็น **UCP commerce provider**: แคตตาล็อก, ตะกร้า, checkout, settlement กับ Stripe, webhook
- `frontend/` — Next.js (App Router) ทำหน้าที่เป็น **UCP client สองแบบ**: มนุษย์กดปุ่มผ่านหน้าเว็บปกติ กับ AI agent ที่คุยผ่านแชทแล้วเรียก endpoint เดียวกัน
- `docs/` — บทเรียนภาษาไทย + gif/image ผลลัพธ์ของแต่ละ lesson + สคริปต์ capture ที่ใช้สร้างมันขึ้นมาจริง (ไม่ใช่ mockup)

## ทำไมถึงแยก Go backend ออกจาก Next.js
ทางเลือกที่ทำได้ง่ายกว่าคือยัดทุกอย่างไว้ใน Next.js API routes (frontend กับ backend อยู่ที่เดียวกัน deploy ทีเดียวจบ) แต่ที่นี่เลือกแยกเป็นสองบริการเพราะ:

| แบบ | ข้อดี | ข้อเสีย |
|---|---|---|
| **Next.js API routes ล้วน** (ทางลัด) | setup เดียว, deploy เดียว | มองไม่เห็นชัดว่า "commerce provider" กับ "commerce client" เป็นคนละบทบาทกัน — ซึ่งเป็นแก่นของ UCP |
| **แยก Go backend (ที่เลือกใช้)** | เห็นชัดว่า UCP endpoint คือสัญญากลางที่ client อะไรก็ได้ (มนุษย์ผ่านเว็บ, agent ผ่าน LLM, หรือระบบอื่นในอนาคต) เรียกได้เหมือนกันหมด | ต้องรัน 2 process ตอน dev |

กติกา UCP จริง (ที่ [ucp.dev](https://ucp.dev), เปิดตัว ม.ค. 2026 โดย Google + Shopify) วางโพรโทคอลไว้เป็นเลเยอร์กลางระหว่างแพลตฟอร์มกับผู้ขาย — การแยก process จึงสะท้อนของจริงมากกว่า

## ต่อยอดได้อะไร
- สลับ Go backend เป็นภาษาอื่นได้โดยไม่กระทบ frontend เลย ตราบใดที่ endpoint shape เดิม
- เพิ่ม UCP client ตัวที่ 3 (เช่น CLI, Slack bot) ได้ทันทีโดยไม่ต้องแตะ backend
