# Match 3D — atualização gráfica em cinco frentes

Solicitação executada com cinco subagentes e integração central. Referência: `74d6e75c629277ed477e71df47346525aa183fdd`. Data do solicitante: 23/10/2026, São Paulo. Resultado de implementação e testes: parcial, sujeito aos gates de release já bloqueantes; GPU nativa não certificada.

## Mudanças

| Frente          | Alterações concretas                                                                                                                                                                                            | Custo e limites                                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jogador         | Mandíbula e queixo contínuos, suporte malar/orbital, relevo nasal e maxilar menos pinçado; cabelo com massas e cores irregulares; shorts/meias menos acetinados                                                 | Mesmos vértices, índices, meshes, mapas e passes. Modelo continua estilizado; orelhas/pálpebras/lábios separados ainda limitam realismo                                                      |
| Movimento       | Pés parados com carga estável, braços ativados progressivamente ao iniciar; reinício/interrupção de ação tratados; correção de chão não gera falso recuo; perna de apoio assenta antes do tronco                | Sem estado React por frame. Cinco objetos e uma closure deixam de ser criados por amostra; um pose buffer adicional de 22 canais por blender                                                 |
| Torcida         | Quatro poses nos cartões distantes: repouso, braços altos, palmas e mãos à cabeça; comemoração, surpresa, protesto assimétrico e canto articulados nos modelos próximos                                         | Atlas mantém 64×128; três lotes instanciados, sem novos atributos, meshes ou triângulos. Cartões trocam discretamente entre poses; WebGPU nativo mantém cartão parado. ALU do shader aumenta |
| Campo/estádio   | Gramado irregular com escala em metros e filtragem por derivadas; escape mais escuro e linhas claras; concreto com poros coerentes, sombra arquitetônica e metal menos brilhante; luz diurna existente ajustada | Sem novos draws, luzes, passes ou texture fetches no shader de campo; mapas de concreto mantêm 8 KiB. Arquitetura mantém três lotes e limite de 10k triângulos                               |
| Contatos/física | Rede do Rapier visual alinhada a 1,90 m; traves renderizadas passam de raio 0,060 para 0,075 m, conforme autoridade                                                                                             | Canonical solver conserva valores, revisão e regras. Barra visual é redonda e collider continua cuboide com os mesmos limites externos                                                       |

O erro de rede foi reproduzido em ambas as direções: o fallback visual rebatia a bola em uma parede invisível, 0,95 m antes da rede correta. O teste usa Rapier real. Um segundo contrato inspeciona o JSX das traves, constrói sua geometria Three e compara limites mundiais com colliders restaurados do Rapier. Mantidos os 16 segmentos e os raios dos suportes secundários.

## Validação integrada

- Suíte completa: **2.065 testes em 379 arquivos**, aprovada. Após a última correção do normal inverso da torcida, sete contratos focados também passaram.
- Stress: **200 seeds com replay independente**, aprovado em 316,51 s. Campanha real, executada pelo teste separado.
- TypeScript e ESLint: aprovados; zero erros/warnings do código. Contratos Node: 13 aprovados.
- Player LOD distante: **56.232 triângulos para 22 jogadores**, teto de 58.000 mantido. Novos traços de rosto/cabelo não aumentam a topologia.
- Capturas isoladas feitas antes da promoção: rosto frontal, perfil, corrida, desarme e finalização em fase fixa. Captura com movimento inválido `shot` foi descartada; finalização usa `shotPower`.
- Torcida: shaders renderizados no navegador com poses de repouso, surpresa e gol; controles opt-in `manual=1&crowdProbe=1` alteram somente a cópia de apresentação, com sinalização explícita. Esses gols sintéticos não são resultados do Worker e não medem física nem performance de partida.

## CPU e integridade

Comparação ABBA do MatchSim com mesmo Node 24.22.0, dependências instaladas e fixture serializada: 62 amostras por revisão, **21 checkpoints iguais**, nenhuma violação. Medianas: 0,1105555 → 0,1100485 ms, variação −0,46%; IC bootstrap 99% da razão [0,944515; 1,040526]. Não sustenta alegar aceleração do construtor; passa o limite de regressão.

Probe isolado da marcha, após os testes: corpo e direção fixos, 120.000 amostras, sete execuções por revisão em ordem alternada. CPU mediana **218,064 → 132,596 ms (−39,19%)**. Todos os checksums foram −233005,90889159509; delta máximo dos canais comparados a 5,5 m/s foi zero. Os valores em baixa velocidade mudam intencionalmente para retirar o balanço residual. Dados brutos e script acompanham o relatório exportado. Isso não mede renderização, GC de uma partida inteira, carregamento frio ou FPS.

## Evidência visual e decisão

A referência, etapa intermediária e candidato são capturas reais dos estúdios do jogo, com a mesma identidade do atleta. Os shaders da torcida devem ser verificados em todos os LODs; não basta teste textual do shader. As imagens mostram uma evolução procedural; o objetivo não é prometer fotorealismo com os assets atuais.

O ambiente disponível usa SwiftShader, renderização por software. Métricas de quadros são diagnósticas e não certificam desempenho físico. Os limites de 260 draws/850k triângulos no alto e as exigências de FPS/p95 continuam obrigatórios. O PR anterior já tinha bloqueios de bundle/Worker, comparação de checkpoints contra main e Lighthouse móvel. A igualdade dos checkpoints desta iteração contra 74d6e75c não corrige a divergência anterior contra main.

Nenhuma dependência adicionada, nenhum gate flexibilizado, nenhum merge em main/deploy de produção. Os arquivos de fonte, testes, capturas, métricas e limitações devem ser revisados no novo SHA do PR antes de qualquer publicação.
