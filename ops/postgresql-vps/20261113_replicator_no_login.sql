-- Provision a DISABLED replicator identity, with no password or login yet.
-- The role has no permissions on private schemas or data, and cannot connect until the
-- upstream CA certificate has been verified and a separate secure secret is provisioned.
CREATE ROLE jm_vps_catalog_replicator
  WITH NOLOGIN REPLICATION NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO jm_vps_catalog_replicator;
GRANT SELECT ON
  public.competitions,
  public.clubs,
  public.stadiums,
  public.kits,
  public.competition_seasons,
  public.official_teams,
  public.official_venues,
  public.official_players
TO jm_vps_catalog_replicator;