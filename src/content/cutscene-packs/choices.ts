/** choices cutscenes: authored narrative content only. */
import { scene, type Cutscene } from "../cutscene-types";

export const choicesScenes: Record<string, Cutscene> = {
  /* ------------------------------------------------ escolhas (jogáveis) */
  "agent-demands": scene("agent-demands", "O empresário liga", "office", [
    {
      id: "agent-demands.line.001",
      who: "narrator",
      text: "Terça-feira, 8h. O empresário do seu craque quer renovação — e quer hoje.",
    },
    {
      id: "agent-demands.line.002",
      who: "agent",
      text: "Meu cliente tem proposta de fora. Ou melhora o salário, ou ele sai em janeiro.",
    },
    {
      id: "agent-demands.line.003",
      who: "manager",
      text: "Você segura o telefone e pensa. O que responde?",
      choices: [
        {
          id: "agent-demands.choice.01",
          label: "Prometer renovação",
          hint: "Moral do craque sobe, diretoria cobra a conta",
          response: [
            {
              id: "agent-demands.line.004",
              who: "manager",
              text: "Diz a ele que renovamos. Salário de estrela para quem decide jogo.",
            },
            {
              id: "agent-demands.line.005",
              who: "agent",
              text: "Palavra de treinador vale ouro. Vou segurar as outras propostas.",
            },
          ],
          effect: { morale: 6, approval: -4, headline: "Treinador promete renovação do craque" },
        },
        {
          id: "agent-demands.choice.02",
          label: "Peitar o empresário",
          hint: "Mostra autoridade, mas o jogador pode azedar",
          response: [
            {
              id: "agent-demands.line.006",
              who: "manager",
              text: "Contrato se cumpre jogando. Diz a ele que o campo resolve tudo.",
            },
            {
              id: "agent-demands.line.007",
              who: "agent",
              text: "Veremos no campo, então. E na janela também.",
            },
          ],
          effect: { morale: -5, approval: 4, headline: "Treinador peita empresário do craque" },
        },
      ],
    },
  ]),
  "unhappy-knock": scene("unhappy-knock", "Batida na porta", "dressing", [
    {
      id: "unhappy-knock.line.001",
      who: "narrator",
      text: "Depois do treino, o reserva mais caro do elenco bate na sua porta.",
    },
    {
      id: "unhappy-knock.line.002",
      who: "captain",
      text: "Professor, preciso jogar. Do jeito que está, peço para sair.",
    },
    {
      id: "unhappy-knock.line.003",
      who: "manager",
      text: "O olhar dele é sério. Como você conduz?",
      choices: [
        {
          id: "unhappy-knock.choice.01",
          label: "Garantir minutos",
          hint: "Ele rende mais — mas vai cobrar",
          response: [
            {
              id: "unhappy-knock.line.004",
              who: "manager",
              text: "Você vai jogar. Trabalha que a vaga aparece já no próximo jogo.",
            },
            {
              id: "unhappy-knock.line.005",
              who: "captain",
              text: "É tudo que eu precisava ouvir. Não vou desperdiçar.",
            },
          ],
          effect: { morale: 8, pressure: 3, headline: "Reserva ganha promessa de minutos" },
        },
        {
          id: "unhappy-knock.choice.02",
          label: "Bancar a hierarquia",
          hint: "Grupo entende, ele nem tanto",
          response: [
            {
              id: "unhappy-knock.line.006",
              who: "manager",
              text: "Aqui ninguém tem vaga cativa. Nem você, nem eu. Mostra no treino.",
            },
            { id: "unhappy-knock.line.007", who: "captain", text: "...Entendido, professor." },
          ],
          effect: { morale: -4, approval: 3, headline: "Treinador banca hierarquia no elenco" },
        },
      ],
    },
  ]),
  "derby-eve-talk": scene("derby-eve-talk", "Véspera de clássico", "dressing", [
    {
      id: "derby-eve-talk.line.001",
      who: "narrator",
      text: "Véspera de clássico. O vestiário ferve antes mesmo da preleção.",
    },
    {
      id: "derby-eve-talk.line.002",
      who: "captain",
      text: "A cidade parou por esse jogo. O que a gente fala pra eles, professor?",
    },
    {
      id: "derby-eve-talk.line.003",
      who: "manager",
      text: "Câmeras da TV do clube gravando. Escolha o tom:",
      choices: [
        {
          id: "derby-eve-talk.choice.01",
          label: "Provocar o rival",
          hint: "Torcida vai à loucura, pressão dobra",
          response: [
            {
              id: "derby-eve-talk.line.004",
              who: "manager",
              text: "Diz pra eles virem buscar. Na nossa casa, clássico tem dono.",
            },
            { id: "derby-eve-talk.line.005", who: "fan", text: "É ISSO! PRA CIMA DELES!" },
          ],
          effect: {
            fanApproval: 8,
            pressure: 6,
            morale: 3,
            headline: "Treinador provoca rival em clássico",
          },
        },
        {
          id: "derby-eve-talk.choice.02",
          label: "Pregar respeito",
          hint: "Seguro e profissional",
          response: [
            {
              id: "derby-eve-talk.line.006",
              who: "manager",
              text: "Respeito máximo, medo zero. Clássico se ganha no detalhe.",
            },
            {
              id: "derby-eve-talk.line.007",
              who: "captain",
              text: "No detalhe. Todo mundo ligado do primeiro ao último minuto.",
            },
          ],
          effect: {
            morale: 4,
            approval: 3,
            headline: "Treinador prega respeito antes do clássico",
          },
        },
      ],
    },
  ]),
  "doctor-gamble": scene("doctor-gamble", "O médico avisa", "medical", [
    {
      id: "doctor-gamble.line.001",
      who: "narrator",
      text: "O departamento médico chama você no corredor, cara fechada.",
    },
    {
      id: "doctor-gamble.line.002",
      who: "doctor",
      text: "O craque está a 70%. Se jogar, pode estourar. A decisão é sua.",
    },
    {
      id: "doctor-gamble.line.003",
      who: "manager",
      text: "Jogo grande amanhã. Você arrisca?",
      choices: [
        {
          id: "doctor-gamble.choice.01",
          label: "Poupar o craque",
          hint: "Seguro: ele volta 100%, time sente falta",
          response: [
            {
              id: "doctor-gamble.line.004",
              who: "manager",
              text: "Saúde primeiro. Ninguém ganha temporada em um jogo.",
            },
            {
              id: "doctor-gamble.line.005",
              who: "doctor",
              text: "Decisão correta. Em dez dias ele está voando.",
            },
          ],
          effect: { morale: 2, fanApproval: -3, headline: "Craque é poupado por precaução" },
        },
        {
          id: "doctor-gamble.choice.02",
          label: "Arriscar tudo",
          hint: "Ou herói, ou vilão",
          response: [
            {
              id: "doctor-gamble.line.006",
              who: "manager",
              text: "Infiltra, enfaixa e manda pra campo. Decisão se ganha com os melhores.",
            },
            {
              id: "doctor-gamble.line.007",
              who: "doctor",
              text: "Registrado: contra indicação médica. Boa sorte pra nós dois.",
            },
          ],
          effect: { morale: 5, pressure: 5, condition: -4, headline: "Craque joga no sacrifício" },
        },
      ],
    },
  ]),
  "president-call": scene("president-call", "Ligação do presidente", "board", [
    {
      id: "president-call.line.001",
      who: "narrator",
      text: "O telefone toca depois do jantar. É o presidente. Nunca é papo bom.",
    },
    {
      id: "president-call.line.002",
      who: "president",
      text: "O conselho quer resposta. Me diz: o título ainda é possível?",
    },
    {
      id: "president-call.line.003",
      who: "manager",
      text: "Respire fundo. O que você promete?",
      choices: [
        {
          id: "president-call.choice.01",
          label: "Prometer o título",
          hint: "Compra tempo — e uma corda",
          response: [
            {
              id: "president-call.line.004",
              who: "manager",
              text: "É possível. E eu vou entregar. Pode cobrar.",
            },
            {
              id: "president-call.line.005",
              who: "president",
              text: "Anotado. O conselho vai cobrar cada palavra.",
            },
          ],
          effect: { approval: 8, pressure: 8, headline: "Treinador promete título ao conselho" },
        },
        {
          id: "president-call.choice.02",
          label: "Pedir paciência",
          hint: "Honesto, mas o crédito cai",
          response: [
            {
              id: "president-call.line.006",
              who: "manager",
              text: "Título se constrói. Me dê a temporada e eu devolvo um time.",
            },
            {
              id: "president-call.line.007",
              who: "president",
              text: "Paciência tem prazo. Não me faça arrepender.",
            },
          ],
          effect: { approval: -5, pressure: -4, headline: "Treinador pede paciência à diretoria" },
        },
      ],
    },
  ]),
};
