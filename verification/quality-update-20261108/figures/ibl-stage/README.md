# Figuras científicas derivadas

Gerador: `scripts/generate-quality-report.py`. PNG e SVG são exportados diretamente por Matplotlib; nenhuma imagem de jogo foi editada ou combinada.

## Entradas e integridade

| Arquivo de entrada | SHA-256 |
| --- | --- |
| `graphics/baseline-nvidia-broadcast-1.json` | `a0974731199e3b3ac58bb07c23d77f147951b282a4032f6e00c4961254b38330` |
| `graphics/final-nvidia-broadcast-1.json` | `1a0a6bc67301bb4f42d0dba813a1e7ed5ff61a1eb075ef02b5c3573d0ee60d6e` |
| `graphics/comparison-final.json` | `debd78e66f05f37983528906aa20957906b48e8ac4ee083145cb2f7e3bafe9b4` |
| `cpu/comparison.json` | `e4acb6b45abbb96ee0ed598f54bbc0532dc27a8427943e4df935bea598e8fe6b` |
| `cpu-extended/comparison.json` | `a2652d7f14a96de5e2ebd2863c4161c126fa6a40651fabd1868d0128eba82d0d` |
| `cpu-affinity/comparison.json` | `443691a4ad67dfd6771c928dc8bc9dfbeade1218cdd1b4e91197952a26d48e1f` |

Snapshot gráfico: **final após correção IBL; um par físico**.

## Figuras

| Arquivo (PNG e SVG) | Interpretação |
| --- | --- |
| `fps-intervalos` | Δframes / Δcobertura dos intervalos realmente registrados, aproximadamente um segundo; aquecimento excluído |
| `fps-cumulativo` | Média cumulativa e 1% low cumulativo fornecido pelo instrumento; nenhum low de janela foi agregado |
| `latencia-frames` | p50/p95/p99 e máximo finais dos 300 s; eixos separados para percentis e máximo |
| `recursos-stalls` | Stalls, heap final, draws e pool dormente final; métricas de escopos distintos identificadas |
| `cpu-deltas-curto` | Todos os 16 casos do protocolo curto 3×3, sem exclusão de regressões |
| `cpu-deltas-estendido` | Todos os 16 casos do protocolo ABBA estendido 2×2 |
| `cpu-deltas-afinidade` | Todos os 16 casos do ABBA 2×2 com afinidade na CPU lógica 0; protocolo principal controlado de wall time |

Essas figuras não certificam a campanha de três repetições em duas GPUs, o gate oficial de construtor nem produção. Os JSON de entrada permanecem como fonte dos valores globais.
