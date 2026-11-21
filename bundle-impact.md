# Bundle impact: baseline vs candidate

Comparação de builds com a mesma máquina e configurações. **Números de código transferido estimado**, não LCP, INP, FPS ou tempo real de carregamento. Total inclui chunks lazy e não representa o download inicial.

| Métrica | Antes | Depois | Redução (+) / aumento (−) |
|---|---:|---:|---:|
| JS emitido total raw (inclui lazy) | 7169.9 KiB | 7289.1 KiB | -1.66% |
| JS emitido total (gzip) | 2337.5 KiB | 2380.0 KiB | -1.82% |
| JS emitido total (Brotli Q6) | 2208.2 KiB | 2248.4 KiB | -1.82% |
| Página inicial startup (gzip) | 163.7 KiB | 164.2 KiB | -0.32% |
| Página inicial startup (Brotli Q6) | 155.0 KiB | 155.5 KiB | -0.30% |
| Nova carreira startup (gzip) | 420.3 KiB | 419.8 KiB | 0.11% |
| Nova carreira startup (Brotli Q6) | 398.1 KiB | 397.4 KiB | 0.16% |
| Partida rápida startup (gzip) | 172.8 KiB | 174.4 KiB | -0.95% |
| Partida rápida startup (Brotli Q6) | 163.8 KiB | 165.2 KiB | -0.85% |
| Lobby multiplayer startup raw | 2982.7 KiB | 1358.3 KiB | 54.46% |
| Lobby multiplayer startup (gzip) | 944.3 KiB | 450.1 KiB | 52.33% |
| Lobby multiplayer startup (Brotli Q6) | 889.7 KiB | 425.6 KiB | 52.16% |
| Match 3D startup (gzip) | 564.7 KiB | 559.7 KiB | 0.88% |
| Match 3D startup (Brotli Q6) | 535.5 KiB | 530.5 KiB | 0.94% |
| Palco cinematográfico startup (gzip) | 527.0 KiB | 527.7 KiB | -0.13% |
| Palco cinematográfico startup (Brotli Q6) | 495.0 KiB | 495.6 KiB | -0.12% |
| Editor startup (gzip) | 174.1 KiB | 174.6 KiB | -0.28% |
| Editor startup (Brotli Q6) | 164.9 KiB | 165.3 KiB | -0.25% |
| Simulação Worker startup (gzip) | 29.7 KiB | 29.7 KiB | 0.00% |
| Simulação Worker startup (Brotli Q6) | 28.5 KiB | 28.5 KiB | -0.00% |

Brotli Q6 é estimativa offline; o navegador só recebe essa compressão se o CDN responder com Content-Encoding: br.

Gate: JS total agregado pode crescer até 400.000 bytes em raw, gzip nível 9 e Brotli Q6; cada métrica gzip/Brotli de startup por rota pode crescer até 2.048 bytes. Medidas e rotas ausentes falham; orçamentos absolutos continuam verificados por bundle:check.

Gate: passed.
