# Bundle impact: baseline vs candidate

> **Correção posterior:** a linha de Match 3D nesta medição selecionou um módulo
> da API de IA em vez da rota da partida. A redução de 72% indicada abaixo não
> é válida. Para a comparação corrigida com as mesmas medições, consulte
> [bundle-impact-corrigido.md](../ai-providers-2026-10-28/bundle-impact-corrigido.md).

Comparação de builds com a mesma máquina e configurações. **Números de código transferido estimado**, não LCP, INP, FPS ou tempo real de carregamento. Total inclui chunks lazy e não representa o download inicial.

| Métrica | Antes | Depois | Redução |
|---|---:|---:|---:|
| JS emitido total (inclui lazy) | 6740.7 KiB | 6743.3 KiB | -0.04% |
| JS emitido total (gzip) | 2181.8 KiB | 2185.1 KiB | -0.15% |
| JS emitido total (Brotli Q6) | 2056.1 KiB | 2059.0 KiB | -0.14% |
| Página inicial startup (gzip) | 162.7 KiB | 162.3 KiB | 0.24% |
| Página inicial startup (Brotli Q6) | 154.2 KiB | 153.7 KiB | 0.27% |
| Nova carreira startup (gzip) | 427.5 KiB | 427.5 KiB | -0.01% |
| Nova carreira startup (Brotli Q6) | 403.9 KiB | 403.9 KiB | 0.00% |
| Partida rápida startup (gzip) | 292.4 KiB | 292.5 KiB | -0.02% |
| Partida rápida startup (Brotli Q6) | 277.1 KiB | 277.1 KiB | -0.00% |
| Match 3D startup (gzip) | 549.6 KiB | 152.9 KiB | 72.17% |
| Match 3D startup (Brotli Q6) | 519.7 KiB | 144.8 KiB | 72.13% |
| Palco cinematográfico startup (gzip) | 522.6 KiB | 522.5 KiB | 0.01% |
| Palco cinematográfico startup (Brotli Q6) | 490.7 KiB | 490.6 KiB | 0.02% |
| Editor startup (gzip) | 173.1 KiB | 173.4 KiB | -0.15% |
| Editor startup (Brotli Q6) | 164.0 KiB | 164.2 KiB | -0.10% |
| Simulação Worker startup (gzip) | 27.8 KiB | 27.9 KiB | -0.50% |
| Simulação Worker startup (Brotli Q6) | 26.7 KiB | 26.9 KiB | -0.52% |

Brotli Q6 é estimativa offline; o navegador só recebe essa compressão se o CDN responder com Content-Encoding: br.

Gate: nenhum aumento de gzip/Brotli no total ou nos caminhos de startup acima. Medidas e rotas ausentes falham; o orçamento absoluto é verificado por bundle:check.

## Gate failures

- JS emitido total (gzip): 2237528 exceeds baseline 2234126 by 3402 bytes
- JS emitido total (Brotli Q6): 2108392 exceeds baseline 2105433 by 2959 bytes
- Nova carreira startup (gzip): 437787 exceeds baseline 437727 by 60 bytes
- Partida rápida startup (gzip): 299487 exceeds baseline 299429 by 58 bytes
- Partida rápida startup (Brotli Q6): 283727 exceeds baseline 283723 by 4 bytes
- Editor startup (gzip): 177566 exceeds baseline 177302 by 264 bytes
- Editor startup (Brotli Q6): 168101 exceeds baseline 167934 by 167 bytes
- Simulação Worker startup (gzip): 28560 exceeds baseline 28419 by 141 bytes
- Simulação Worker startup (Brotli Q6): 27495 exceeds baseline 27354 by 141 bytes
