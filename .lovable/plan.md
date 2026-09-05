# Ligas e elencos reais + mega atualização gráfica + banco de dados

## O que já existe hoje

- As 51 ligas e os 224 clubes do jogo **já são reais** (Brasileirão, Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, etc.), com cores corretas.
- Apenas **28 clubes** têm elenco com jogadores reais nomeados. Os outros ~196 recebem nomes gerados por sorteio.
- As camisas são geradas por sorteio a partir das cores do clube — por isso o Barcelona pode aparecer sem as listras e o Juventus sem o preto e branco.
- Todos os dados vivem em arquivos dentro do app; não há banco de dados de futebol.

## O que muda

### 1. Elencos reais em todos os clubes
Escrever o elenco real (nome, posição, idade, nível) de **todos os 224 clubes**, começando pelas grandes ligas e descendo até as menores. Cada clube passa a ter de 18 a 24 jogadores reais, com goleiros, defensores, meias e atacantes na proporção correta, capitão, camisa 10 e joias da base.

### 2. Camisas reais
Cada clube ganha o desenho verdadeiro do seu uniforme, definido à mão: listras verticais (Barcelona, Newcastle, Juventus), listras horizontais (Celtic, Sporting), faixa diagonal (River Plate, Peru), tricolor (Fluminense, Bahia), mangas contrastantes, gola e detalhes — além do uniforme reserva e do uniforme do goleiro. Aparecem no campo em 3D, nos escudos e nas listas de elenco.

Sobre direitos: nomes de clubes, jogadores e competições são informação pública e podem ser usados. Escudos oficiais, fotos de jogadores e logotipos de patrocinadores são protegidos — então os escudos continuam sendo desenhos próprios nas cores certas, e as camisas reproduzem o padrão (listras, cores, faixas) sem marcas nem patrocínio.

### 3. Banco de dados real
Criar no banco da nuvem as tabelas de **competições, clubes, estádios, uniformes, jogadores, temporadas e classificações**, com todos esses dados carregados. O jogo passa a ler daí, com os arquivos locais servindo de reserva caso a rede falhe. Isso permite, adiante, atualizar elencos sem reescrever o app e cruzar estatísticas entre carreiras.

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
