# Roadmap

## Estado real auditado — 2026-09-19

### Concluído e validado
- [x] Física ao vivo em Worker nas partidas de carreira, rápida e multiplayer, com interpolação e fallback
- [x] Engine determinística, coleções limitadas, perseguição sem alocação/ordenação por passo e colisão ponderada
- [x] Curva da bola corrigida para usar o mesmo vetor de velocidade nos dois eixos
- [x] Medidor de FPS, média, p95, 1% low, tempo de quadro, memória, qualidade e renderizador
- [x] Qualidade adaptativa, WebGPU experimental com fallback WebGL2, três LODs e 237 clipes de animação
- [x] 57 cutscenes, incluindo 25 cenas híbridas
- [x] Narrador expandido para 350 falas PT, 250 EN e 235 ES
- [x] Importação em massa de uniformes home/away/third/goalkeeper quando a fonte os oferece
- [x] Testes atuais: 8 testes, 109 verificações; tipos, compilação e diferenças de código sem erro

### Trabalho interno ainda aberto
- [ ] Testes integrados de salvamento offline→nuvem e entrega idempotente de pagamento com banco isolado
- [ ] Revisão final e unificada de HUD, carreira, elenco, tática, loja e campeonato em celular
- [ ] Segunda rodada de realismo da IA adversária, goleiros, posicionamento e transições do PlayerRig
- [ ] Revisão final de metadados exclusivos e conteúdo das páginas públicas restantes
- [ ] Teste automatizado de replay, PWA e partida longa no navegador
- [x] Regressão do chute nominalmente certeiro que curva para fora e deixava a bola sem dono
- [x] Sequência cinematográfica de vestiário, túnel, entrada no estádio e coletiva, com narração
- [x] Cenários 3D procedurais próprios para vestiário, túnel, gramado e coletiva, carregados somente durante as cenas
- [x] Falas exatas de cada cena narradas pela ElevenLabs, com voz local como fallback
- [x] Convite pós-jogo explicando o que o Google preserva na nuvem
- [x] Correções prioritárias de anúncio de placar/login, redução de movimento e SEO técnico das rotas utilitárias
- [x] Navegações rotuladas, seletor de idioma compatível com teclado e foco reforçado no campo tático

### Bloqueios externos — não marcar como concluído sem evidência
- [ ] Medir uma partida longa em celular e desktop com GPU física; o ambiente atual usa renderização por software
- [ ] Completar os elencos sem cobertura nas fontes contratadas; não inventar jogadores reais
- [ ] Repetir PageSpeed quando a cota externa estiver disponível

---

## Novo pedido (2026-09-10)
- [x] Página /visual: controles de texturas, geometria dos jogadores, clima e grama por clube, salvos no navegador
- [x] Tela de criação de clube (nome, cidade, estádio, torcida, uniforme) com retrato do clube
- [ ] Medir desempenho de partida longa no celular e ajustar qualidade/pós-processamento
- [ ] Melhorias massivas: jogadores, cutscenes, stack visual do site
- [ ] Carreira de treinador ligada de ponta a ponta (liga, finanças, pressão, contratações, temporada completa)
- [ ] Narração e eventos dinâmicos adaptativos; conquistas de engajamento
- [x] Tela inicial enxuta no celular (2 botões, ligas resumidas)
- [x] Novos pacotes na loja (moedas iniciais, cofre, comemorações, estádio)
- [x] Loja com packs baratos + chat com pessoas reais e com IA (também dentro da partida, em gaveta)
- [x] Editor/customização: elencos, escudos, kits, nomes, fotos, campeonatos e ligas; regens com foto
- [ ] Atributos detalhados dos jogadores (personalidade, moral, histórico de clubes, fotos)

## Novo pedido (2026-09-12)
- [ ] Salto visual 3D: jogadores, torcida, gramado, texturas e cutscenes
- [ ] Corrigir gargalos e avisos da partida 3D sem reduzir a qualidade escolhida
- [ ] Ampliar importação oficial com fotos de estádios e uniformes alternativos


## Em andamento (plano aprovado 05/09)
- [x] Banco de dados de futebol (competições, clubes, estádios, kits, jogadores, ids externos, import_runs)
- [x] Importador das APIs (TheSportsDB / football-data.org / API-Football/Sportmonks) + rota de sincronização
- [x] Escudos e camisas oficiais na interface e no 3D, com alternância oficial/próprio
- [ ] Elencos reais nos 224 clubes (API + reserva escrita à mão)
- [x] Gramado, redes e iluminação (texturas em camadas + cal desgastada)
- [x] Torcida, arquibancadas e estádio (setores, bandeirões, mosaico, cobertura, props)
- [x] Jogadores, animações e câmera de transmissão (rig anatômico, 3 LODs, chuteiras)
- [x] Desempenho nos três níveis (qualidade adaptativa + pós-processamento por momento)
- [x] Calibração de cor da transmissão (céu, exposição e luzes do entardecer)

