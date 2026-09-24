-- Adds 'pending' to booking_status, on its own: a newly added enum value
-- can't safely be used in the same transaction that creates it.
alter type public.booking_status add value 'pending';
