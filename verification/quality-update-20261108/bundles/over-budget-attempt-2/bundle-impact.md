# Bundle impact: baseline vs candidate

Comparação de builds com a mesma máquina e configurações. **Números de código transferido estimado**, não LCP, INP, FPS ou tempo real de carregamento. Total inclui chunks lazy e não representa o download inicial.

| Métrica | Antes | Depois | Redução (+) / aumento (−) |
|---|---:|---:|---:|
| JS emitido total raw (inclui lazy) | 7169.9 KiB | 7283.8 KiB | -1.59% |
| JS emitido total (gzip) | 2337.5 KiB | 2375.9 KiB | -1.64% |
| JS emitido total (Brotli Q6) | 2208.2 KiB | 2244.7 KiB | -1.65% |
| Página inicial startup (gzip) | 163.7 KiB | 163.9 KiB | -0.15% |
| Página inicial startup (Brotli Q6) | 155.0 KiB | 155.2 KiB | -0.11% |
| Nova carreira startup (gzip) | 420.3 KiB | 422.9 KiB | -0.64% |
| Nova carreira startup (Brotli Q6) | 398.1 KiB | 400.6 KiB | -0.62% |
| Partida rápida startup (gzip) | 172.8 KiB | 173.0 KiB | -0.11% |
| Partida rápida startup (Brotli Q6) | 163.8 KiB | 163.9 KiB | -0.07% |
| Lobby multiplayer startup raw | 2982.7 KiB | 1429.9 KiB | 52.06% |
| Lobby multiplayer startup (gzip) | 944.3 KiB | 480.6 KiB | 49.10% |
| Lobby multiplayer startup (Brotli Q6) | 889.7 KiB | 455.2 KiB | 48.83% |
| Match 3D startup (gzip) | 564.7 KiB | 567.2 KiB | -0.44% |
| Match 3D startup (Brotli Q6) | 535.5 KiB | 537.8 KiB | -0.43% |
| Palco cinematográfico startup (gzip) | 527.0 KiB | 527.4 KiB | -0.07% |
| Palco cinematográfico startup (Brotli Q6) | 495.0 KiB | 495.3 KiB | -0.06% |
| Editor startup (gzip) | 174.1 KiB | 174.3 KiB | -0.10% |
| Editor startup (Brotli Q6) | 164.9 KiB | 165.0 KiB | -0.06% |
| Simulação Worker startup (gzip) | 29.7 KiB | 29.7 KiB | 0.00% |
| Simulação Worker startup (Brotli Q6) | 28.5 KiB | 28.5 KiB | -0.00% |

Brotli Q6 é estimativa offline; o navegador só recebe essa compressão se o CDN responder com Content-Encoding: br.

Gate: JS total agregado pode crescer até 400.000 bytes em raw, gzip nível 9 e Brotli Q6; cada métrica gzip/Brotli de startup por rota pode crescer até 2.048 bytes. Medidas e rotas ausentes falham; orçamentos absolutos continuam verificados por bundle:check.

## Gate failures

- Nova carreira startup (gzip): growth 2744 bytes exceeds allowed +2048 bytes (baseline 430340, candidate 433084)
- Nova carreira startup (Brotli Q6): growth 2519 bytes exceeds allowed +2048 bytes (baseline 407645, candidate 410164)
- Match 3D startup (gzip): growth 2546 bytes exceeds allowed +2048 bytes (baseline 578285, candidate 580831)
- Match 3D startup (Brotli Q6): growth 2348 bytes exceeds allowed +2048 bytes (baseline 548367, candidate 550715)
