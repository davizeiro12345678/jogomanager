-- Match the seven services admitted by the authoritative 0056 RPC.
-- Historical migrations remain immutable. Fresh replay and existing databases
-- must both converge on the same constraint and least-privilege ledger grants.
ALTER TABLE public.coin_service_spends
  DROP CONSTRAINT IF EXISTS coin_service_spends_service_check;
ALTER TABLE public.coin_service_spends
  ADD CONSTRAINT coin_service_spends_service_check
  CHECK (service IN (
    'injury_recovery', 'opponent_report', 'youth_boost', 'stadium_upgrade',
    'contract_renewal', 'training_upgrade', 'premium_scout'
  ));

REVOKE ALL ON public.coin_service_spends FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.coin_service_spends TO authenticated;
GRANT ALL ON public.coin_service_spends TO service_role;
