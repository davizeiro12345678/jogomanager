import { createFileRoute, Link } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/jogar-offline";
const TITLE = "Como jogar offline e salvar a carreira | JogoManager";
const DESC =
  "Entenda o que funciona offline no JogoManager, onde a carreira fica salva e como conferir a sincronização antes de trocar de aparelho ou limpar dados.";

export const Route = createFileRoute("/jogar-offline")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Como jogar offline", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Jogar offline", path: PATH },
      ]),
    ],
  }),
  component: OfflinePage,
});

function OfflinePage() {
  return (
    <ArticleShell
      kicker="Offline"
      title="Como continuar sua carreira sem conexão"
      intro="O JogoManager guarda primeiro o progresso da carreira no armazenamento do navegador e oferece suporte offline depois que os recursos necessários foram carregados. Veja como conferir o estado do save e quais cuidados tomar antes de ficar sem internet."
      path={PATH}
      readMinutes={6}
      level="Iniciante"
      updated="outubro de 2026"
      toc={[
        { id: "offline", title: "O que significa jogar offline" },
        { id: "save", title: "Onde a carreira fica salva" },
        { id: "preparar", title: "Prepare o jogo antes de se desconectar" },
        { id: "sincronizar", title: "Confira a sincronização ao voltar" },
        { id: "conexao", title: "O que ainda depende da internet" },
      ]}
    >
      <Section id="offline" title="O que significa jogar offline">
        <p>
          Depois de abrir o jogo com conexão, o navegador pode guardar a tela offline e os recursos
          que já carregou. A disponibilidade depende do navegador, do espaço de armazenamento e dos
          arquivos usados pela tela que você quer abrir. Uma primeira visita ou um recurso que ainda
          não foi baixado pode precisar de internet.
        </p>
        <p>
          A carreira salva localmente pode continuar sem conexão enquanto o aplicativo e os recursos
          necessários estão disponíveis no aparelho. Se uma tela informar que precisa reconectar,
          aguarde o retorno da internet antes de usar aquela ação.
        </p>
      </Section>
      <Section id="save" title="Onde a carreira fica salva">
        <p>
          Cada alteração da carreira é gravada primeiro no armazenamento do navegador neste
          aparelho. Sem entrar em uma conta, esse save permanece ligado ao mesmo perfil de
          navegador. Limpar os dados do site, usar uma janela privada ou trocar de navegador pode
          remover ou tornar esse progresso local inacessível.
        </p>
        <p>
          Com uma conta e conexão, o jogo também envia o progresso para a nuvem. Se você estiver
          offline, alterações feitas em uma conta podem ficar pendentes até a conexão voltar. A
          etiqueta de estado diferencia quando o save está local, offline, aguardando envio ou
          sincronizado.
        </p>
        <p>
          A sincronização não combina duas edições simultâneas de aparelhos diferentes: quando há
          versões local e remota, o sistema usa a que tiver o registro de salvamento mais recente.
          Para reduzir conflitos, termine de sincronizar em um aparelho antes de continuar a mesma
          carreira em outro.
        </p>
      </Section>
      <Section id="preparar" title="Prepare o jogo antes de se desconectar">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Abra o JogoManager enquanto ainda tem internet.</li>
          <li>
            Entre na carreira que pretende continuar e confirme que o último progresso foi salvo.
          </li>
          <li>Se usa conta, aguarde o estado indicar sincronização concluída antes de sair.</li>
          <li>Evite limpar o armazenamento do site ou alternar para uma janela privada.</li>
          <li>Se mudou de aparelho, confira a carreira online antes de ficar sem conexão.</li>
        </ol>
        <p>
          Instalar o site na tela inicial pode facilitar o acesso, mas não substitui a sincronização
          da conta nem garante que cada tela e recurso já esteja disponível offline.
        </p>
      </Section>
      <Section id="sincronizar" title="Confira a sincronização quando a conexão voltar">
        <p>
          Ao voltar à internet, mantenha o jogo aberto ou retorne à carreira para que as alterações
          pendentes possam ser enviadas. Antes de fechar o navegador, trocar de aparelho ou remover
          dados do site, aguarde até que o estado mostre que a versão está sincronizada.
        </p>
        <p>
          Se você costuma alternar entre aparelhos, use a mesma conta e confirme a sincronização
          depois de cada sessão. Uma conta não transforma uma edição ainda pendente em cópia segura:
          confira o estado exibido no jogo.
        </p>
      </Section>
      <Section id="conexao" title="O que ainda depende da internet">
        <p>
          Login, envio e recuperação de saves na nuvem, partidas multiplayer, loja e serviços que
          consultam o servidor precisam de conexão. A carreira local e as partidas contra o
          computador podem continuar offline quando o aplicativo e os recursos usados já estão
          disponíveis. Os próprios avisos do jogo indicam quando uma ação precisa ser retomada
          online.
        </p>
        <p>
          Para dúvidas sobre conta, sincronização ou acesso, consulte as{" "}
          <Link to="/perguntas-frequentes" className="text-primary underline">
            perguntas frequentes
          </Link>
          .
        </p>
      </Section>
    </ArticleShell>
  );
}
