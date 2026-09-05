# Mega atualização de busca orgânica

Objetivo: fazer o site aparecer no Google para quem procura "manager de futebol", "soccer manager", "jogo de técnico de futebol" e termos parecidos — hoje só a página inicial está bem marcada e o conteúdo público é pequeno.

## Situação atual (verificada)

- Páginas públicas de conteúdo: início, Guias, Ligas de futebol, Dicas de gestão, Cadastro.
- Só a página inicial tem endereço canônico. Nenhuma página tem `og:url`.
- Nenhuma página tem dados estruturados (o bloco que o Google usa para entender que isto é um jogo).
- Nenhuma imagem de compartilhamento: links colados no WhatsApp/X aparecem sem figura.
- O mapa do site lista 8 endereços; o arquivo de regras dos buscadores está correto.

## O que será feito

### 1. Marcação completa em todas as páginas
- Endereço canônico e `og:url` próprios em cada página pública (nunca apontando para a home).
- Título e descrição revisados página a página, com as palavras que as pessoas realmente buscam em português.
- Dados estruturados: ficha de videogame na home, ficha de artigo nos guias e dicas, lista das ligas na página de ligas, e trilha de navegação nas páginas internas.
- Páginas do jogo (painel, elenco, táticas, partida, etc.) marcadas para não competir com o conteúdo público nos resultados.

### 2. Imagem de compartilhamento
- Uma imagem 1200x630 do estádio/partida em 3D, usada como prévia dos links nas páginas públicas.

### 3. Novas páginas públicas de conteúdo
Cada uma responde a uma busca real e leva o visitante para começar uma carreira:
- **Jogo de manager de futebol grátis** — página principal de captura do termo mais buscado.
- **Soccer manager online** — versão para quem busca em inglês/termo internacional.
- **Como ser técnico de futebol no jogo** — passo a passo para iniciantes.
- **Melhores táticas e formações** — 4-3-3, 4-4-2, 3-5-2, quando usar cada uma.
- **Brasileirão no jogo** — clubes, elencos e objetivos, com link para começar já.
- **Mercado de transferências: como contratar bem** — orçamento, salários, contratos.
- **Perguntas frequentes** — precisa instalar? precisa criar conta? funciona no celular?

### 4. Ligação entre páginas
- Bloco de navegação na home e no rodapé apontando para todas as páginas públicas.
- Links cruzados entre guias, táticas, ligas e dicas.

### 5. Mapa do site e publicação
- Todos os endereços novos entram no mapa do site, com datas de atualização.
- Publicação e reenvio do mapa do site ao Google.

## Detalhes técnicos

- Metadados via `head()` de cada `createFileRoute`; `title` dentro do array `meta`; canônico só em rota folha; domínio `https://soccer-manager.fun`.
- Dados estruturados via `head().scripts` com `type: "application/ld+json"`: `VideoGame` na home, `Article` em guias/dicas/táticas, `ItemList` nas ligas, `BreadcrumbList` nas páginas internas.
- `robots: noindex, follow` nas rotas de jogo (`/dashboard`, `/squad`, `/tactics`, `/match`, `/transfers`, `/board`, `/finances`, `/stats`, `/scouting`, `/news`, `/history`, `/club`, `/league`, `/auth`).
- Imagem gerada em 1200x630 e referenciada por URL absoluta em `og:image` e `twitter:image` apenas nas páginas folha públicas — nunca em `__root.tsx`.
- Novas rotas em `src/routes/` (arquivos com nomes em português, ex. `jogo-de-manager-de-futebol.tsx`), listadas em `src/routes/sitemap[.]xml.ts`.
- Conteúdo escrito a partir das regras reais do jogo (força de clube, condição física, pressão da diretoria, salários) — nada inventado, sem depoimentos ou números falsos.
- Validação: `bunx tsgo --noEmit`, build limpo e conferência das páginas no navegador antes de publicar.

## Fora do escopo

Nenhuma mudança na jogabilidade, no 3D ou nos dados dos clubes neste plano.
