# Manager 3D — jogo de futebol com partida ao vivo em 3D

Você é o técnico/manager de um clube real. Escala o time, define tática e assiste à partida acontecer em 3D, dando ordens em tempo real.

## Sobre clubes e jogadores reais

Uso nomes reais de ligas, clubes e elencos (dados públicos, temporada atual). Escudos e uniformes oficiais não podem ser reproduzidos, então cada clube recebe um escudo gerado no estilo do original e as cores corretas do uniforme. Visualmente fica fiel, sem usar arte licenciada.

Ligas na primeira versão: Brasileirão Série A, Premier League, La Liga, Serie A. Cada clube com elenco de ~20 jogadores reais e atributos (ritmo, finalização, passe, defesa, físico, overall).

## Fluxo do jogo

```text
Login  ->  Escolher liga e clube  ->  Central do clube
                                        |
        +-------------------+-----------+-----------+
        | Elenco/Escalação  | Táticas   | Tabela/Calendário
        +-------------------+-----------+-----------+
                                        |
                                 Jogar próxima partida
                                        |
                              PARTIDA 3D AO VIVO (90')
                     ordens em tempo real | substituições
                                        |
                            Resultado -> tabela atualizada
```

## Partida 3D ao vivo

- Estádio 3D com three.js: gramado com faixas de corte, linhas, traves com rede, arquibancada e público, iluminação de refletores, sombras, céu e névoa.
- 22 jogadores em 3D com uniforme do clube, número nas costas, animação de corrida e chute; bola com física.
- Câmeras: transmissão (lateral alta), tática (topo), atrás do gol; troca durante o jogo.
- Simulação: motor próprio que decide posse, passes, dribles, chutes e defesas a partir dos atributos reais dos jogadores e da tática escolhida — os movimentos em 3D refletem o que a simulação decide.
- HUD: placar, cronômetro, posse de bola, chutes, feed de acontecimentos, botões de velocidade (1x/2x/4x/pular).
- Ordens durante a partida: mentalidade (retrancado → all out attack), pressão, substituições (3 por jogo), troca de formação.
- Replay de gol com câmera cinematográfica.

## Gestão entre partidas

- Escalação por arrastar em campo com formações (4-3-3, 4-4-2, 3-5-2, 4-2-3-1), condição física e moral dos jogadores.
- Táticas: linha defensiva, intensidade de pressão, largura, ritmo.
- Temporada com calendário completo da liga, tabela classificatória atualizada e artilharia.
- Estatísticas por jogador acumuladas na temporada.

## Conta e progresso salvo

Login com e-mail/senha via Lovable Cloud. Cada usuário tem sua carreira salva: clube escolhido, rodada atual, tabela, escalação, condição do elenco e histórico de partidas — acessível de qualquer dispositivo.

## Visual

Estilo broadcast de TV: verde de grama profundo, HUD escuro com vidro fosco e detalhe na cor do clube, tipografia condensada esportiva. Sem tema roxo genérico.

## Detalhes técnicos

- three.js + @react-three/fiber/drei para a cena; instancing e LOD para manter fluidez; qualidade adaptável (alta/média) detectada pelo dispositivo.
- Motor de simulação em tick fixo desacoplado do render, rodando no cliente.
- Rota `/` = tela de entrada + seleção de clube; `/club`, `/squad`, `/tactics`, `/league`, `/match/$id` sob layout autenticado.
- Cloud: tabelas `leagues`, `clubs`, `players`, `careers`, `fixtures`, `career_players` com RLS por usuário nas tabelas de carreira e leitura pública das tabelas de dados; dados dos clubes/elencos inseridos por migração.
- Escudos gerados como imagens e servidos como assets.

## Ordem de construção

1. Cloud + auth + schema e seed das 4 ligas com elencos reais.
2. Seleção de clube e central do clube (elenco, táticas, tabela, calendário).
3. Motor de simulação da partida.
4. Estádio 3D e renderização da partida ao vivo com HUD e ordens.
5. Resultado, atualização de tabela e progressão da temporada.
