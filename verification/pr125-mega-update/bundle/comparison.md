# Bundle impact: baseline vs candidate

Comparação de builds com a mesma máquina e configurações. **Números de código transferido estimado**, não LCP, INP, FPS ou tempo real de carregamento. Total inclui chunks lazy e não representa o download inicial.

| Métrica | Antes | Depois | Redução (+) / aumento (−) |
|---|---:|---:|---:|
| JS emitido total raw (inclui lazy) | 7169.6 KiB | 7081.3 KiB | 1.23% |
| JS emitido total (gzip) | 2333.5 KiB | 2311.0 KiB | 0.97% |
| JS emitido total (Brotli Q6) | 2201.4 KiB | 2183.0 KiB | 0.84% |
| Página inicial startup (gzip) | 175.7 KiB | 171.6 KiB | 2.32% |
| Página inicial startup (Brotli Q6) | 166.6 KiB | 162.8 KiB | 2.28% |
| Nova carreira startup (gzip) | 440.6 KiB | 421.7 KiB | 4.30% |
| Nova carreira startup (Brotli Q6) | 416.7 KiB | 399.5 KiB | 4.13% |
| Partida rápida startup (gzip) | 304.7 KiB | 302.7 KiB | 0.66% |
| Partida rápida startup (Brotli Q6) | 288.8 KiB | 287.0 KiB | 0.62% |
| Match 3D startup (gzip) | 580.8 KiB | 565.4 KiB | 2.66% |
| Match 3D startup (Brotli Q6) | 550.0 KiB | 536.2 KiB | 2.51% |
| Palco cinematográfico startup (gzip) | 534.0 KiB | 532.2 KiB | 0.34% |
| Palco cinematográfico startup (Brotli Q6) | 501.6 KiB | 500.1 KiB | 0.31% |
| Editor startup (gzip) | 184.5 KiB | 182.1 KiB | 1.31% |
| Editor startup (Brotli Q6) | 174.9 KiB | 172.7 KiB | 1.24% |
| Simulação Worker startup (gzip) | 29.3 KiB | 29.3 KiB | 0.01% |
| Simulação Worker startup (Brotli Q6) | 28.2 KiB | 28.2 KiB | -0.00% |

Brotli Q6 é estimativa offline; o navegador só recebe essa compressão se o CDN responder com Content-Encoding: br.

Gate: JS total agregado pode crescer até 400.000 bytes em raw, gzip nível 9 e Brotli Q6; cada métrica gzip/Brotli de startup por rota pode crescer até 2.048 bytes. Medidas e rotas ausentes falham; orçamentos absolutos continuam verificados por bundle:check.

Gate: passed.
