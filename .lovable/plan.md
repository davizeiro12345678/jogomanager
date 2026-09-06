# Salto de realismo: estádio, campo, jogadores, torcida e cinema

Continuação direta do trabalho já feito (arquibancadas de concreto, cadeiras em mosaico, LED contínuo, torcida com ombros/cabelo). Meta desta fase: **59 melhorias gráficas novas** e cerca de **3.880 linhas de código novas**, distribuídas nos módulos abaixo.

## Orçamento de código (~3.880 linhas)

| Área | Arquivos | Linhas |
| --- | --- | --- |
| Campo e texturas de gramado | `stadium/Pitch.tsx`, `textures/grass.ts`, `textures/wear.ts`, `GrassTufts.tsx` | ~780 |
| Estrutura do estádio | `stadium/Structure.tsx`, `Roof.tsx`, `Props.tsx`, `textures/metal.ts` | ~700 |
| Torcida | `stadium/Crowd.tsx`, `CrowdFlags.tsx`, `textures/tifo.ts` | ~560 |
| Jogadores | `players/PlayerRig.tsx`, `players/geometry.ts`, `players/kit-textures.ts` | ~820 |
| Iluminação e pós-processamento | `stadium/Lighting.tsx`, `post/PostFX.tsx`, `post/presets.ts` | ~470 |
| Cutscenes | `Cutscene.tsx`, `content/cutscenes.ts` | ~350 |
| Correções e validação | vários | ~200 |

## As 59 melhorias

### Campo (1–12)
1. Mapa de desgaste por zona (grande área, círculo central, laterais).
2. Manchas de lama e terra exposta com semente fixa.
3. Micro-fibras de grama no albedo em alta resolução.
4. Faixas de corte com variação de altura por passada do cortador.
5. Mapa normal de grama com relevo real por fibra.
6. Mapa de rugosidade acompanhando o desgaste.
7. Brilho úmido rasante dependente do ângulo da luz.
8. Tufos de grama 3D instanciados só perto da câmera.
9. Vento leve nos tufos, com rajadas.
10. Cal com borda imperfeita e apagamento em zonas de tráfego.
11. Marcas de deslize e pegadas acumuladas durante a partida.
12. Borda do gramado com sarjeta, dreno e faixa de saibro.

### Estádio (13–26)
13. Cobertura com treliça metálica visível.
14. Calhas, tirantes e cabos de sustentação.
15. Sombra da cobertura projetada sobre os primeiros anéis.
16. Corredores separando setores, com grades.
17. Escadas rentes à arquibancada (sem invadir o campo).
18. Túnel dos jogadores com boca iluminada.
19. Bancos de reservas com cobertura acrílica e assentos.
20. Manchas de umidade e escorrido no concreto.
21. Textura metálica para grades e estruturas.
22. Telão com placar, relógio e escudos ao vivo.
23. Cabines de imprensa e camarotes no anel superior.
24. Câmeras de TV e operadores nas laterais.
25. Portões, catracas e sinalização de setor.
26. Anel superior com público mais rarefeito e vazios realistas.

### Torcida (27–36)
27. Bandeirões grandes com ondulação no shader.
28. Faixas horizontais com texto de torcida.
29. Mosaico de cartolinas por setor, formando padrão do clube.
30. Ola com propagação circular (não linear).
31. Comemoração de gol com pulos escalonados por distância do gol.
32. Mistura de torcedores sentados e de pé.
33. Densidade menor nos setores neutros e visitantes.
34. Cachecóis erguidos em momentos de canto.
35. Flashes de câmera mais realistas à noite.
36. Fumaça/sinalizador ocasional atrás dos gols.

### Jogadores (37–48)
37. Tronco anatômico com ombros, peito e cintura.
38. Pescoço e cabeça com proporção correta.
39. Panturrilha e coxa modeladas separadamente.
40. Gola e mangas do uniforme como geometria.
41. Número nas costas e escudo no peito.
42. Meião, caneleira e chuteira separados.
43. Volumes de cabelo variados e tons de pele ampliados.
44. Sombra de contato colada ao pé.
45. Brilho de suor no nível de detalhe mais próximo.
46. Tecido com leve reflexo anisotrópico.
47. Três níveis de detalhe revisados por distância.
48. Goleiro com uniforme e luvas próprias.

### Iluminação e pós-processamento (49–55)
49. Refletores com halo volumétrico à noite.
50. Reflexo dos refletores no gramado úmido.
51. Oclusão de ambiente nas arquibancadas e sob os jogadores.
52. Foco seletivo (fundo desfocado) em replay e momentos dramáticos.
53. Correção de cor estilo transmissão, por horário.
54. Granulado, vinheta e aberração calibrados por preset.
55. Queda automática de efeitos quando a taxa de quadros cai, sem piscar.

### Cutscenes (56–59)
56. Camadas com paralaxe nas cenas.
57. Movimento lento de câmera e zoom sutil.
58. Iluminação por hora do dia dentro da cena.
59. Retrato do treinador reagindo com expressão e postura.

## Bugs e falhas a corrigir

- Texto duplicado/sobreposto nas placas de LED.
- Travas de jogada e bola presa em partida longa.
- Estados presos no fluxo de partida (pausa, replay, pular, fim de jogo).
- Avisos e erros de console durante partida e temporada automática.
- Temporada completa em automático sem erro.

## Notas técnicas

- Modularização de `Stadium3D.tsx` em `src/components/game/stadium/` (`Pitch`, `Goals`, `Structure`, `Roof`, `Crowd`, `Lighting`, `Props`), mantendo o pipeline atual e o memo do componente.
- Texturas geradas em canvas com cache global por sessão e semente fixa (determinístico entre recargas).
- Geometrias e materiais compartilhados; torcida, tufos e adereços via instanciação.
- `PostFX` recebe qualidade + momento; qualidade baixa continua sem efeitos.
- Validação: verificação de tipos limpa, captura em partida real e console sem erros antes de entregar.
