# Roadmap

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
