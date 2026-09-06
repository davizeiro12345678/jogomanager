import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { AiError, callGemini } from "@/lib/ai.server";

const BREVITY = "Responda sempre em português do Brasil, em prosa corrida, com no máximo ~120 palavras. Seja direto e objetivo.";

function wrap<T>(fn: () => Promise<T>) {
  return fn().catch((err) => {
    if (err instanceof AiError) {
      throw new Error(err.message);
    }
    throw new Error("A IA não conseguiu responder agora. Tente novamente.");
  });
}

/* ---------------------------------------------------------- diretor esportivo */

const jogadorResumoSchema = z.object({
  nome: z.string(),
  pos: z.string(),
  ovr: z.number(),
  idade: z.number(),
  moral: z.number().optional(),
  forma: z.number().optional(),
  lesionado: z.boolean().optional(),
});

const diretorEsportivoSchema = z.object({
  clube: z.string(),
  formacao: z.string(),
  objetivo: z.number(),
  posicaoAtual: z.number(),
  orcamento: z.number(),
  jogadores: z.array(jogadorResumoSchema).max(30),
});

export const diretorEsportivo = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof diretorEsportivoSchema>) => diretorEsportivoSchema.parse(input))
  .handler(async ({ data }) =>
    wrap(async () => {
      const system =
        `Você é o diretor esportivo de um clube de futebol em um jogo de gestão. ` +
        `Analise o elenco, aponte pontos fracos por posição e defina 2-3 prioridades de mercado. ${BREVITY}`;
      const user = JSON.stringify(data);
      return callGemini(system, user);
    }),
  );

/* ---------------------------------------------------------- olheiro */

const alvoSchema = z.object({
  nome: z.string(),
  pos: z.string(),
  ovr: z.number(),
  potencial: z.number().optional(),
  idade: z.number(),
  valor: z.number(),
  clube: z.string().optional(),
});

const olheiroSchema = z.object({
  alvos: z.array(alvoSchema).max(15),
  necessidade: z.string().optional(),
});

export const olheiro = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof olheiroSchema>) => olheiroSchema.parse(input))
  .handler(async ({ data }) =>
    wrap(async () => {
      const system =
        `Você é um olheiro experiente de futebol. A partir da lista de alvos recebida, ` +
        `aponte quais valem a pena contratar e por quê, considerando custo-benefício. ${BREVITY}`;
      const user = JSON.stringify(data);
      return callGemini(system, user);
    }),
  );

/* ---------------------------------------------------------- jornalista */

const jornalistaSchema = z.object({
  clube: z.string(),
  temporada: z.number(),
  rodada: z.number(),
  posicaoTabela: z.number(),
  pontos: z.number(),
  sequencia: z.number(),
  ultimoResultado: z.string().optional(),
});

export const jornalista = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof jornalistaSchema>) => jornalistaSchema.parse(input))
  .handler(async ({ data }) =>
    wrap(async () => {
      const system =
        `Você é um jornalista esportivo brasileiro. Escreva uma notícia curta e envolvente ` +
        `sobre a situação atual do clube na rodada/temporada, em tom de reportagem. ${BREVITY}`;
      const user = JSON.stringify(data);
      return callGemini(system, user);
    }),
  );

/* ---------------------------------------------------------- assistente tático */

const assistenteTaticoSchema = z.object({
  clube: z.string(),
  formacaoAtual: z.string(),
  mandante: z.boolean(),
  adversario: z.object({ nome: z.string(), forca: z.number() }),
  elencoResumo: z.string(),
});

export const assistenteTatico = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof assistenteTaticoSchema>) => assistenteTaticoSchema.parse(input))
  .handler(async ({ data }) =>
    wrap(async () => {
      const system =
        `Você é o assistente técnico de um clube de futebol. Sugira formação e instruções táticas ` +
        `(mentalidade, pressão, largura, ritmo) para o próximo jogo contra o adversário informado. ${BREVITY}`;
      const user = JSON.stringify(data);
      return callGemini(system, user);
    }),
  );

/* ---------------------------------------------------------- coletiva de imprensa */

const coletivaSchema = z.object({
  personalidade: z.string(),
  pergunta: z.string().min(1).max(400),
  contexto: z.object({
    clube: z.string(),
    posicaoTabela: z.number(),
    resultadoRecente: z.string().optional(),
  }),
});

export const coletiva = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof coletivaSchema>) => coletivaSchema.parse(input))
  .handler(async ({ data }) =>
    wrap(async () => {
      const system =
        `Você é o técnico de futebol do clube, com personalidade "${data.personalidade}". ` +
        `Responda à pergunta de um jornalista na coletiva de imprensa mantendo esse tom. ${BREVITY}`;
      const user = JSON.stringify(data);
      return callGemini(system, user);
    }),
  );

/* ---------------------------------------------------------- chat livre */

const mensagemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().max(1000),
});

const chatIASchema = z.object({
  resumoCarreira: z.string().max(2000),
  mensagens: z.array(mensagemSchema).max(20),
});

export const chatIA = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof chatIASchema>) => chatIASchema.parse(input))
  .handler(async ({ data }) =>
    wrap(async () => {
      const system =
        `Você é o assistente de IA de um jogo de gestão de futebol, conversando com o treinador ` +
        `sobre a carreira dele. Use o resumo da carreira como contexto. ${BREVITY}\n` +
        `Resumo da carreira: ${data.resumoCarreira}`;
      const history = data.mensagens
        .map((m) => `${m.role === "user" ? "Treinador" : "Assistente"}: ${m.text}`)
        .join("\n");
      return callGemini(system, history);
    }),
  );
