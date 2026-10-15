/** story-arc cutscenes: authored narrative content only. */
import { scene, type Cutscene } from "../cutscene-types";

export const storyArcScenes: Record<string, Cutscene> = {
  /* --------------------------------- arco de história (sorteio contextual) */
  "season-kickoff": scene("season-kickoff", "Abertura da temporada", "arrival", [
    {
      id: "season-kickoff.line.001",
      who: "narrator",
      text: "Primeira segunda de temporada. Tabela nova colada na parede do vestiário.",
    },
    {
      id: "season-kickoff.line.002",
      who: "president",
      text: "O orçamento está aprovado, o elenco é esse. A meta é uma só: brigar lá em cima.",
    },
    {
      id: "season-kickoff.line.003",
      who: "manager",
      text: "Meu grupo vai correr por cada ponto. Começa hoje, sem desculpa.",
    },
    {
      id: "season-kickoff.line.004",
      who: "captain",
      text: "Professor, o elenco está com você. A gente entra junto e sai junto.",
    },
    {
      id: "season-kickoff.line.005",
      who: "narrator",
      text: "O apito da primeira rodada ainda nem soou — e a cidade já sonha.",
    },
  ]),
  "crisis-meeting": scene(
    "crisis-meeting",
    "Sequência sem vencer",
    "board",
    [
      {
        id: "crisis-meeting.line.001",
        who: "narrator",
        text: "Quatro jogos sem vitória. O corredor da diretoria anda mais silencioso que o normal.",
      },
      {
        id: "crisis-meeting.line.002",
        who: "president",
        text: "A torcida está inquieta e eu também. O que está acontecendo lá dentro?",
      },
      {
        id: "crisis-meeting.line.003",
        who: "manager",
        text: "O modelo está certo, a execução oscila. Peço paciência e um ajuste no elenco.",
      },
      {
        id: "crisis-meeting.line.004",
        who: "president",
        text: "Paciência custa pontos. Me mostra reação nos próximos dois jogos.",
      },
      {
        id: "crisis-meeting.line.005",
        who: "narrator",
        text: "O telefone do presidente não para. A próxima rodada decide o clima.",
      },
    ],
    "bad",
  ),
  ultimatum: scene(
    "ultimatum",
    "O ultimato",
    "board",
    [
      {
        id: "ultimatum.line.001",
        who: "narrator",
        text: "Reunião marcada às pressas. Na mesa, só água e uma planilha de resultados.",
      },
      {
        id: "ultimatum.line.002",
        who: "president",
        text: "Não vou fingir: seu cargo está em risco. Três jogos. É o que consigo segurar.",
      },
      {
        id: "ultimatum.line.003",
        who: "manager",
        text: "Três jogos bastam. Vou te devolver um time que convence, não só que vence.",
      },
      {
        id: "ultimatum.line.004",
        who: "president",
        text: "Quero vencer. O resto a gente discute depois.",
      },
      {
        id: "ultimatum.line.005",
        who: "narrator",
        text: "Saindo da sala, uma certeza: derrota agora custa o emprego.",
      },
    ],
    "bad",
  ),
  "captain-split": scene(
    "captain-split",
    "Racha no vestiário",
    "dressing",
    [
      {
        id: "captain-split.line.001",
        who: "narrator",
        text: "O treino termina cedo. O capitão pede a palavra — e não é para falar de tática.",
      },
      {
        id: "captain-split.line.002",
        who: "captain",
        text: "Com todo respeito, professor: o grupo não aguenta mais treinar uma coisa e jogar outra.",
      },
      {
        id: "captain-split.line.003",
        who: "manager",
        text: "Fala na minha cara, então. O que você quer que mude?",
      },
      {
        id: "captain-split.line.004",
        who: "captain",
        text: "Menos rodízio, mais cobrança de quem erra. Hierarquia se conquista, mas se mantém.",
      },
      {
        id: "captain-split.line.005",
        who: "assistant",
        text: "Ele fala por metade. A outra metade acha que ele exagera. Você decide.",
      },
    ],
    "bad",
  ),
  "dressing-unity": scene(
    "dressing-unity",
    "O grupo se fecha",
    "dressing",
    [
      {
        id: "dressing-unity.line.001",
        who: "narrator",
        text: "Porta trancada, celulares fora. Só o grupo, uma bola e a verdade.",
      },
      {
        id: "dressing-unity.line.002",
        who: "captain",
        text: "Daqui pra frente, erro meu é erro nosso. Ninguém joga sozinho.",
      },
      {
        id: "dressing-unity.line.003",
        who: "manager",
        text: "Se é pra cair, cai junto. Se é pra subir, sobe junto. Fechado?",
      },
      {
        id: "dressing-unity.line.004",
        who: "fan",
        text: "De fora dá pra ouvir: um grito só, quarenta vozes ao mesmo tempo.",
      },
      {
        id: "dressing-unity.line.005",
        who: "narrator",
        text: "Times assim não precisam de discurso. Precisam de resultado.",
      },
    ],
    "good",
  ),
  "mind-games": scene("mind-games", "Guerra de palavras", "press", [
    {
      id: "mind-games.line.001",
      who: "press",
      text: "O técnico rival disse que seu time só sabe se defender. Como responde?",
    },
    {
      id: "mind-games.line.002",
      who: "manager",
      text: "Eu respondo sábado, em campo, com a bola rolando. Provocação não marca gol.",
    },
    { id: "mind-games.line.003", who: "press", text: "Mas a torcida quer uma resposta agora..." },
    {
      id: "mind-games.line.004",
      who: "manager",
      text: "A torcida quer vitória. E é isso que vou dar.",
    },
    {
      id: "mind-games.line.005",
      who: "narrator",
      text: "A manchete sai mesmo assim. O clássico ganha mais um capítulo.",
    },
  ]),
  "captain-injury": scene(
    "captain-injury",
    "O capitão cai",
    "medical",
    [
      {
        id: "captain-injury.line.001",
        who: "narrator",
        text: "Ele torce o joelho sozinho, sem contato. O estádio inteiro percebe na hora.",
      },
      {
        id: "captain-injury.line.002",
        who: "doctor",
        text: "Não é o pior cenário, mas são oito semanas fora. No mínimo.",
      },
      {
        id: "captain-injury.line.003",
        who: "manager",
        text: "A braçadeira passa pro vice. E o grupo joga por ele até voltar.",
      },
      {
        id: "captain-injury.line.004",
        who: "captain",
        text: "Promete uma coisa, professor: quando eu voltar, esse time está melhor.",
      },
    ],
    "bad",
  ),
  "academy-gem": scene(
    "academy-gem",
    "Joia da base",
    "staff",
    [
      {
        id: "academy-gem.line.001",
        who: "scout",
        text: "Dezesseis anos, dois pés bons e cabeça de veterano. Nunca vi nada igual.",
      },
      {
        id: "academy-gem.line.002",
        who: "assistant",
        text: "Tem corpo pra profissional? Ou vamos queimar o garoto?",
      },
      {
        id: "academy-gem.line.003",
        who: "manager",
        text: "Minutos controlados, proteção da comissão e paciência. Joia não se apressa.",
      },
      {
        id: "academy-gem.line.004",
        who: "narrator",
        text: "Na saída, o garoto olha o gramado principal como quem vê o futuro.",
      },
    ],
    "good",
  ),
  "transfer-saga": scene(
    "transfer-saga",
    "A novela da janela",
    "transfer",
    [
      {
        id: "transfer-saga.line.001",
        who: "agent",
        text: "O clube grande voltou com oferta maior. Meu jogador quer ouvir. Hoje.",
      },
      {
        id: "transfer-saga.line.002",
        who: "manager",
        text: "Ofertas chegam na diretoria. Quem decide se o time precisa dele sou eu.",
      },
      {
        id: "transfer-saga.line.003",
        who: "president",
        text: "O valor é tentador, mas cair de rendimento custa mais que qualquer venda.",
      },
      {
        id: "transfer-saga.line.004",
        who: "manager",
        text: "Segurem ele até dezembro. Depois, se for bom pros dois lados, a gente conversa.",
      },
      {
        id: "transfer-saga.line.005",
        who: "narrator",
        text: "A janela fecha em dias. O telefone não para de tocar.",
      },
    ],
    "neutral",
  ),
  "deadline-day": scene("deadline-day", "Último dia da janela", "transfer", [
    {
      id: "deadline-day.line.001",
      who: "narrator",
      text: "Relógio na parede, contratos espalhados e três telefones tocando juntos.",
    },
    {
      id: "deadline-day.line.002",
      who: "agent",
      text: "Faltam duas horas. Assina agora ou ele vai pro rival.",
    },
    {
      id: "deadline-day.line.003",
      who: "manager",
      text: "Anda, presidente. Quem contrata em pânico contrata errado — mas não contratar é pior.",
    },
    {
      id: "deadline-day.line.004",
      who: "president",
      text: "Fechado. O fax já saiu. Agora é com ele.",
    },
    {
      id: "deadline-day.line.005",
      who: "narrator",
      text: "Janela fechada. O elenco que você tem é o elenco que te leva até o fim.",
    },
  ]),
  "cup-final-eve": scene("cup-final-eve", "Véspera de decisão", "dressing", [
    {
      id: "cup-final-eve.line.001",
      who: "narrator",
      text: "Hotel silencioso, luzes apagadas cedo. Amanhã é o jogo do ano.",
    },
    {
      id: "cup-final-eve.line.002",
      who: "captain",
      text: "Ninguém aqui chegou até aqui por acaso, professor.",
    },
    {
      id: "cup-final-eve.line.003",
      who: "manager",
      text: "Durmam. Decisão se ganha descansado, não nervoso.",
    },
    {
      id: "cup-final-eve.line.004",
      who: "narrator",
      text: "O capitão fica mais dez minutos olhando a taça na propaganda da TV.",
    },
  ]),
  "relegation-fight": scene(
    "relegation-fight",
    "Luta contra a queda",
    "tactics",
    [
      {
        id: "relegation-fight.line.001",
        who: "narrator",
        text: "A tabela mostra o time na zona. O quadro tático, a saída.",
      },
      {
        id: "relegation-fight.line.002",
        who: "assistant",
        text: "Seis pontos em disputa. Precisamos de quatro. Os dois próximos são em casa.",
      },
      {
        id: "relegation-fight.line.003",
        who: "manager",
        text: "Em casa a gente ataca, fora a gente morde. Cada ponto é uma final.",
      },
      { id: "relegation-fight.line.004", who: "captain", text: "Pode contar. Esse grupo não cai." },
    ],
    "bad",
  ),
  "sacking-night": scene(
    "sacking-night",
    "A demissão",
    "farewell",
    [
      {
        id: "sacking-night.line.001",
        who: "narrator",
        text: "Nota oficial no site, à meia-noite. Duas linhas e um agradecimento frio.",
      },
      {
        id: "sacking-night.line.002",
        who: "president",
        text: "A decisão está tomada. Nada pessoal — é futebol, é resultado.",
      },
      {
        id: "sacking-night.line.003",
        who: "manager",
        text: "Saio de cabeça erguida. Dei tudo que tinha, todos os dias.",
      },
      {
        id: "sacking-night.line.004",
        who: "fan",
        text: "Na porta do CT, um grupo pequeno aplaude. Poucos, mas sinceros.",
      },
      { id: "sacking-night.line.005", who: "narrator", text: "O ciclo termina. A carreira, não." },
    ],
    "bad",
  ),
  "job-interview": scene("job-interview", "Entrevista de emprego", "board", [
    { id: "job-interview.line.001", who: "president", text: "Por que você, e por que agora?" },
    {
      id: "job-interview.line.002",
      who: "manager",
      text: "Porque eu monto time que compete todo jogo. Me dê o elenco e a janela.",
    },
    {
      id: "job-interview.line.003",
      who: "president",
      text: "A torcida aqui é exigente. E a paciência, curta.",
    },
    {
      id: "job-interview.line.004",
      who: "manager",
      text: "Paciência se conquista com vitória. Vitória se conquista com trabalho.",
    },
  ]),
  "rebuild-day-one": scene(
    "rebuild-day-one",
    "Primeiro dia da reconstrução",
    "arrival",
    [
      {
        id: "rebuild-day-one.line.001",
        who: "narrator",
        text: "Outros portões, outro escudo, a mesma vontade.",
      },
      {
        id: "rebuild-day-one.line.002",
        who: "captain",
        text: "Bem-vindo, professor. O grupo precisava de alguém com a sua história.",
      },
      {
        id: "rebuild-day-one.line.003",
        who: "manager",
        text: "História eu deixo na porta. Aqui começa tudo do zero, com vocês.",
      },
      {
        id: "rebuild-day-one.line.004",
        who: "narrator",
        text: "O primeiro treino começa em uma hora. A nova era, agora.",
      },
    ],
    "good",
  ),
  "legend-retirement": scene(
    "legend-retirement",
    "Aposentadoria do ídolo",
    "farewell",
    [
      {
        id: "legend-retirement.line.001",
        who: "narrator",
        text: "Última volta no gramado, chuteiras na mão, camisa suada pela última vez.",
      },
      {
        id: "legend-retirement.line.002",
        who: "captain",
        text: "Vinte anos atrás eu entrei aqui garoto. Saio homem feito por este clube.",
      },
      {
        id: "legend-retirement.line.003",
        who: "fan",
        text: "O nome dele ecoa por dez minutos sem parar.",
      },
      {
        id: "legend-retirement.line.004",
        who: "manager",
        text: "Camisa aposentada? Não. Ela espera o próximo que merecê-la tanto quanto ele.",
      },
      {
        id: "legend-retirement.line.005",
        who: "narrator",
        text: "Lendas não se despedem. Viram estátua.",
      },
    ],
    "good",
  ),
};
