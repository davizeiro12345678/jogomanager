#!/usr/bin/env python3
"""Render standalone, source-linked scientific figures from archived measurements.

Run only after timing-sensitive measurements finish:
  python scripts/generate-quality-report.py

Requires Matplotlib. This script reads local evidence only; it neither launches
the game nor contacts a service. It never derives a global percentile by
averaging the percentiles of individual telemetry windows.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402


BEFORE = "#0072B2"
AFTER = "#D55E00"
GOOD = "#009E73"
BAD = "#CC6677"
GRAPHIC_PHASE = "intermediária"


def read_json(path: Path):
    with path.open(encoding="utf-8-sig") as handle:
        return json.load(handle)


def final_sample(evidence: dict) -> dict:
    result = evidence["sample"]
    protocol = result["protocol"]
    if not evidence.get("complete") or not result.get("complete"):
        raise ValueError("An incomplete native measurement cannot produce final figures")
    if protocol["coveredMs"] != protocol["measurementMs"]:
        raise ValueError("Native measurement coverage is incomplete")
    if protocol.get("interruptions", 0) or protocol.get("contractChanged"):
        raise ValueError("Native measurement was interrupted or its contract changed")
    return result


def validate_pair(baseline: dict, candidate: dict, comparison: dict):
    """Refuse stale comparison metadata when selecting a different raw pair."""
    before, after = final_sample(baseline), final_sample(candidate)
    if not comparison["comparable"] or comparison["mismatches"]:
        raise ValueError("The archived native pair is not comparable")
    for metric in comparison["metrics"]:
        key = metric["name"]
        if not math.isclose(float(before[key]), float(metric["baseline"]), rel_tol=1e-9, abs_tol=1e-6):
            raise ValueError(f"Comparison baseline differs from raw sample: {key}")
        if not math.isclose(float(after[key]), float(metric["candidate"]), rel_tol=1e-9, abs_tol=1e-6):
            raise ValueError(f"Comparison candidate differs from raw sample: {key}")
    for key in ("width", "height", "dpr", "backend"):
        if before[key] != after[key]:
            raise ValueError(f"Native samples use different {key}")
    for key in ("id", "seed", "quality", "camera"):
        if before["scenario"][key] != after["scenario"][key]:
            raise ValueError(f"Native samples use different scenario {key}")


def telemetry(evidence: dict) -> list[dict]:
    """Keep only completed-measurement coverage increments; exclude warmup."""
    final = final_sample(evidence)
    rows = []
    previous_ms = 0.0
    previous_frames = 0
    for row in evidence["timeline"]:
        covered = float(row["protocol"]["coveredMs"])
        frames = int(row["frames"])
        if covered == previous_ms:
            continue
        if covered < previous_ms or frames < previous_frames:
            raise ValueError("Non-monotonic cumulative telemetry")
        if covered > final["protocol"]["measurementMs"]:
            raise ValueError("Telemetry exceeds measurement coverage")
        delta_ms = covered - previous_ms
        rows.append({
            "start": previous_ms / 1000,
            "end": covered / 1000,
            "seconds": delta_ms / 1000,
            "interval_fps": (frames - previous_frames) * 1000 / delta_ms,
            "cumulative_fps": frames * 1000 / covered,
            "cumulative_low": float(row["onePercentLow"]),
            "frames": frames,
        })
        previous_ms = covered
        previous_frames = frames
    if not rows or previous_ms != final["protocol"]["coveredMs"]:
        raise ValueError("Timeline does not reach the final measured coverage")
    if previous_frames != final["frames"]:
        raise ValueError("Timeline and final sample have different frame counts")
    return rows


def style():
    plt.rcParams.update({
        "font.family": "DejaVu Sans",
        "font.size": 10,
        "axes.titlesize": 12,
        "axes.labelsize": 10,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.grid": True,
        "grid.alpha": 0.22,
        "grid.linewidth": 0.6,
        "legend.frameon": False,
        "savefig.dpi": 180,
        "svg.hashsalt": "quality-update-20261108",
    })


def save(fig, output: Path, stem: str, note: str):
    if stem in ("fps-intervalos", "fps-cumulativo", "latencia-frames", "recursos-stalls"):
        note += f"\nSnapshot gráfico: {GRAPHIC_PHASE}."
    fig.text(0.01, 0.012, note, fontsize=8, color="#444444", va="bottom")
    footer_lines = note.count("\n") + 1
    bottom = max(0.06, (10 * footer_lines + 12) / (fig.get_figheight() * 72))
    fig.tight_layout(rect=(0, bottom, 1, 0.98))
    for extension in ("png", "svg"):
        metadata = {"Title": stem, "Description": note} if extension == "svg" else {"Title": stem, "Description": note}
        fig.savefig(output / f"{stem}.{extension}", metadata=metadata)
    plt.close(fig)


def figure_interval(data: list, output: Path):
    fig, ax = plt.subplots(figsize=(11.5, 4.7))
    for name, color, evidence in data:
        rows = telemetry(evidence)
        x = [(row["start"] + row["end"]) / 2 for row in rows]
        ax.plot(x, [row["interval_fps"] for row in rows], color=color, lw=0.9, alpha=0.85, label=name)
    ax.axhline(60, color="#333333", ls="--", lw=1, label="Meta solicitada: média 60 FPS")
    ax.set(xlabel="Tempo coberto pela medição (s; aquecimento excluído)", ylabel="Frames / duração do intervalo (FPS)", title="Match 3D em alta: taxa por intervalo de telemetria (~1 s)")
    ax.set_xlim(0, 300)
    ax.set_ylim(bottom=0)
    ax.legend(loc="upper right", ncol=3, fontsize=8)
    save(fig, output, "fps-intervalos", "RTX 4060 Laptop · Edge/D3D11 · 1280×720 · DPR 1 · 60 s aquecimento + 300 s medição · 1 par.\nTaxa = Δframes / ΔcoveredMs × 1000; intervalos têm a duração real registrada, sem interpolação ou descarte de stalls.")


def figure_cumulative(data: list, output: Path):
    fig, axes = plt.subplots(2, 1, figsize=(11.5, 7), sharex=True)
    for name, color, evidence in data:
        rows = telemetry(evidence)
        x = [row["end"] for row in rows]
        axes[0].plot(x, [row["cumulative_fps"] for row in rows], color=color, lw=1.3, label=name)
        axes[1].plot(x, [row["cumulative_low"] for row in rows], color=color, lw=1.3, label=name)
        end = final_sample(evidence)
        axes[0].annotate(f'{end["fps"]:.2f}', (300, end["fps"]), xytext=(-5, 5), textcoords="offset points", ha="right", color=color)
        axes[1].annotate(f'{end["onePercentLow"]:.2f}', (300, end["onePercentLow"]), xytext=(-5, 5), textcoords="offset points", ha="right", color=color)
    axes[0].axhline(60, color="#333333", lw=1, ls="--", label="Meta solicitada 60")
    axes[1].axhline(50, color="#333333", lw=1, ls="--", label="Stretch: 1% low 50")
    axes[0].set(ylabel="FPS cumulativo", title="Média e 1% low cumulativos ao longo da medição")
    axes[1].set(xlabel="Tempo coberto pela medição (s)", ylabel="1% low cumulativo (FPS)", xlim=(0, 300))
    for ax in axes:
        ax.set_ylim(bottom=0)
        ax.legend(loc="upper right", ncol=3, fontsize=8)
    save(fig, output, "fps-cumulativo", "1 par físico comparável; curvas não são repetições independentes nem intervalos de confiança.\nFPS cumulativo = frames / coveredMs × 1000. 1% low é o valor cumulativo fornecido pelo instrumento; não foi feita média de lows.")


def paired_bars(ax, labels: list[str], values: list[list[float]], ylabel: str, title: str, decimals=1, names=("Base", "Candidata")):
    x = np.arange(len(labels))
    for offset, numbers, name, color in ((-0.19, values[0], names[0], BEFORE), (0.19, values[1], names[1], AFTER)):
        bars = ax.bar(x + offset, numbers, width=0.36, color=color, label=name)
        ax.bar_label(bars, fmt=f"%.{decimals}f", fontsize=8, padding=3)
    ax.set_xticks(x, labels)
    ax.set(ylabel=ylabel, title=title)
    ax.margins(y=0.22)


def figure_latency(samples: list[dict], output: Path):
    fig, axes = plt.subplots(1, 2, figsize=(11.5, 4.7), gridspec_kw={"width_ratios": [2.1, 1]})
    paired_bars(axes[0], ["p50", "p95", "p99"], [[sample[key] for key in ("p50", "p95", "p99")] for sample in samples], "Tempo de frame (ms)", "Percentis globais dos 300 s")
    paired_bars(axes[1], ["Maior frame"], [[sample["maxMs"]] for sample in samples], "Tempo de frame (ms)", "Pior stall observado")
    axes[0].legend(ncol=2)
    save(fig, output, "latencia-frames", f'Valores globais do instrumento, sem recompor percentis de janelas. Os dois painéis têm escalas verticais distintas.\np95 {samples[0]["p95"]:.1f}→{samples[1]["p95"]:.1f} ms; maior stall {samples[0]["maxMs"]:.1f}→{samples[1]["maxMs"]:.1f} ms. Um único par não isola causalidade.')


def figure_resources(samples: list[dict], output: Path):
    fig, axes = plt.subplots(2, 2, figsize=(11.5, 8))
    paired_bars(axes[0, 0], [">50 ms"], [[s["stalls"]] for s in samples], "Frames (contagem)", "Stalls na janela medida", decimals=0)
    paired_bars(axes[0, 1], ["Heap final"], [[s["heapUsedBytes"] / 1e6] for s in samples], "MB (1 MB = 10⁶ bytes)", "Heap JavaScript no fim da captura")
    paired_bars(axes[1, 0], ["Média", "Pico bruto"], [[s["draws"], s["maxDraws"]] for s in samples], "Draw calls", "Draws observados no renderizador", decimals=0)
    axes[1, 0].axhline(260, ls="--", color="#333333", lw=1, label="Teto alta: 260")
    pools = samples[1].get("rigPools", [])
    if pools:
        used = sum(pool["dormantBytes"] for pool in pools) / 2**20
        bars = axes[1, 1].bar(["Candidata\nfinal"], [used], color=AFTER, width=0.5)
        axes[1, 1].bar_label(bars, fmt="%.2f", padding=3)
        axes[1, 1].axhline(16, color="#333333", ls="--", lw=1, label="Teto do pool: 16 MiB")
        axes[1, 1].set(ylim=(0, 20), ylabel="MiB (1 MiB = 2²⁰ bytes)", title="Rig pool dormente; base sem esta métrica")
    else:
        axes[1, 1].text(0.5, 0.5, "Métrica de pool ausente", transform=axes[1, 1].transAxes, ha="center")
    axes[0, 0].legend(ncol=2)
    axes[1, 0].legend(fontsize=8)
    axes[1, 1].legend(fontsize=8)
    status = "dentro" if samples[1]["maxDraws"] <= 260 else "acima"
    save(fig, output, "recursos-stalls", f'Heap final não é pico nem prova de vazamento. Pool é memória retida estimada, não VRAM física medida.\nPico bruto de draws: {samples[0]["maxDraws"]}→{samples[1]["maxDraws"]}; candidata {status} do teto 260. census.fitsBudget é outro inventário.')


def figure_cpu(comparison: dict, output: Path, stem: str, protocol_name: str):
    cases = comparison["cases"]
    if len(cases) != 16:
        raise ValueError(f"Expected all 16 original cases in {stem}, found {len(cases)}")
    names = [case["name"] + (" †" if "Rust/WASM" in case["name"] else "") for case in cases]
    gains = [case["throughputGainPercent"] for case in cases]
    duration = [-case["elapsedTimeReductionPercent"] for case in cases]
    y = np.arange(len(cases))
    fig, axes = plt.subplots(1, 2, figsize=(14, 9), sharey=True, gridspec_kw={"width_ratios": [1.6, 1]})
    for ax, values, xlabel, favorable in ((axes[0], gains, "Variação de throughput (%) — maior é melhor", lambda value: value >= 0), (axes[1], duration, "Variação da duração (%) — menor é melhor", lambda value: value <= 0)):
        colors = [GOOD if favorable(value) else BAD for value in values]
        bars = ax.barh(y, values, color=colors, height=0.65)
        ax.bar_label(bars, labels=[f"{value:+.1f}%" for value in values], fontsize=8, padding=3)
        ax.axvline(0, color="#333333", lw=0.8)
        ax.set_xlabel(xlabel)
        ax.margins(x=0.22)
    axes[0].axvline(89, color="#333333", ls="--", lw=1, label="Meta +89% throughput")
    axes[0].set_yticks(y, names, fontsize=8)
    axes[0].invert_yaxis()
    axes[0].legend(loc="lower right", fontsize=8)
    axes[1].tick_params(labelleft=False)
    fig.suptitle(f"16 microbenchmarks CPU — {protocol_name}", y=0.985, fontsize=13)
    protocol = comparison["protocol"]
    save(fig, output, stem, f'Node {comparison["environment"]["node"]} · i5-12500H · {comparison["baselineRuns"]} execuções base / {comparison["candidateRuns"]} candidata · janela {protocol["timeMs"]} ms / aquecimento {protocol["warmupMs"]} ms.\nThroughput = (tempo_base / tempo_candidata − 1) × 100. Duração = (tempo_candidata / tempo_base − 1) × 100. Sem inferência de FPS ou significância.\n†Rust/WASM: fonte + binário; produtores têm as mesmas versões rustc 1.99.0 / wasm-bindgen 0.2.129.\nA base commitada não foi recompilada nesta campanha; a invocação/ambiente histórico do build não foi reproduzido.')


def figure_ownership(before: dict, after: dict, output: Path):
    old, new = before["results"], after["results"]
    if len(old) != 5 or [row["id"] for row in old] != [row["id"] for row in new]:
        raise ValueError("Ownership proof must preserve all five cases and their order")
    for original, result in zip(old, new):
        for key in ("geometryAndMorphSha256", "outputBytes", "groupCount"):
            if original[key] != result[key]:
                raise ValueError(f'Ownership proof changed output: {result["id"]}, {key}')
    labels = [row["id"] for row in old]
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    paired_bars(axes[0], labels, [[row["copiedBytes"] / 1e6 for row in rows] for rows in (old, new)], "MB copiados (10⁶ bytes)", "Tráfego de cópia por construção", decimals=2, names=("Antes de ownership", "Após ownership"))
    paired_bars(axes[1], labels, [[row["cloneCount"] for row in rows] for rows in (old, new)], "Clones (contagem)", "Clones por construção", decimals=0, names=("Antes de ownership", "Após ownership"))
    axes[0].legend(fontsize=8)
    save(fig, output, "rig-copias-ownership", "Instrumentação de uma construção/cache miss por caso, incluindo fontes do corpo. Hashes de geometria/morph e bytes de saída idênticos.\nMede tráfego de cópia e contagem de clones; não é redução de heap total, memória residente, VRAM, tempo ou ganho de FPS.")


def write_manifest(inputs: list[Path], output: Path):
    lines = ["# Figuras científicas derivadas", "", "Gerador: `scripts/generate-quality-report.py`. PNG e SVG são exportados diretamente por Matplotlib; nenhuma imagem de jogo foi editada ou combinada.", "", "## Entradas e integridade", "", "| Arquivo de entrada | SHA-256 |", "| --- | --- |"]
    for path in inputs:
        lines.append(f"| `{path.parent.name}/{path.name}` | `{hashlib.sha256(path.read_bytes()).hexdigest()}` |")
    lines += ["", f"Snapshot gráfico: **{GRAPHIC_PHASE}**.", "", "## Figuras", "", "| Arquivo (PNG e SVG) | Interpretação |", "| --- | --- |", "| `fps-intervalos` | Δframes / Δcobertura dos intervalos realmente registrados, aproximadamente um segundo; aquecimento excluído |", "| `fps-cumulativo` | Média cumulativa e 1% low cumulativo fornecido pelo instrumento; nenhum low de janela foi agregado |", "| `latencia-frames` | p50/p95/p99 e máximo finais dos 300 s; eixos separados para percentis e máximo |", "| `recursos-stalls` | Stalls, heap final, draws e pool dormente final; métricas de escopos distintos identificadas |", "| `cpu-deltas-curto` | Todos os 16 casos do protocolo curto 3×3, sem exclusão de regressões |", "| `cpu-deltas-estendido` | Todos os 16 casos do protocolo ABBA estendido 2×2 |", "| `cpu-deltas-afinidade` | Todos os 16 casos do ABBA 2×2 com afinidade na CPU lógica 0; protocolo principal controlado de wall time |", "", "Essas figuras não certificam a campanha de três repetições em duas GPUs, o gate oficial de construtor nem produção. Os JSON de entrada permanecem como fonte dos valores globais.", ""]
    (output / "README.md").write_text("\n".join(lines), encoding="utf-8")
    if any(path.name == "rig-ownership-before.json" for path in inputs):
        with (output / "README.md").open("a", encoding="utf-8") as handle:
            handle.write("\nFigura adicional `rig-copias-ownership.{png,svg}`: cinco casos de construção, contagem de clones e tráfego de cópia antes/depois de ownership, com paridade de saída. Não mede heap/VRAM/FPS.\n")


def main():
    global GRAPHIC_PHASE
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path, default=Path(__file__).resolve().parents[1] / "verification" / "quality-update-20261108")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--baseline", type=Path, help="Override the native baseline JSON")
    parser.add_argument("--candidate", type=Path, help="Override the native candidate JSON")
    parser.add_argument("--comparison", type=Path, help="Override the native comparison JSON")
    parser.add_argument("--phase", default="intermediária; anterior à correção IBL", help="Explicit snapshot label embedded in every native figure")
    parser.add_argument("--include-ownership", action="store_true", help="Include the separate five-case construction copy-traffic proof")
    args = parser.parse_args()
    evidence_dir = args.evidence.resolve()
    GRAPHIC_PHASE = args.phase
    output = args.output.resolve() if args.output else evidence_dir / "figures" / "intermediate"
    output.mkdir(parents=True, exist_ok=True)
    inputs = [args.baseline or evidence_dir / "graphics" / "baseline-nvidia-broadcast-1.json", args.candidate or evidence_dir / "graphics" / "candidate-nvidia-broadcast-1.json", args.comparison or evidence_dir / "graphics" / "comparison.json", evidence_dir / "cpu" / "comparison.json", evidence_dir / "cpu-extended" / "comparison.json", evidence_dir / "cpu-affinity" / "comparison.json"]
    baseline, candidate, graphic_comparison, short_cpu, extended_cpu, affinity_cpu = [read_json(path) for path in inputs]
    provenance_path = evidence_dir / "wasm-artifact-provenance.json"
    if provenance_path.exists():
        provenance = read_json(provenance_path)
        if not all(provenance.get(key) for key in ("producerVersionsEqual", "cargoLockEqual", "cargoManifestEqual")):
            raise ValueError("Task-specific Rust caption requires matching recorded producer/Cargo metadata")
        inputs.append(provenance_path)
    validate_pair(baseline, candidate, graphic_comparison)
    style()
    data = [("Base", BEFORE, baseline), ("Candidata", AFTER, candidate)]
    samples = [final_sample(baseline), final_sample(candidate)]
    figure_interval(data, output)
    figure_cumulative(data, output)
    figure_latency(samples, output)
    figure_resources(samples, output)
    figure_cpu(short_cpu, output, "cpu-deltas-curto", "curto 3×3")
    figure_cpu(extended_cpu, output, "cpu-deltas-estendido", "ABBA estendido 2×2")
    figure_cpu(affinity_cpu, output, "cpu-deltas-afinidade", "ABBA 2×2 com afinidade CPU lógica 0")
    if args.include_ownership:
        ownership_inputs = [evidence_dir / "graphics" / "rig-ownership-before.json", evidence_dir / "graphics" / "rig-ownership-after.json"]
        figure_ownership(*[read_json(path) for path in ownership_inputs], output)
        inputs.extend(ownership_inputs)
    write_manifest(inputs, output)
    print(f"Exported {7 + int(args.include_ownership)} figures as PNG + SVG to {output}")


if __name__ == "__main__":
    main()
