# Changelog

## 0.1.0 — package preparation
- Split the browser app into small JavaScript modules.
- Added one-time activation-code schema and Edge Function draft.
- Added Arabic setup, architecture, and manual test docs.
- Did not create accounts, deploy functions, or modify the live site/database.

## ترقية الإنتاج: KYC شرطي + حماية من الاحتيال + عمولات + إحالة + تصميم
- DB: `supabase_upgrade.sql` (idempotent). جداول: provider_terms, commission_ledger, referral_codes, referrals، وجداول خاصة private.* (user_flags, device_flags, devices, ride_meta). أعمدة rides: commission_rate, commission_amount, promo_discount, net_to_driver.
- RPC جديدة: register_device, guard_status, get_start_pin, verify_start_pin, my_referral, use_referral, provider_balance, admin_set_provider_terms, admin_commissions, admin_fraud_flags, admin_clear_restriction. معدّلة: request_ride, request_delivery, send_quote, choose_quote, cancel_ride, update_ride_status, cargo_book_internal.
- واجهة: device.js, referral.js, uber.css (جديدة)؛ تعديل customer/provider/cargo/dashboard/rides/help/utils/icons/app5/index.html/sw.js(v11).
- أُرشفت النسخ القديمة إلى _legacy_archive/ (لم يُحذف شيء) وأُصلح استيراد dashboard.js من signin.js.
