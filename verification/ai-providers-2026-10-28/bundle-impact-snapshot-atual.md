# Bundle impact: baseline vs candidate

Comparação de builds com a mesma máquina e configurações. **Números de código transferido estimado**, não LCP, INP, FPS ou tempo real de carregamento. Total inclui chunks lazy e não representa o download inicial.

| Métrica | Antes | Depois | Redução |
|---|---:|---:|---:|
| JS emitido total (inclui lazy) | 6740.7 KiB | 6743.3 KiB | -0.04% |
| JS emitido total (gzip) | 2181.8 KiB | 2184.9 KiB | -0.14% |
| JS emitido total (Brotli Q6) | 2056.1 KiB | 2058.9 KiB | -0.14% |
| Página inicial startup (gzip) | 162.7 KiB | 162.4 KiB | 0.21% |
| Página inicial startup (Brotli Q6) | 154.2 KiB | 153.7 KiB | 0.27% |
| Nova carreira startup (gzip) | 427.5 KiB | 427.6 KiB | -0.02% |
| Nova carreira startup (Brotli Q6) | 403.9 KiB | 403.9 KiB | 0.00% |
| Partida rápida startup (gzip) | 292.4 KiB | 292.5 KiB | -0.04% |
| Partida rápida startup (Brotli Q6) | 277.1 KiB | 277.1 KiB | -0.01% |
| Match 3D startup (gzip) | 549.6 KiB | 550.0 KiB | -0.09% |
| Match 3D startup (Brotli Q6) | 519.7 KiB | 520.0 KiB | -0.07% |
| Palco cinematográfico startup (gzip) | 522.6 KiB | 522.6 KiB | 0.00% |
| Palco cinematográfico startup (Brotli Q6) | 490.7 KiB | 490.6 KiB | 0.02% |
| Editor startup (gzip) | 173.1 KiB | 173.5 KiB | -0.18% |
| Editor startup (Brotli Q6) | 164.0 KiB | 164.2 KiB | -0.11% |
| Simulação Worker startup (gzip) | 27.8 KiB | 27.9 KiB | -0.50% |
| Simulação Worker startup (Brotli Q6) | 26.7 KiB | 26.9 KiB | -0.52% |

Brotli Q6 é estimativa offline; o navegador só recebe essa compressão se o CDN responder com Content-Encoding: br.

Gate: nenhum aumento de gzip/Brotli no total ou nos caminhos de startup acima. Medidas e rotas ausentes falham; o orçamento absoluto é verificado por bundle:check.

## Gate failures

- JS emitido total (gzip): 2237347 exceeds baseline 2234126 by 3221 bytes
- JS emitido total (Brotli Q6): 2108288 exceeds baseline 2105433 by 2855 bytes
- Nova carreira startup (gzip): 437824 exceeds baseline 437727 by 97 bytes
- Partida rápida startup (gzip): 299544 exceeds baseline 299429 by 115 bytes
- Partida rápida startup (Brotli Q6): 283741 exceeds baseline 283723 by 18 bytes
- Match 3D startup (gzip): 563250 exceeds baseline 562749 by 501 bytes
- Match 3D startup (Brotli Q6): 532488 exceeds baseline 532136 by 352 bytes
- Editor startup (gzip): 177619 exceeds baseline 177302 by 317 bytes
- Editor startup (Brotli Q6): 168114 exceeds baseline 167934 by 180 bytes
- Simulação Worker startup (gzip): 28560 exceeds baseline 28419 by 141 bytes
- Simulação Worker startup (Brotli Q6): 27495 exceeds baseline 27354 by 141 bytes
