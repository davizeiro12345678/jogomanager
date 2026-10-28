# Bundle impact: baseline vs candidate

Comparação de builds com a mesma máquina e configurações. **Números de código transferido estimado**, não LCP, INP, FPS ou tempo real de carregamento. Total inclui chunks lazy e não representa o download inicial.

| Métrica | Antes | Depois | Redução |
|---|---:|---:|---:|
| JS emitido total (inclui lazy) | 6743.3 KiB | 6743.3 KiB | -0.00% |
| JS emitido total (gzip) | 2184.9 KiB | 2185.1 KiB | -0.01% |
| JS emitido total (Brotli Q6) | 2058.9 KiB | 2059.1 KiB | -0.01% |
| Página inicial startup (gzip) | 162.4 KiB | 162.4 KiB | 0.00% |
| Página inicial startup (Brotli Q6) | 153.7 KiB | 153.8 KiB | -0.07% |
| Nova carreira startup (gzip) | 427.6 KiB | 427.6 KiB | -0.01% |
| Nova carreira startup (Brotli Q6) | 403.9 KiB | 404.1 KiB | -0.04% |
| Partida rápida startup (gzip) | 292.5 KiB | 292.5 KiB | 0.00% |
| Partida rápida startup (Brotli Q6) | 277.1 KiB | 277.2 KiB | -0.04% |
| Match 3D startup (gzip) | 550.0 KiB | 550.1 KiB | -0.01% |
| Match 3D startup (Brotli Q6) | 520.0 KiB | 520.2 KiB | -0.03% |
| Palco cinematográfico startup (gzip) | 522.6 KiB | 522.6 KiB | 0.00% |
| Palco cinematográfico startup (Brotli Q6) | 490.6 KiB | 490.7 KiB | -0.02% |
| Editor startup (gzip) | 173.5 KiB | 173.5 KiB | 0.00% |
| Editor startup (Brotli Q6) | 164.2 KiB | 164.3 KiB | -0.06% |
| Simulação Worker startup (gzip) | 27.9 KiB | 27.9 KiB | -0.16% |
| Simulação Worker startup (Brotli Q6) | 26.9 KiB | 26.9 KiB | -0.07% |

Brotli Q6 é estimativa offline; o navegador só recebe essa compressão se o CDN responder com Content-Encoding: br.

Gate: nenhum aumento de gzip/Brotli no total ou nos caminhos de startup acima. Medidas e rotas ausentes falham; o orçamento absoluto é verificado por bundle:check.

## Gate failures

- JS emitido total (gzip): 2237512 exceeds baseline 2237347 by 165 bytes
- JS emitido total (Brotli Q6): 2108548 exceeds baseline 2108288 by 260 bytes
- Página inicial startup (Brotli Q6): 157540 exceeds baseline 157431 by 109 bytes
- Nova carreira startup (gzip): 437866 exceeds baseline 437824 by 42 bytes
- Nova carreira startup (Brotli Q6): 413780 exceeds baseline 413624 by 156 bytes
- Partida rápida startup (Brotli Q6): 283851 exceeds baseline 283741 by 110 bytes
- Match 3D startup (gzip): 563310 exceeds baseline 563250 by 60 bytes
- Match 3D startup (Brotli Q6): 532663 exceeds baseline 532488 by 175 bytes
- Palco cinematográfico startup (Brotli Q6): 502467 exceeds baseline 502358 by 109 bytes
- Editor startup (Brotli Q6): 168223 exceeds baseline 168114 by 109 bytes
- Simulação Worker startup (gzip): 28605 exceeds baseline 28560 by 45 bytes
- Simulação Worker startup (Brotli Q6): 27514 exceeds baseline 27495 by 19 bytes
