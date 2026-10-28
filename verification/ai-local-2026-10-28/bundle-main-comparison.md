# Bundle impact: baseline vs candidate

Comparação de builds com a mesma máquina e configurações. **Números de código transferido estimado**, não LCP, INP, FPS ou tempo real de carregamento. Total inclui chunks lazy e não representa o download inicial.

| Métrica | Antes | Depois | Redução |
|---|---:|---:|---:|
| JS emitido total (inclui lazy) | 6740.7 KiB | 6743.3 KiB | -0.04% |
| JS emitido total (gzip) | 2181.8 KiB | 2185.1 KiB | -0.15% |
| JS emitido total (Brotli Q6) | 2056.1 KiB | 2059.1 KiB | -0.15% |
| Página inicial startup (gzip) | 162.7 KiB | 162.4 KiB | 0.21% |
| Página inicial startup (Brotli Q6) | 154.2 KiB | 153.8 KiB | 0.20% |
| Nova carreira startup (gzip) | 427.5 KiB | 427.6 KiB | -0.03% |
| Nova carreira startup (Brotli Q6) | 403.9 KiB | 404.1 KiB | -0.04% |
| Partida rápida startup (gzip) | 292.4 KiB | 292.5 KiB | -0.04% |
| Partida rápida startup (Brotli Q6) | 277.1 KiB | 277.2 KiB | -0.05% |
| Match 3D startup (gzip) | 549.6 KiB | 550.1 KiB | -0.10% |
| Match 3D startup (Brotli Q6) | 519.7 KiB | 520.2 KiB | -0.10% |
| Palco cinematográfico startup (gzip) | 522.6 KiB | 522.6 KiB | 0.00% |
| Palco cinematográfico startup (Brotli Q6) | 490.7 KiB | 490.7 KiB | -0.00% |
| Editor startup (gzip) | 173.1 KiB | 173.5 KiB | -0.18% |
| Editor startup (Brotli Q6) | 164.0 KiB | 164.3 KiB | -0.17% |
| Simulação Worker startup (gzip) | 27.8 KiB | 27.9 KiB | -0.65% |
| Simulação Worker startup (Brotli Q6) | 26.7 KiB | 26.9 KiB | -0.58% |

Brotli Q6 é estimativa offline; o navegador só recebe essa compressão se o CDN responder com Content-Encoding: br.

Gate: nenhum aumento de gzip/Brotli no total ou nos caminhos de startup acima. Medidas e rotas ausentes falham; o orçamento absoluto é verificado por bundle:check.

## Gate failures

- JS emitido total (gzip): 2237512 exceeds baseline 2234126 by 3386 bytes
- JS emitido total (Brotli Q6): 2108548 exceeds baseline 2105433 by 3115 bytes
- Nova carreira startup (gzip): 437866 exceeds baseline 437727 by 139 bytes
- Nova carreira startup (Brotli Q6): 413780 exceeds baseline 413635 by 145 bytes
- Partida rápida startup (gzip): 299541 exceeds baseline 299429 by 112 bytes
- Partida rápida startup (Brotli Q6): 283851 exceeds baseline 283723 by 128 bytes
- Match 3D startup (gzip): 563310 exceeds baseline 562749 by 561 bytes
- Match 3D startup (Brotli Q6): 532663 exceeds baseline 532136 by 527 bytes
- Palco cinematográfico startup (Brotli Q6): 502467 exceeds baseline 502442 by 25 bytes
- Editor startup (gzip): 177619 exceeds baseline 177302 by 317 bytes
- Editor startup (Brotli Q6): 168223 exceeds baseline 167934 by 289 bytes
- Simulação Worker startup (gzip): 28605 exceeds baseline 28419 by 186 bytes
- Simulação Worker startup (Brotli Q6): 27514 exceeds baseline 27354 by 160 bytes
