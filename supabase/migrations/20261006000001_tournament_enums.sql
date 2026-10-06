-- New enum value for the Torneos module. Own migration — Postgres won't
-- allow using a freshly-added enum value in the same transaction.

alter type public.booking_type add value 'tournament';
