import { Link } from "@tanstack/react-router";

import { ConsentCenter, TrustBadges } from "@/components/privacy/ConsentCenter";

import { PublicLinks } from "@/components/PublicLinks";

import { SiteFooter } from "@/components/SiteFooter";
import { PRIVACIDADE_PATH as PATH } from "@/lib/public-route-paths";
import { useT } from "@/i18n/provider";
import { creatorMessages } from "@/i18n/creator-messages";

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
    title: "Pedidos de suporte",
    body: "Ao abrir um pedido, registramos a categoria, o título, o relato, o protocolo e o identificador da sua conta. O e-mail confirmado e o conteúdo do pedido são encaminhados ao serviço de atendimento configurado pelo responsável, com assinatura para validar a origem. O protocolo e o estado da entrega ficam no banco privado para evitar duplicidade e permitir novas tentativas. Não inclua senhas, códigos de acesso, documentos ou dados de cartão no relato. A exclusão da conta também exclui os pedidos armazenados no banco do jogo; mensagens já encaminhadas precisam ser tratadas pelo suporte.",
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

export function PrivacidadePage() {
  const { lang } = useT();
  const copy = creatorMessages(lang);
  return (
    <div className="pitch-bg min-h-dvh px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="text-xs uppercase tracking-widest text-primary">
          ← Início
        </Link>
        <h1 className="mt-3 font-display text-3xl uppercase tracking-wide sm:text-4xl">
          Política de privacidade
        </h1>
        <p className="mt-3 text-muted-foreground">
          Esta página explica, em linguagem simples, o que o Pro Football Manager 3D faz com os seus
          dados. Atualizada em <time dateTime="2026-11-08">{copy.updatedDate}</time>.
        </p>

        <div className="mt-6">
          <TrustBadges />
          <p className="mt-3 text-xs text-muted-foreground">
            Os dados completos do cartão são processados pela Stripe e não são armazenados pelo
            JogoManager.
          </p>
        </div>

        <div className="mt-8">
          <ConsentCenter />
        </div>

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
