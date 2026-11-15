-- Only eight publicly readable reference tables, no private player, account, payment, or match records.
-- No replication slot is created by a publication.
CREATE PUBLICATION jm_vps_public_catalog
FOR TABLE
  public.competitions,
  public.clubs,
  public.stadiums,
  public.kits,
  public.competition_seasons,
  public.official_teams,
  public.official_venues,
  public.official_players
WITH (publish='insert,update,delete');