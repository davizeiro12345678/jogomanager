/** season-moments cutscenes: authored narrative content only. */
import { scene, type Cutscene } from "../cutscene-types";

export const seasonMomentsScenes: Record<string, Cutscene> = {
  /* ------------------------------------------------ momentos de temporada */
  winstreak: scene(
    "winstreak",
    "Sequência de vitórias",
    "celebration",
    [
      {
        id: "winstreak.line.001",
        who: "narrator",
        text: "Três, quatro, cinco jogos. A cidade só fala do time.",
      },
      {
        id: "winstreak.line.002",
        who: "press",
        text: "É o melhor momento do clube em anos. Qual o segredo?",
      },
      {
        id: "winstreak.line.003",
        who: "manager",
        text: "Trabalho chato e repetido, todo dia, sem holofote.",
      },
    ],
    "good",
  ),
  comeback: scene(
    "comeback",
    "Virada histórica",
    "celebration",
    [
      {
        id: "comeback.line.001",
        who: "narrator",
        text: "Estava perdido. Terminou em festa nos últimos minutos.",
      },
      { id: "comeback.line.002", who: "captain", text: "Ninguém acreditou em nós, professor." },
      { id: "comeback.line.003", who: "manager", text: "Nós acreditamos. É o que importa." },
    ],
    "good",
  ),
  badloss: scene(
    "badloss",
    "Derrota dolorosa",
    "defeat",
    [
      {
        id: "badloss.line.001",
        who: "narrator",
        text: "Vestiário em silêncio. Só o barulho do chuveiro ao fundo.",
      },
      {
        id: "badloss.line.002",
        who: "manager",
        text: "A culpa é minha. A resposta é de todos nós, na próxima.",
      },
      { id: "badloss.line.003", who: "captain", text: "Vamos dar essa resposta." },
    ],
    "bad",
  ),
  sackrisk: scene(
    "sackrisk",
    "Reunião de emergência",
    "board",
    [
      {
        id: "sackrisk.line.001",
        who: "president",
        text: "Não posso segurar a pressão por muito mais tempo.",
      },
      {
        id: "sackrisk.line.002",
        who: "manager",
        text: "Me dê três jogos. Você vai ver outro time.",
      },
      { id: "sackrisk.line.003", who: "president", text: "Três. Nem um a mais." },
    ],
    "bad",
  ),
  promotion: scene(
    "promotion",
    "Acesso conquistado",
    "celebration",
    [
      {
        id: "promotion.line.001",
        who: "narrator",
        text: "Invasão de campo, bandeirões e o apito final mais longo do ano.",
      },
      { id: "promotion.line.002", who: "fan", text: "Subimos! Subimos!" },
      {
        id: "promotion.line.003",
        who: "manager",
        text: "Agora começa a parte difícil: se manter lá em cima.",
      },
    ],
    "good",
  ),
  farewell: scene(
    "farewell",
    "Despedida",
    "farewell",
    [
      {
        id: "farewell.line.001",
        who: "narrator",
        text: "Malas no corredor. O escudo fica; o treinador segue.",
      },
      {
        id: "farewell.line.002",
        who: "manager",
        text: "Obrigado por tudo. Este clube me ensinou mais do que eu ensinei.",
      },
      { id: "farewell.line.003", who: "fan", text: "Volte sempre, professor." },
    ],
    "bad",
  ),
  "cup-draw": scene("cup-draw", "Sorteio da copa", "board", [
    {
      id: "cup-draw.line.001",
      who: "narrator",
      text: "Bolinhas giram no globo de vidro. A sala inteira prende a respiração.",
    },
    {
      id: "cup-draw.line.002",
      who: "press",
      text: "E o adversário do seu time na próxima fase é...",
    },
    {
      id: "cup-draw.line.003",
      who: "manager",
      text: "Seja quem for, a gente estuda e enfrenta. Copa é jogo de detalhe.",
    },
    {
      id: "cup-draw.line.004",
      who: "assistant",
      text: "Já peço os vídeos dos últimos cinco jogos deles.",
    },
  ]),
  "press-defeat": scene(
    "press-defeat",
    "Coletiva após a derrota",
    "press",
    [
      {
        id: "press-defeat.line.001",
        who: "narrator",
        text: "Sala apertada, microfones ligados, ninguém sorrindo.",
      },
      {
        id: "press-defeat.line.002",
        who: "press",
        text: "O time não criou nada. O senhor errou a escalação?",
      },
      {
        id: "press-defeat.line.003",
        who: "manager",
        text: "A responsabilidade é minha. Amanhã cedo estamos no campo corrigindo.",
      },
      { id: "press-defeat.line.004", who: "press", text: "A diretoria te garantiu no cargo?" },
      {
        id: "press-defeat.line.005",
        who: "manager",
        text: "Meu emprego se garante ganhando. É o que pretendo fazer.",
      },
    ],
    "bad",
  ),
  renewal: scene(
    "renewal",
    "Renovação de contrato",
    "board",
    [
      {
        id: "renewal.line.001",
        who: "president",
        text: "O conselho aprovou por unanimidade. Queremos você por mais tempo.",
      },
      {
        id: "renewal.line.002",
        who: "manager",
        text: "Aceito — mas quero decidir as contratações da próxima janela.",
      },
      { id: "renewal.line.003", who: "president", text: "Fechado. Assine aqui e vamos brindar." },
      {
        id: "renewal.line.004",
        who: "narrator",
        text: "Flashes, aperto de mão e uma caneta que vale uma temporada inteira.",
      },
    ],
    "good",
  ),
  "idol-farewell": scene(
    "idol-farewell",
    "Despedida do ídolo",
    "farewell",
    [
      {
        id: "idol-farewell.line.001",
        who: "narrator",
        text: "Estádio cheio num amistoso de terça. Todos vieram por um homem só.",
      },
      {
        id: "idol-farewell.line.002",
        who: "captain",
        text: "Foram doze anos. Vou sentir falta do cheiro da grama molhada.",
      },
      { id: "idol-farewell.line.003", who: "fan", text: "Eterno! Eterno!" },
      {
        id: "idol-farewell.line.004",
        who: "manager",
        text: "A camisa sai de campo, mas a régua que ele deixou fica no vestiário.",
      },
    ],
    "good",
  ),
  "title-night": scene(
    "title-night",
    "Noite de título",
    "trophy",
    [
      {
        id: "title-night.line.001",
        who: "narrator",
        text: "Papel picado no ar, o gramado some debaixo da festa.",
      },
      {
        id: "title-night.line.002",
        who: "captain",
        text: "Professor, essa taça é sua também. Sobe aí com a gente.",
      },
      {
        id: "title-night.line.003",
        who: "manager",
        text: "É de todo mundo. Do roupeiro ao torcedor que veio na chuva.",
      },
      { id: "title-night.line.004", who: "fan", text: "Campeão! Campeão!" },
      {
        id: "title-night.line.005",
        who: "narrator",
        text: "A taça sobe. A cidade não dorme hoje.",
      },
    ],
    "good",
  ),
  "derby-week": scene("derby-week", "Semana de clássico", "dressing", [
    {
      id: "derby-week.line.001",
      who: "narrator",
      text: "A cidade amanheceu dividida. Bandeiras nas janelas, faixas nos postes.",
    },
    { id: "derby-week.line.002", who: "captain", text: "Professor, esse aqui vale por três." },
    {
      id: "derby-week.line.003",
      who: "manager",
      text: "Vale por um. Mas jogamos como se valesse a temporada inteira.",
    },
    {
      id: "derby-week.line.004",
      who: "assistant",
      text: "Marcação individual nas bolas paradas. Eles vivem disso.",
    },
  ]),
  "youth-debut": scene(
    "youth-debut",
    "Estreia do garoto da base",
    "tunnel",
    [
      {
        id: "youth-debut.line.001",
        who: "scout",
        text: "Ele treina com o profissional desde os quinze. Está pronto.",
      },
      {
        id: "youth-debut.line.002",
        who: "manager",
        text: "Garoto, joga do teu jeito. Se errar, o erro é meu.",
      },
      {
        id: "youth-debut.line.003",
        who: "narrator",
        text: "O número dele aparece na quarta placa. O estádio levanta.",
      },
    ],
    "good",
  ),
};
