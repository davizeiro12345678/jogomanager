# Realismo gráfico e base histórica completa dos clubes

## Objetivo
Entregar um salto visual perceptível na partida sem sacrificar o modo Fluidez e transformar os painéis em uma central histórica, abastecida apenas por fontes esportivas verificáveis.

## 1. Base esportiva real e rastreável
- Ampliar o cadastro de clubes com biografia, país/cidade, fundação, estádio, capacidade, foto do estádio, site oficial, fonte e data da última atualização.
- Criar registros normalizados de títulos históricos por clube: competição, quantidade, temporadas conhecidas e fonte.
- Preservar separação entre títulos reais do clube e troféus conquistados pelo jogador na carreira.
- Expandir a importação TheSportsDB/API-Football/Sportmonks para escudos, kits home/away/third/goleiro, jogadores, fotos, estádios, biografia e honrarias conforme cada plano permitir.
- Deduplicar por clube/fonte/temporada e não substituir um dado bom por valor vazio ou menos completo.
- Registrar cobertura e falhas por lote, com limites de concorrência, prazo e requisições para não desperdiçar cota.

## 2. Painéis com história e troféus
- Adicionar ao painel do manager um bloco “Identidade do clube” com fundação, estádio, cidade, capacidade e resumo histórico.
- Adicionar uma sala “Títulos do clube” com contagem por competição e temporadas, identificada como história real.
- Manter a sala da carreira para conquistas do treinador, claramente separada.
- Mostrar estados de carregamento, indisponibilidade e fonte/última atualização, sem inventar conteúdo quando a API não tiver cobertura.

## 3. Novo ciclo de realismo gráfico
- Iluminação por horário e clima com uma única luz principal sombreada, preenchimento e recorte baratos, mantendo orçamento por qualidade.
- Sombras estabilizadas no campo, contato mais firme nos pés e resolução adaptativa sem cintilação.
- Materiais PBR dos jogadores com variação sutil de pele, suor, tecido, cabelo, chuteira e lama, compartilhados por cache.
- Gramado com corte direcional, variação de cor, relevo/rugosidade, desgaste, umidade e fibras apenas próximas da câmera.
- Melhorar profundidade de arquibancada, setores, bandeiras e reação da torcida, atualizando animações distantes em frequência menor.
- Pós-processamento adaptativo: antisserrilhado e cor sempre; oclusão, bloom e profundidade apenas quando o orçamento de quadros permitir.
- Câmera com amortecimento independente de FPS, zona morta e cortes sem repetição, sem bloquear a renderização.

## 4. Performance e validação
- Manter física e IA fora do ciclo de desenho; evitar novas alocações por quadro e limitar atualizações de materiais, torcida e placar.
- Preservar os modos Fluidez, Equilíbrio e Beleza e o rebaixamento automático quando o FPS cair.
- Validar testes, tipos, compilação, partida no navegador, painéis e ausência de erros de console.
- O medidor interno continuará mostrando média, 1% low e tempo de quadro; GPU física precisa ser medida no aparelho do usuário.

## 5. Conectores e limites
- Usar as APIs esportivas já conectadas como fonte factual principal.
- Mapbox foi recusado e não será usado; cidade/localização continuará vindo das fontes esportivas.
- Lovable API não é uma fonte de futebol. Athena, S3 e Microsoft Fabric só serão integrados se houver uma conexão acessível contendo arquivos/tabelas esportivos identificados; não serão ligados sem necessidade.
- Fotos, kits e escudos permanecem sujeitos às licenças, cobertura e cotas das fontes. Nenhum jogador, título ou história será inventado.

## Detalhes técnicos
- Migração com `GRANT`, RLS e políticas coerentes para leitura pública dos dados editoriais e escrita apenas privilegiada.
- Funções de importação permanecem no servidor; credenciais nunca chegam ao navegador.
- Painéis consultam dados enriquecidos por função segura, com fallback para os dados locais da carreira.
