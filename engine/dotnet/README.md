# Native C# reference kernels and contracts

This is the first isolated engine-contract milestone, based on main revision
`e4d10b398e88e5af725bd33aec6e471c85f58a9a`. It adds an executable C# reference
for three existing TypeScript kernels and a strict, versioned JSON protocol.
It does not change the application's current simulation or dependency lock.

| Operation                  | Existing TypeScript reference                            | C# implementation                                |
| -------------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| `rng.sequence.v1`          | `src/game/rng.ts`                                        | `Determinism/SeededRng.cs`                       |
| `perception.pass-lanes.v1` | `src/game/wasm/match-perception.ts`                      | `Perception/PassLanePerception.cs`               |
| `ai.manager.v1`            | `src/game/sim-rules.ts`: `aiSubPick`, `aiMentalityTweak` | `AI/ManagerDecisions.cs`, `AI/ManagerSession.cs` |

These are compatibility implementations, not a new player AI revision. The RNG
preserves UTF-16 FNV-1a, 32-bit overflow, arithmetic right shift and the distinct
semantics of a zero constructor seed and restored zero state. The manager keeps
stable roster ordering for ties and consumes the caller-owned RNG in the same
order as TypeScript. Pass perception writes bounded distance/cover/risk records.

## Scope and authority

The protocol version is `1`, engine identity is `dotnet-kernels-v1`, source
match execution revision is `2`, and the RNG identity is
`ts-xorshift32-arithmetic-v1`. Unknown versions, unknown JSON properties, missing
required constructor fields and oversized inputs are rejected. JSON writes
signed zero as `0`, matching JavaScript's wire representation without rounding
nonzero values.

Numeric fields require JSON number tokens (`NumberHandling.Strict`), and
duplicate properties are forbidden (`AllowDuplicateProperties=false`). Names
are case-sensitive lowerCamelCase after JSON unescaping: aliases such as
`ProtocolVersion`, `Count` or `SchemaVersion` are rejected, whether alone or
beside the canonical name. Duplicate checks also apply to nested `Input` and
checkpoint objects while the envelope holds them as `JsonElement`; direct
.NET 10 tests cover this behavior. The string-or-number seed remains an
explicit union, rather than a numeric field coerced from text.
The relevant .NET API is documented in
[JsonSerializerOptions.AllowDuplicateProperties](https://learn.microsoft.com/en-us/dotnet/api/system.text.json.jsonserializeroptions.allowduplicateproperties?view=net-10.0).

`KernelCheckpoint` contains only this kernel session's RNG state and decision
sequence. Restoration validates all metadata before changing the live session.
It is not a MatchSim checkpoint, career save, migration envelope or attestation.
The literal `FullMatchParityVerified = false` is returned by every valid reply.
Full-match, season and experimental player-AI commands are unavailable.

There is no HTTP host, database, Go executor, browser runtime, save migration,
official economy or deployment in this milestone. No application's engine
selection is changed. Later stages must introduce their implementations,
contracts and evidence explicitly; this proof cannot authorize their rollout.

## Run the real differential

Install Node from the repository's `.nvmrc` and the exact .NET SDK `10.0.403`.
`global.json` disables SDK roll-forward. The two projects have no external
NuGet package references. From the checkout root:

```sh
npm ci
node scripts/dotnet-parity.mjs
```

On Linux, the harness uses `dotnet` on PATH. On Windows, set `JM_DOTNET_PATH` to
an installed SDK's executable if it is not in the local workspace tool cache.
`JM_DOTNET_TOOLS_DIR` can select that cache explicitly. The harness runs SDK
selection and compilation inside `engine/dotnet`, so its pin applies even
when Node was started from the repository root.

The command builds both projects with warnings as errors, executes the native
self checks, compiles/imports the actual current TypeScript implementations
with the existing esbuild dependency, and sends JSON requests to the real C#
process. It executes all **381 cases**: **21 RNG**, **72 pass-perception** and
**288 manager** cases, including **70,144 RNG values** and restored manager
continuations. There is no reduced-corpus flag and no numerical tolerance.

Native self checks additionally cover stable ties, unchanged RNG consumption
in the injury branch, partial output buffers, atomic checkpoint rejection,
strict input/version handling and refusal of unimplemented authority. They use
the production Core entry point; they do not reimplement a simulator in tests.
The current set contains 66 self checks, including 33 malformed JSON cases.
The harness also sends each of those 33 invalid messages to the real long-lived
native process, requires an error reply, then requires the next valid message
to match the TypeScript reference exactly in that same process.

After the 381 differential cases and 66 rejection/recovery messages, the
harness closes stdin and keeps reading stdout until the child emits `close`.
Success requires exit code zero, no signal and exactly 447 replies. A late
nonzero exit, extra output (including between requests), missing reply or
failure to close rejects the proof. Killing the child is failure cleanup only.
`node --test scripts/dotnet-native-process.test.mjs` exercises seven real
subprocess scenarios, including delayed success, late failure, extra replies,
request/close timeout and malformed output.

Generated evidence is written under `engine/dotnet/artifacts/contracts`, or to
the optional output directory supplied as the command's only argument:

- `native-parity.json`: case counts, SDK/Node/V8 versions, source and binary
  hashes, dependency-lock hash, source HEAD and explicit scope.
- `fixtures.json` and `native-results.json`: actual reference inputs/outputs
  and the C# replies, generated anew in this checkout.
- `self-checks.json`, build/output logs and `native-case-timings.json`.
- `rejection-recovery.json` records every invalid raw message and successful
  recovery; `native-process.json` records the final code, signal and reply count.
- `mismatch.json` if an exact comparison fails.

Every request has a 60-second functional timeout. Times include process/JSON
transport and run on the current development or CI machine; they are not CPU
optimization, browser FPS, startup, CodSpeed or production-capacity acceptance.
Graceful process closure has a separate five-second timeout.
No historical Core assembly or receipt is used as the TypeScript oracle.

## CI and delivery boundary

`.github/workflows/engine-contracts.yml` runs this native proof on Ubuntu with
the pinned SDK and existing npm lock, checks the authored harness, and uploads
the exact evidence. The existing Quality gates and performance requirements
remain independent and unchanged. A successful native differential does not
replace those gates, review, browser/WASM validation or publication checks.

The subsequent port of full rules, player AI, physics, matches, seasons,
offline Worker execution and authoritative services is outside this PR's
claim. Each will require its own source-bound proof and explicit activation.

## Separate integration follow-up

The strict-JSON and native-process review fixes in this PR4 checkout have not
been ported to the larger experimental integration (Core
`9ee747a47dd83cae13355d076864c42f7164b172ba9dc05c780671fce3215df4`).
That follow-up requires a separate port, review and new native/WASM verification
for the affected contracts and consumers. Do not relabel its existing 3,126
browser comparisons or other frozen receipts as proof of these changes.
The integrated simulator and its Core 4bb/61e/9ee evidence remain untouched by
this PR4 task; no new engine admission follows from this contract milestone.
