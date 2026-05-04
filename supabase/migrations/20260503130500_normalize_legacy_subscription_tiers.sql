-- Optional: maps old Stripe tier labels to current app values (`pro`, `gifted`, `free`).
update public.user_profiles
set tier = 'pro'
where tier in ('signal', 'observatory', 'paid');
