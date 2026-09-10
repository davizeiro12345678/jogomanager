# Roadmap

## Novo pedido (2026-09-10)
- [x] Página /visual: controles de texturas, geometria dos jogadores, clima e grama por clube, salvos no navegador
- [ ] Tela de criação de clube (nome, cidade, estádio, torcida, uniforme) com retrato do clube
- [ ] Medir desempenho de partida longa no celular e ajustar qualidade/pós-processamento
- [ ] Melhorias massivas: jogadores, cutscenes, stack visual do site
- [ ] Carreira de treinador ligada de ponta a ponta (liga, finanças, pressão, contratações, temporada completa)
- [ ] Narração e eventos dinâmicos adaptativos; conquistas de engajamento
- [x] Tela inicial enxuta no celular (2 botões, ligas resumidas)
- [x] Novos pacotes na loja (moedas iniciais, cofre, comemorações, estádio)
- [x] Loja com packs baratos + chat com pessoas reais e com IA (também dentro da partida, em gaveta)
- [ ] Editor/customização: elencos, escudos, kits, nomes, fotos, campeonatos e ligas; regens com foto
- [ ] Atributos detalhados dos jogadores (personalidade, moral, histórico de clubes, fotos)


## Em andamento (plano aprovado 05/09)
- [ ] Banco de dados de futebol (competições, clubes, estádios, kits, jogadores, ids externos, import_runs)
- [ ] Importador das APIs (TheSportsDB / football-data.org / API-Football) + rota de sincronização
- [ ] Escudos e camisas oficiais na interface e no 3D, com alternância oficial/próprio
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
- [ ] Logo.dev, Firecrawl, PostHog, Resend (avaliar valor real antes de ligar)
- [x] PostHog — eventos de uso e checkout (sem dados pessoais)
- [x] Logo.dev — logos reais de marcas nas placas de LED (configurável em /visual)
- [x] Resend — conta ligada; falta um domínio verificado para enviar e-mails