## Feito
- [x] Páginas públicas /guias, /ligas-de-futebol, /dicas-de-gestao no sitemap
- [x] Página /cadastro de clubes e jogadores do usuário
- [x] Modo convidado, carreira local + nuvem
- [x] PlayerRig integrado ao Stadium3D


## Feito (2026-09-05)
- Escudos oficiais importados para 287 clubes e imagens de camisa para 240.
- Elencos reais (nomes, idades, números, nacionalidade e fotos quando existem) importados e aplicados ao criar carreira.
- Publicado e sitemap atualizado.

- [x] Importação contínua dos dados reais (escudos, estádios, elencos) — 935 clubes com elenco, 1073 escudos

- [x] Criação do treinador em etapas (identidade, aparência, perfil, clube) + cutscene de chegada
- [x] Carreira de treinador semana a semana (/carreira) com cutscenes e galeria
- [x] Qualidade 3D adaptativa por FPS + DPR móvel 0,7-1,25
- [x] Texturas do gramado em módulo próprio (cor, relevo, rugosidade) com cache compartilhado
- [x] Pós-processamento em módulo próprio com presets por qualidade e replay
- [x] Torcida em setores + atualização em taxa reduzida fora da qualidade alta

## Feito (2026-09-06 — fases 1 a 5)
- [x] Fase 1 — criação do próprio clube, ficha completa do jogador, regens e retratos vetoriais
- [x] Fase 2 — conquistas (24 troféus), resumo de carreira do treinador e sincronização na nuvem
- [x] Fase 3 — salto visual do estádio, gramado, torcida, jogadores 3D e cutscenes
- [x] Fase 4 — modo editor (elencos, clubes, competições, importar/exportar)
- [x] Fase 5 — assistente de IA (Gemini), chat global em tempo real e loja com carteira
- [x] Loja: ligar o pagamento real por cartão (Stripe em configuração)
- [x] 89 novas animações procedurais (animation-extra.ts) + variedade no seletor de clipes
- [ ] Salto seguinte: geometria dos jogadores, texturas, cutscenes, página inicial e painéis

## Conectores
- [x] ElevenLabs — narração com voz realista na partida (fallback para a voz do navegador)
- [x] Logo.dev e PostHog ligados; Firecrawl/Perplexity avaliados, mas não usados como fonte factual de elencos
- [x] PostHog — eventos de uso e checkout (sem dados pessoais)
- [x] Logo.dev — logos reais de marcas nas placas de LED (configurável em /visual)
- [x] Resend — conta ligada; falta um domínio verificado para enviar e-mails

## Verificações (2026-09-18)
- [x] Compra real de ponta a ponta na loja: R$4,90 → saldo 1500 → 1700 moedas, tela "Tudo certo!"
- [ ] FPS no navegador: sandbox usa renderização por software (sem placa de vídeo) — medição não representativa
- [ ] PageSpeed: cota diária da API do Google esgotada hoje
- [ ] Ampliar elencos: 415 clubes ainda sem elenco; fonte gratuita não devolve jogadores (precisa de chave paga API-Football/football-data)
- [ ] Salto visual 3D (luz/câmera/texturas) e revisão de painel/elenco/loja
- [x] Sombras 3D de maior definição com área útil ajustada ao campo, iluminação de recorte e resposta física do gramado seco/molhado
- [x] Jogadores com transferência de massa em arrancadas e frenagens, preservando apoio dos pés

## Novo pedido (2026-09-18) — plano aprovado
- [x] Renderização WebGPU experimental e opt-in, com volta automática para WebGL2 e bloqueio após falha
- [ ] Revisão visual: partida, carreira, elenco, loja
- [ ] Ampliar elencos/escudos com Logo.dev, Firecrawl e Perplexity
- [x] 25 novas cutscenes + 25 cenas híbridas (57 cenas totais; 25 marcadas como híbridas)
- [x] PlayerRig: novos estados e transições; PostFX por qualidade; Crest mais nítido

## Mega atualização integrada (2026-09-19)
- [x] Página acessível de compartilhamento com mensagem pronta e compartilhamento nativo
- [x] CTA “Salvar na nuvem” no topo/painel e convite inteligente para visitantes
- [x] Redesenhar autenticação com Google em destaque, perfis e provedores habilitados
- [x] Publicar WhatsApp e e-mail confirmados na página de contato
- [x] Aplicar novo ícone oficial ao favicon e PWA
- [x] Atualizar descrições da home e padronizar páginas públicas prioritárias
- [ ] Otimizar carregamento, cache, imagens e execução da partida 3D
- [ ] Melhorar sombras, iluminação, texturas, jogadores, simulação e IA adversária
- [x] Triplicar a variedade do narrador (350 PT, 250 EN e 235 ES) e alimentar o assistente com contexto do save
- [ ] Redesenhar HUD, painel, elenco, tática, loja e imagens dos pacotes
- [ ] Validar acesso, salvamento, compartilhamento, compra, mobile e partida longa

