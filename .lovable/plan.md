# Ligas e elencos reais + mega atualização gráfica + banco de dados

## O que já existe hoje

- As 51 ligas e os 224 clubes do jogo **já são reais** (Brasileirão, Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, etc.), com cores corretas.
- Apenas **28 clubes** têm elenco com jogadores reais nomeados. Os outros ~196 recebem nomes gerados por sorteio.
- As camisas são geradas por sorteio a partir das cores do clube — por isso o Barcelona pode aparecer sem as listras e o Juventus sem o preto e branco.
- Todos os dados vivem em arquivos dentro do app; não há banco de dados de futebol.

## O que muda

### 1. Tudo real vindo de API oficial
O jogo passa a puxar os dados de futebol de APIs públicas de verdade, em vez de listas escritas à mão:

- **TheSportsDB** — escudos/logos oficiais dos clubes, imagens das camisas de cada temporada, fotos e nomes dos estádios, cores oficiais. Tem plano gratuito e é a fonte principal de imagem.
- **football-data.org** — competições, tabelas, calendário e elencos das principais ligas europeias e do Brasileirão.
- **API-Football (API-Sports)** — cobertura ampla (mais de 900 ligas) para elencos, idades, posições e valores dos clubes que as outras duas não cobrem.

Uma rotina de importação roda no servidor, busca clube por clube, baixa os escudos e as imagens de camisa, guarda tudo no banco e nos arquivos do app. Depois disso o jogo funciona mesmo offline — a API só é consultada quando você mandar atualizar.

**Chaves:** TheSportsDB e API-Football exigem uma chave gratuita cadastrada no seu nome. Vou pedir as chaves quando começar essa etapa; sem elas uso apenas football-data.org (gratuita, mas cobre menos ligas) e completo o resto com os dados escritos à mão.

**Direitos de imagem:** escudos e camisas oficiais pertencem aos clubes. Usá-los num jogo publicado é uso de marca de terceiros — funciona bem para projeto pessoal/portfólio, mas se um dia o jogo for comercial os clubes podem pedir a retirada. Por isso o app guarda os dois: o escudo oficial da API e o escudo desenhado por nós, e um botão nas configurações troca entre "visual oficial" e "visual próprio".

### 2. Escudos e camisas no jogo
Os escudos oficiais aparecem em toda a interface (elenco, tabela, mercado, notícias) e na camisa dos jogadores em 3D. A imagem da camisa oficial de cada clube é lida pela API e convertida no uniforme 3D — cor de fundo, listras, mangas e detalhes extraídos da própria imagem —, incluindo uniforme titular, reserva e de goleiro. Se um clube não tiver imagem na API, cai no padrão desenhado à mão (listras do Barcelona, tricolor do Fluminense, faixa do River, etc.).

### 3. Elencos reais em todos os clubes
Elenco real (nome, posição, idade, número, nacionalidade e nível) para **todos os 224 clubes**, importado da API e conferido: 18 a 24 jogadores por clube, na proporção correta de posições, com capitão e joias da base. Onde a API falhar, entra elenco escrito à mão. Foto do jogador aparece quando a API fornece; caso contrário, o rosto gerado pelo jogo.

### 4. Banco de dados real
Criar no banco da nuvem as tabelas de **competições, clubes, estádios, uniformes, jogadores, temporadas, classificações e registro de importações**, com todos esses dados carregados pela rotina de importação. O jogo lê daí, com os arquivos locais servindo de reserva caso a rede falhe. Isso permite atualizar elencos e escudos sem reescrever o app.


### 4. Mega atualização gráfica

**Gramado**
- Faixas de corte reais em xadrez ou listras, com brilho diferente conforme o ângulo da câmera.
- Grama volumétrica perto da câmera, marcas de desgaste na grande área e no círculo central, sombra do estádio no campo, marcas de chuteira e sujeira acumulando durante a partida.
- Linhas de campo pintadas de verdade (não desenhadas por cima), com pontos de pênalti e semicírculos corretos.

**Redes e gols**
- Rede com malha real em vez de textura chapada: fios finos, curvatura natural, presa nas hastes.
- A rede balança quando a bola entra, com a onda partindo do ponto de impacto.
- Traves com brilho de alumínio, bandeirinhas de escanteio que tremem com o vento.

**Jogadores**
- Uniforme com o padrão real do clube, número e nome nas costas, mangas e gola separadas.
- Rostos com mais variação (tons de pele, cabelo, barba), luvas do goleiro, braçadeira de capitão.
- Movimento melhor: corrida com inclinação do tronco, frenagem, giro, salto de cabeceio, comemoração de gol, goleiro caindo para a defesa; suor e respiração pesada quando o cansaço aperta.
- Sombra de contato sob os pés e sombras projetadas pelos refletores.

**Torcida e estádio**
- Milhares de torcedores em vez de manchas: cores divididas por setor (casa e visitante), movimento de onda, bandeirões, mosaico atrás do gol, torcida levantando em lance de perigo e vaiando em erro.
- Arquibancadas em anéis com cobertura, escadas, corredores, camarotes, telão com o placar, placas de publicidade animadas ao redor do campo, túnel de acesso, bancos de reserva com técnico e reservas.
- Iluminação: quatro torres de refletores com halo, hora do dia (tarde, entardecer, noite), céu com nuvens, chuva e neve conforme o clima da rodada.
- Câmera de transmissão com leve tremor, zoom nos lances, replay do gol e closes na comemoração.

**Desempenho**
Três níveis de qualidade (Baixo, Médio, Alto) escolhidos automaticamente pelo aparelho, com o modo Baixo mantendo o celular fluido.

## Detalhes técnicos

- Dados: `src/game/data/squads.ts` cresce para conter os 224 elencos (dividido em arquivos por confederação para não virar um arquivo gigante); novo `src/game/data/kits-real.ts` com o padrão por clube substituindo o sorteio em `src/game/kits.ts`.
- Banco: migração criando `competitions`, `clubs`, `stadiums`, `kits`, `players`, `seasons`, `standings` no schema público, com `GRANT SELECT` para leitura anônima, RLS ativa e políticas somente-leitura; a carga inicial vai por `INSERT` na própria migração. Carregamento no app via função de servidor pública com cache do TanStack Query e fallback para os arquivos locais.
- 3D: `Stadium3D.tsx` dividido em módulos (`Pitch`, `Nets`, `Stands`, `Crowd`, `Lighting`, `BroadcastCamera`) para não passar de mil linhas por arquivo; grama e torcida por `InstancedMesh`; rede como geometria de linhas com simulação de mola; texturas geradas em canvas (sem downloads externos).
- Cadastro do usuário (`/cadastro`) continua funcionando e sobrescreve os dados oficiais quando preenchido.
- Verificação: type-check, build e captura de tela no navegador nos três níveis de qualidade, além de conferir que a partida roda a 60 fps no modo Médio.

## Ordem de entrega

1. Banco de dados + carga de competições, clubes e estádios
2. Camisas reais por clube
3. Elencos reais dos 224 clubes
4. Gramado, redes e iluminação
5. Torcida, arquibancadas e estádio
6. Jogadores, animações e câmera de transmissão
7. Ajuste de desempenho e publicação
