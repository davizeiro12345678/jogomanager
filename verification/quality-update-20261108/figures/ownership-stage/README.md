# Figuras científicas derivadas

Gerador: `scripts/generate-quality-report.py`. PNG e SVG são exportados diretamente por Matplotlib; nenhuma imagem de jogo foi editada ou combinada.

## Entradas e integridade

| Arquivo de entrada | SHA-256 |
| --- | --- |
| `graphics/baseline-nvidia-broadcast-1.json` | `a0974731199e3b3ac58bb07c23d77f147951b282a4032f6e00c4961254b38330` |
| `graphics/final-ownership-nvidia-broadcast-1.json` | `38553789122dddf94a84594b99bcebd4d9728de25b3813fcb14bef0f30e4f830` |
| `graphics/comparison-final-ownership.json` | `efcf601ef775f6f66c07c09f97c9ba5da68971d204fde08768badb02def57dd4` |
| `cpu/comparison.json` | `e4acb6b45abbb96ee0ed598f54bbc0532dc27a8427943e4df935bea598e8fe6b` |
| `cpu-extended/comparison.json` | `a2652d7f14a96de5e2ebd2863c4161c126fa6a40651fabd1868d0128eba82d0d` |
| `cpu-affinity/comparison.json` | `443691a4ad67dfd6771c928dc8bc9dfbeade1218cdd1b4e91197952a26d48e1f` |
| `quality-update-20261108/wasm-artifact-provenance.json` | `8ba4175f081784a0b0f4c78c3b28f496699228ae3c790e45a667dff972206139` |
| `graphics/rig-ownership-before.json` | `0b9e22eee664c4fa6ba4db0c4ece85f3484235e84bfeafd66cf37316558f734c` |
| `graphics/rig-ownership-after.json` | `6f070387eb6bd620459b94030993a6c4c75b560faf57ce1e9fdab85f9a6ab9c4` |

Snapshot gráfico: **ownership; fonte 0a6a04e; um par físico**.

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

Figura adicional `rig-copias-ownership.{png,svg}`: cinco casos de construção, contagem de clones e tráfego de cópia antes/depois de ownership, com paridade de saída. Não mede heap/VRAM/FPS.
