-- Down for 20261021150000_phe129_points_and_discoveries.sql
drop function if exists public.credit_purchase(text, uuid, text, integer);
drop table if exists public.purchases;
drop table if exists public.purchased_balances;
drop table if exists public.discovery_usage;
drop table if exists public.polaris_points;
