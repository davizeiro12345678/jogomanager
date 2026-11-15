-- Execute through an authorized, TLS-verified direct connection to the Supabase SOURCE.
-- Read-only: does not create or retain any WAL replication slot.
SELECT now() AS collected_at,
       pg_current_wal_lsn() AS upstream_current_lsn,
       slot_name, plugin, slot_type, active, wal_status,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)::bigint) AS retained_wal,
       pg_size_pretty(safe_wal_size) AS remaining_safe_wal
FROM pg_replication_slots
WHERE slot_name LIKE 'jm_vps_%'
ORDER BY slot_name;

-- On the local destination, after an explicitly authorized subscription is established:
-- SELECT s.subname, s.subenabled, r.pid, r.received_lsn, r.latest_end_lsn,
--        r.latest_end_time
-- FROM pg_subscription s
-- LEFT JOIN pg_stat_subscription r ON r.subid = s.oid
-- WHERE s.subname LIKE 'jm_vps_%';
