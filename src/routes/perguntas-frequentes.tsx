import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";
import { breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/perguntas-frequentes";
const TITLE = "Perguntas frequentes sobre o jogo | Pro Football Manager 3D: Jogo de Futebol Manager Online";
const DESC =
  "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.";

export const Route = createFileRoute("/perguntas-frequentes")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH }),
    links: canonical(PATH),
    scripts: [
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Perguntas frequentes", path: PATH },
      ]),
    ],
  }),
  component: Page,
});

const QA = [
  ["Preciso instalar alguma coisa?", "Não. O jogo roda no navegador, em computador ou celular."],
  ["É gratuito?", "Sim, todo o jogo é gratuito."],
  ["Preciso criar conta?", "Não. Jogando como convidado, a carreira fica salva no próprio aparelho. Criar conta é opcional e serve para salvar na nuvem e continuar em outro dispositivo."],
  ["Funciona no celular?", "Sim. Use o modo de qualidade mais leve para manter a partida em 3D fluida."],
  ["Posso pular as partidas?", "Pode. Você escolhe assistir aos 90 minutos em 3D ou simular o resultado na hora."],
  ["Quais campeonatos estão disponíveis?", "Mais de trinta ligas, incluindo Brasileirão Série A e B, Premier League, LaLiga, Serie A, Bundesliga, Ligue 1 e Liga Portugal."],
  ["Posso usar meus próprios clubes e jogadores?", "Pode. A página de cadastro permite criar clubes e jogadores com escudo, cores, posição, contrato e valor."],
  ["Dá para ser demitido?", "Dá. A diretoria define um objetivo de temporada e a pressão sobe com maus resultados; outros clubes também podem te procurar."],
];

function Page() {
  return (
    <div className="pitch-bg min-h-screen px-4 py-14">
      <div className="mx-auto max-w-3xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Dúvidas</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Perguntas frequentes
        </h1>

        <dl className="mt-8 space-y-6">
          {QA.map(([q, a]) => (
            <div key={q}>
              <dt className="font-display text-xl">{q}</dt>
              <dd className="mt-1 text-muted-foreground">{a}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10">
          <Link
            to="/new"
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground"
          >
            Começar a jogar
          </Link>
        </div>

        <PublicLinks exclude={PATH} />
      </div>
    </div>
  );
}
