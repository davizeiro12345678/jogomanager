# Save compatibility, identity and recovery policy

Manager saves currently use version 3. Transfer envelopes use version 1 and identify their kind explicitly. Player-career files and editor customization packages have separate schemas. Personal career JSON is untrusted progress and cannot establish purchases, account ownership, official achievements or competitive scores.

## Before a save changes

- Read only the currently resolved account scope. Guest data is never adopted by a subsequent login. The server binds every operation to the authenticated user, and rejects a mismatched expected owner.
- Reject unsupported or future manager-save versions instead of downgrading them. Display a recovery error while retaining the stored bytes.
- A failed career read does not automatically retry when a nested shell mounts another reader. Network failures already fall back to local data; rejected local versions and failed recovery writes must reach a stable recovery screen. Explicit refetch and confirmed restoration remain available.
- For a supported migration, calculate the candidate without overwriting the original. Before persisting a changed candidate, save and read back a recovery copy independent of the ten rotating autosaves. Stop the migration when neither storage backend confirms that copy.
- Before an explicit restoration replaces a different local career, retain the previous career in the same recovery storage. Then await verified persistence before publishing the replacement in the UI.
- Recovery copies are scoped to the owner, deduplicated and bounded to five entries. Privacy export includes them; deletion verifies that browser mirrors were actually removed.

## What migrations preserve

Club and player IDs, existing player development, finances, completed results, played-season calendars and history remain authoritative personal-save data. Catalog updates fill missing squad depth through the existing deterministic migration. An ongoing season retains its participants; composition changes wait for the next season. Cross-provider aliases use source identifiers or reviewed evidence, never names alone. Historical IDs remain available for references and compatibility.

Provider people have primary keys and an explicit `source_kind` classification (`player` or `staff`). Reviewed duplicate registrations keep their original record plus a canonical reference. Staff and canonical aliases are excluded from playable reads. A database record ID does not prove that all providers have resolved the same natural person globally.

## Verified persistence and synchronization

IndexedDB writes career and timestamp atomically. The localStorage fallback is read back, with its own timestamp. Loading and privacy export select the newer available copy. Neither a failed disk write nor a failed restore reports success. A cloud acknowledgement clears only the state it submitted; a newer queued career remains pending. Cloud success is distinct from a verified local save.

An ordinary gameplay change is initially held in an owner-scoped shared query cache. If neither local backend verifies the write, the UI shows an unsaved warning, keeps that current career available for export, and gives the warning priority even offline. Automatic readers and late fetches cannot replace it with an older durable copy; background cloud synchronization waits. Monotonic write-attempt guards prevent an older callback from changing the latest feedback. A retry clears the warning only after verified persistence. A failed explicit restore retains the previous in-memory career and its existing warning; a successful restore publishes its replacement only after verification.

All manager upload paths share one serialized lane per owner within a browser context. Before an upload, that lane re-reads the durable local career and outbox, replaces stale transport data with current local progress, and verifies that the queue was retained. Account checks run before and after the request. A failed replacement-queue write stops synchronization before any older queued state can be uploaded. Migration preparation verifies the original recovery copy before writing its replacement.

Compatibility also reads the previous exact-owner compartments: `manager3d.career.v2.account-${encodeURIComponent(owner)}` and `career.v2.account-${encodeURIComponent(owner)}.{career,savedAt,snapshots,outbox}`. Guest compartments remain exclusive to guests. Until a current-layout save exists, these reads can recover the old owner's latest unsynced outbox state without altering the stored original or its timestamp. Normal saves write the current layout. Privacy export retains the prior data in `previousLayout`, even after a current-layout save takes precedence. A canonical null outbox acknowledgement prevents a historical queue from returning to active synchronization after a newer save succeeds.

## Export and restore acceptance

`Perfil → Exportar carreira` validates the actual serialized bytes, format, size, checksum and critical contents, then presents club, manager, season, round, calendar year, timestamp and save version before download. Download requested is not a claim that the browser finished writing the file. `Editor → Exportar personalizações do editor` contains editor customizations only and cannot substitute for career export.

Select a career file in `Perfil → Importar carreira`, review it, then confirm restoration. Selecting or cancelling a file must not migrate it or mutate live attributes. Verify the downloaded file in a separate browser profile, reload that profile, and compare squad, lineup, bench, finances, calendar, results, season history and manager history. The reproducible local test and its eight fingerprints are recorded under `output/playwright/product-integrity-20261020/`.

The envelope checksum detects accidental corruption. It is not a signature or server attestation. Editing JSON and recomputing it cannot grant purchases or trusted competitive progress.

## Unfinished matches after rule corrections

Completed results and history are preserved. New optional checkpoint context records the players in offside positions when a pass was released, restart exemptions, pending penalty attribution and emergency goalkeeper selection. The importer validates those fields before state mutation; legacy files without the new context use bounded compatibility behavior because past kick positions cannot be reconstructed. The corrected rules can change future actions in an unfinished match. Checkpoint/resume parity is verified for checkpoints created by the same current rules and source version, not asserted across a rule change.
