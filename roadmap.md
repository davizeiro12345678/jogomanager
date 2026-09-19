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

## Novo pedido (2026-09-12)
- [ ] Salto visual 3D: jogadores, torcida, gramado, texturas e cutscenes
- [ ] Corrigir gargalos e avisos da partida 3D sem reduzir a qualidade escolhida
- [ ] Ampliar importação oficial com fotos de estádios e uniformes alternativos


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

## Verificações (2026-09-18)
- [x] Compra real de ponta a ponta na loja: R$4,90 → saldo 1500 → 1700 moedas, tela "Tudo certo!"
- [ ] FPS no navegador: sandbox usa renderização por software (sem placa de vídeo) — medição não representativa
- [ ] PageSpeed: cota diária da API do Google esgotada hoje
- [ ] Ampliar elencos: 415 clubes ainda sem elenco; fonte gratuita não devolve jogadores (precisa de chave paga API-Football/football-data)
- [ ] Salto visual 3D (luz/câmera/texturas) e revisão de painel/elenco/loja

## Novo pedido (2026-09-18) — plano aprovado
- [ ] Renderização WebGPU (three.js WebGPURenderer) com volta automática para WebGL2
- [ ] Revisão visual: partida, carreira, elenco, loja
- [ ] Ampliar elencos/escudos com Logo.dev, Firecrawl e Perplexity
- [ ] 25 novas cutscenes + 25 cenas híbridas
- [ ] PlayerRig: novos estados e transições; PostFX por qualidade; Crest mais nítido

## Mega atualização integrada (2026-09-19)
- [ ] Página acessível de compartilhamento com mensagem pronta e compartilhamento nativo
- [ ] CTA “Salvar na nuvem” no topo/painel e convite inteligente para visitantes
- [ ] Redesenhar autenticação com Google em destaque, perfis e provedores habilitados
- [ ] Publicar WhatsApp e e-mail confirmados na página de contato
- [ ] Aplicar novo ícone oficial ao favicon e PWA
- [ ] Atualizar descrições da home e padronizar páginas públicas prioritárias
- [ ] Otimizar carregamento, cache, imagens e execução da partida 3D
- [ ] Melhorar sombras, iluminação, texturas, jogadores, simulação e IA adversária
- [ ] Triplicar a variedade do narrador e aprimorar o assistente com contexto real
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
- [ ] Medir FPS, frame time, 1% low, GPU/backend, memória e estabilidade em partida longa
- [ ] Aplicar salto gráfico escalável em iluminação, sombras, texturas, gramado, estádio e pós-processamento
- [ ] Melhorar anatomia, materiais, LOD, transições e animações dos jogadores sem sacrificar fluidez
- [ ] Corrigir bugs restantes da engine, física da bola, goleiros, colisões, posicionamento e IA adversária
- [ ] Ampliar variedade, contexto, emoção e segurança da narração em todos os eventos relevantes
- [ ] Concluir redesign e acessibilidade das telas de partida, carreira, elenco, tática, loja e campeonato
- [ ] Revisar metadados únicos, indexação, páginas públicas e conteúdo institucional
- [ ] Validar fluxos completos, compra, salvamento, replay, PWA, mobile, console, tipos, testes e compilação
