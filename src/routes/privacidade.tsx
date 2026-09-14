import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";
import { CONTENT_UPDATED, SiteFooter } from "@/components/SiteFooter";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/privacidade";
const TITLE = "Política de privacidade · Pro Football Manager 3D";
const DESC =
  "Quais dados o Pro Football Manager 3D guarda, por quanto tempo, com quem são compartilhados e como pedir a exclusão da sua conta e da sua carreira.";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Política de privacidade", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Privacidade", path: PATH },
      ]),
    ],
  }),
  component: PrivacidadePage,
});

const BLOCKS: { title: string; body: string }[] = [
  {
    title: "O que guardamos",
    body: "Para jogar não é preciso criar conta: a carreira fica salva no próprio navegador. Quando você entra com e-mail ou com a conta Google, guardamos apenas o endereço de e-mail, o identificador da conta, o apelido de técnico que você escolher e os dados da sua carreira (clube, elenco, temporada, conquistas, carteira de moedas e compras).",
  },
  {
    title: "Por que guardamos",
    body: "Os dados existem para três finalidades: manter a carreira salva e sincronizada entre aparelhos, entregar as compras feitas na loja e evitar abusos no chat. Não vendemos dados, não fazemos perfis de publicidade e não exibimos anúncios.",
  },
  {
    title: "Quem processa junto com a gente",
    body: "A conta e o banco de dados ficam hospedados na infraestrutura do jogo (Supabase). Os pagamentos são processados pela Stripe, que recebe os dados do cartão diretamente — nós nunca vemos nem armazenamos número de cartão. A narração usa serviços de voz em nuvem, que recebem apenas o texto narrado, sem dados pessoais.",
  },
  {
    title: "Chat e moderação",
    body: "As mensagens do chat global ficam visíveis para quem está logado e guardam o apelido e o horário de envio. Você pode bloquear outro técnico, denunciar uma mensagem e apagar as suas próprias mensagens a qualquer momento. Denúncias são guardadas para análise e para impedir reincidência.",
  },
  {
    title: "Contas de menores",
    body: "Contas marcadas como supervisionadas têm o chat livre desligado até a autorização de um responsável e não coletam dados pessoais além do necessário para salvar a carreira. Nunca pedimos endereço, telefone ou documentos.",
  },
  {
    title: "Por quanto tempo",
    body: "Os dados da carreira ficam guardados enquanto a conta existir. Registros de compra são mantidos pelo prazo exigido pela legislação fiscal. Mensagens de chat são removidas depois de doze meses.",
  },
  {
    title: "Seus direitos",
    body: "Você pode pedir acesso, correção ou exclusão dos seus dados, além da exportação da carreira. Basta mandar o pedido pela página de contato, usando o mesmo e-mail cadastrado. Respondemos em até quinze dias.",
  },
  {
    title: "Cookies e armazenamento local",
    body: "Usamos armazenamento local do navegador para guardar a carreira, as preferências visuais e o idioma. Cookies são usados apenas para manter a sessão de login. Não há cookies de publicidade nem rastreamento entre sites.",
  },
];

function PrivacidadePage() {
  return (
    <div className="pitch-bg min-h-screen px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="text-xs uppercase tracking-widest text-primary">
          ← Início
        </Link>
        <h1 className="mt-3 font-display text-3xl uppercase tracking-wide sm:text-4xl">
          Política de privacidade
        </h1>
        <p className="mt-3 text-muted-foreground">
          Esta página explica, em linguagem simples, o que o Pro Football Manager 3D faz com os seus
          dados. Atualizada em{" "}
          <time dateTime={CONTENT_UPDATED}>14 de setembro de 2026</time>.
        </p>

        <div className="mt-8 space-y-6">
          {BLOCKS.map((b) => (
            <section key={b.title} className="surface-card rounded-xl border border-border/60 p-5">
              <h2 className="font-display text-lg uppercase tracking-wide">{b.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{b.body}</p>
            </section>
          ))}
        </div>

        <PublicLinks exclude={PATH} />
        <SiteFooter path={PATH} />
      </div>
    </div>
  );
}