## Atualização visual, engine, acessibilidade e SEO (2026-09-19)
- [x] Aplicar Archivo Black + Hind e remover dourado dos estados comuns
- [x] Corrigir tone mapping duplicado e melhorar foco/redução de movimento
- [x] Tornar placar, eventos, autenticação e navegações mais acessíveis
- [x] Corrigir noindex de ferramentas pessoais e canonical do multiplayer
- [x] Distinguir expulsão na narração com novas falas PT/EN/ES
- [x] Desacoplar partidas de carreira e rápida para Worker persistente, comandos e snapshots interpolados
- [ ] Validar FPS representativo em aparelho com GPU real e partida longa

## Conclusão total do plano (2026-09-19)
- [x] Concluir Worker das partidas de carreira e rápida com comandos, snapshots, interpolação e fallback local
- [x] Instrumentar FPS, frame time, 1% low, backend, qualidade e memória; estabilidade longa em GPU física segue pendente
- [ ] Aplicar salto gráfico escalável em iluminação, sombras, texturas, gramado, estádio e pós-processamento
- [ ] Melhorar anatomia, materiais, LOD, transições e animações dos jogadores sem sacrificar fluidez
- [ ] Corrigir bugs restantes da engine, física da bola, goleiros, colisões, posicionamento e IA adversária
- [x] Ampliar variedade, contexto, emoção e segurança da narração em todos os eventos relevantes
- [ ] Concluir redesign e acessibilidade das telas de partida, carreira, elenco, tática, loja e campeonato
- [ ] Revisar metadados únicos, indexação, páginas públicas e conteúdo institucional
- [ ] Validar fluxos completos, compra, salvamento, replay, PWA, mobile, console, tipos, testes e compilação

## Reconciliação auditada (2026-09-19)
- [x] Partida ao vivo em Worker também no multiplayer; snapshots interpolados e fallback local
- [x] Corrigir crescimento de `reactionUntil` e limitar o mapa de chutes da engine
- [x] Confirmar sincronização offline→nuvem: outbox drenada ao reconectar e a cada 30 segundos
- [x] Confirmar catálogo visual: 237 clipes procedurais, 57 cutscenes e 25 cenas híbridas
- [x] Indexar `/compartilhar` no sitemap e na navegação pública
- [x] Criar infraestrutura e testes automatizados de simulação determinística/longa e narração (7 testes, 93 asserções)
- [ ] Adicionar testes integrados de salvamento offline→nuvem e pagamento idempotente com banco isolado
- [ ] Completar kits away/third/goalkeeper no fluxo de importação em massa
- [ ] Completar 415 elencos bloqueados pela cobertura/licença das APIs disponíveis
- [ ] Validar relatório de desempenho em celular e desktop com GPU física por partida longa

## Entrega 2026-09-19 (tarde)
- [x] Repertório do narrador ampliado outra vez: novas falas por emoção (rotina, tensão, euforia, decepção, ironia) em PT/EN/ES e dez entradas de locutor
- [x] Esqueleto dos jogadores com clavículas articuladas (ombro acompanha o braço) e mandíbula que abre conforme o esforço

## Evolução integrada aprovada — 2026-09-19
- [x] Redesenhar e aliviar a página inicial e consolidar o sistema visual global
- [x] Reorganizar a interface móvel da partida e unificar os controles principais
- [x] Corrigir passos grandes da bola e ampliar goleiros, corredores de passe e IA adversária
- [x] Impedir bloqueio do avanço rápido, preservar progresso no fallback e reduzir alocações dos snapshots
- [x] Recalibrar luz, sombras, pós-processamento adaptativo, LOD e atualização do PlayerRig fora de câmera
- [x] Tornar a narração contextual com cache LRU, buffer Blob, legenda sincronizada e recuperação de falhas
- [x] Sincronizar voz das cutscenes, pré-carregar a próxima fala e adaptar sombras/resolução 3D ao aparelho
- [x] Manter AVIF/WebP responsivo da home e limitar/versionar caches da PWA
- [x] Validar simulação, tipos, compilação e navegador desktop sem erros
- [ ] Validar FPS representativo em aparelho com GPU física e partida longa

## Novo pedido — dados reais e salto gráfico (2026-09-19)
- [ ] Reconciliar todas as pendências do plano com o estado atual
- [ ] Conectar somente fontes úteis e acessíveis para importar dados reais
- [ ] Ampliar banco com história, troféus e metadados de estádio dos clubes
- [ ] Importar o máximo permitido de kits, escudos, jogadores, fotos, estádios, história e troféus sem inventar dados
- [ ] Exibir história e troféus reais nos painéis de clube/manager
- [ ] Aplicar novo ciclo massivo de realismo 3D preservando o modo Fluidez
- [ ] Validar tipos, testes, build e principais telas no navegador
