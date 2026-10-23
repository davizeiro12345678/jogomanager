-- Disposable local replay database only. Everything created here is rolled back.
BEGIN;
SET LOCAL ROLE postgres;
CREATE TABLE public.explicit_grants_contract_probe (id bigserial PRIMARY KEY);
DO $contract$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    ASSERT NOT has_table_privilege(role_name, 'public.explicit_grants_contract_probe', 'SELECT'), 'Default SELECT must be opt-in';
    ASSERT NOT has_table_privilege(role_name, 'public.explicit_grants_contract_probe', 'INSERT'), 'Default INSERT must be opt-in';
    ASSERT NOT has_table_privilege(role_name, 'public.explicit_grants_contract_probe', 'TRUNCATE'), 'Default maintenance must be denied';
    ASSERT NOT has_sequence_privilege(role_name, 'public.explicit_grants_contract_probe_id_seq', 'USAGE'), 'Default sequence usage must be opt-in';
  END LOOP;
  ASSERT has_table_privilege('service_role', 'public.explicit_grants_contract_probe', 'SELECT'), 'Preserve backend defaults';
  ASSERT has_table_privilege('service_role', 'public.explicit_grants_contract_probe', 'INSERT'), 'Preserve backend writes';
  ASSERT has_table_privilege('anon', 'public.clubs', 'SELECT'), 'Preserve existing public catalogue';
  ASSERT has_function_privilege('authenticated', 'public.mutate_player_career(integer,bigint,text,jsonb)', 'EXECUTE'), 'Preserve career RPC';
END;
$contract$;
GRANT SELECT ON public.explicit_grants_contract_probe TO anon;
DO $contract$
BEGIN
  ASSERT has_table_privilege('anon', 'public.explicit_grants_contract_probe', 'SELECT'), 'Explicit grants must still work';
  ASSERT NOT has_table_privilege('anon', 'public.explicit_grants_contract_probe', 'INSERT'), 'Read access must not imply writes';
END;
$contract$;
ROLLBACK;
