# تشغيل ARVÉN Creative — دليل النشر النهائي

## 1) جهّز السيرفر

تحتاج:

- سيرفر أو منصة تدعم Node.js 22 أو Docker.
- PostgreSQL 17 أو PostgreSQL مُدار.
- نطاق Domain مع HTTPS.
- حساب Binance Pay Merchant إذا أردت التحقق الآلي عبر Binance Pay.
- عنوان استقبال USDT TRC20 + مفتاح TronGrid إذا أردت التحقق الآلي عبر TRON.
- Resend اختياري لإرسال مفاتيح المنتجات بالبريد.

## 2) إعداد البيئة

انسخ:

```bash
cp .env.example .env
```

ثم عدّل:

- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `APP_URL`
- إعدادات Binance Pay إن كنت ستستخدمها.
- `TRON_RECEIVING_ADDRESS` و `TRONGRID_API_KEY` إن كنت ستستخدم TRC20.
- `RESEND_API_KEY` و `DELIVERY_FROM_EMAIL` للبريد.
- `DELIVERY_ENCRYPTION_KEY` لتشفير مخزون المفاتيح.

لا تضع أي Secret داخل `index.html`.

## 3) أول تشغيل بدون Docker

```bash
npm install
npx prisma generate
npm run db:deploy
npm run db:seed
npm run build
npm run start:prod
```

## 4) تشغيل Docker

```bash
docker compose build
docker compose up -d db
docker compose run --rm app npx prisma db push
docker compose run --rm app npm run db:seed
docker compose up -d app
```

## 5) الاختبار

افتح:

- `/` المتجر
- `/admin` لوحة الإدارة
- `/health` فحص السيرفر

يجب أن يعيد `/health` قيمة `ok: true`.

## 6) المخزون

من لوحة الإدارة أضف كل مفتاح/حساب/كود رقمي في سطر مستقل. لا تضع المخزون في JavaScript العام.

## 7) الدفع

ابدأ بـ:

```env
PAYMENT_AUTO_VERIFY=false
```

اختبر الدفع يدويًا أولًا. بعد التأكد من أن التحقق والمطابقة والتسليم يعملون، فعّل:

```env
PAYMENT_AUTO_VERIFY=true
```

## 8) Binance Pay Webhook

اضبط في لوحة Binance Pay عنوان Webhook:

```text
https://YOUR-DOMAIN/api/payments/binance/webhook
```

يجب أن يكون الموقع HTTPS.

## 9) الأمان

قبل فتح المتجر للجمهور:

- غيّر كلمة مرور الإدارة.
- غيّر `JWT_SECRET`.
- لا ترفع `.env` إلى GitHub.
- استخدم PostgreSQL مع نسخ احتياطية.
- لا تفتح منفذ PostgreSQL للعامة.
- فعّل HTTPS.
- راقب سجل الطلبات والمدفوعات.
- اختبر طلبًا حقيقيًا منخفض القيمة قبل إطلاق المنتجات بكميات كبيرة.

## 10) ملاحظة مهمة عن TRC20

النظام يستخدم TronGrid مع `only_confirmed=true` للتحقق من التحويلات المؤكدة. لا يدّعي النظام حاليًا أنه يحسب عددًا رقميًا دقيقًا من التأكيدات؛ لذلك لا تعتمد على `TRC20_MIN_CONFIRMATIONS` كعداد فعلي.
