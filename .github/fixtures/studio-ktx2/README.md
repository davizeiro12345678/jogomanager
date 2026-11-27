# Athlete Studio visual QA textures

These 47 KTX2 files are the 4,773,629 bytes used by the game's texture manifests in `src/assets/textures`. Their UUID paths belong to the same JogoManager asset project. The original manifests entered the repository in `911b600a`, `decafb4a`, `30337c5f` and `cb6654d7`. The production loader describes how the material maps were generated and served in `src/game/textures/ktx2.ts`.

Each entry in `SHA256SUMS` matched two independent reads of the project's public asset paths on 26 November 2026. The nine-axis QA workflow loads these versioned bytes on loopback. Refresh the corresponding file and checksum when an asset UUID changes. To verify availability on an authorized network, run `python3 scripts/prepare-studio-qa-textures.py`. It reads the public CDN, compares the same checksums, and reports any HTTP failure.
