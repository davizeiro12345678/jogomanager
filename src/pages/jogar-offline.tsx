import { Link } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { JOGAR_OFFLINE_PATH as PATH } from "@/lib/public-route-paths";

export function OfflinePage() {
  return (
    <ArticleShell
      kicker="Progresso e conexão"
      title="Como cuidar da carreira, do backup e da sincronização"
      intro="Uma carreira salva no navegador e uma carreira sincronizada são estados diferentes. Saiba o que verificar antes de ficar sem conexão, limpar dados ou trocar de aparelho."
      path={PATH}
      readMinutes={7}
      level="Iniciante"
      updated="outubro de 2026"
      toc={[
        { id: "local", title: "Onde fica o progresso" },
        { id: "conexao", title: "O que depende de conexão" },
        { id: "preparar", title: "Preparação para ficar offline" },
        { id: "backup", title: "Backup e troca de aparelho" },
        { id: "conflito", title: "Falha de sincronização" },
        { id: "instalar", title: "Adicionar à tela inicial" },
        { id: "suporte", title: "Informações para pedir ajuda" },
      ]}
      faq={[
        {
          q: "Criar uma conta garante que tudo já está na nuvem?",
          a: "Confira o estado de sincronização. Estar autenticado e concluir o envio da carreira são etapas diferentes.",
        },
        {
          q: "Posso limpar os dados do navegador depois de salvar?",
          a: "Isso pode remover a cópia local. Preserve um backup exportado e confirme a cópia de nuvem antes de limpar dados ou mudar de navegador.",
        },
        {
          q: "Adicionar à tela inicial garante acesso sem internet?",
          a: "A instalação facilita o acesso, mas a disponibilidade offline depende dos recursos já carregados e do armazenamento mantido pelo navegador.",
        },
      ]}
    >
      <Section id="local" title="1. Onde fica o progresso da carreira">
        <p>
          O jogo mantém uma cópia local da carreira no armazenamento do navegador. Ela pertence ao
          aparelho e ao perfil usados na sessão. Abrir outro navegador, usar outro perfil ou trocar
          de dispositivo não significa acessar automaticamente os mesmos dados.
        </p>
        <p>
          Uma conta permite utilizar os recursos de nuvem disponíveis, mas o envio precisa terminar.
          Confira o estado mostrado na interface. Se houver erro, pendência ou aviso de
          armazenamento, preserve a cópia local antes de fazer outra alteração. Não deduza que a
          nuvem está atualizada apenas porque o login funcionou.
        </p>
        <p>
          O histórico local também depende de o navegador conservar os dados. Uma cópia exportada,
          quando a opção estiver disponível, acrescenta uma forma de recuperação que você pode
          guardar fora daquele armazenamento.
        </p>
      </Section>
      <Section id="conexao" title="2. O que depende de conexão e do carregamento anterior">
        <p>
          A simulação da carreira acontece no aparelho. Isso permite continuar ações locais quando
          os arquivos necessários estão disponíveis. O primeiro acesso, telas ainda não carregadas,
          imagens externas e atualizações podem exigir internet. Teste o percurso que pretende usar
          antes de contar com ele durante uma viagem.
        </p>
        <p>
          Login, envio à nuvem, compras, chat, multiplayer e consultas a serviços externos dependem
          de conexão. Uma tabela real também pode precisar buscar dados novos. Uma imagem ausente e
          um save ausente são recursos diferentes e pedem verificações diferentes.
        </p>
        <p>
          Consulte as{" "}
          <Link to="/perguntas-frequentes" className="text-primary underline">
            perguntas frequentes
          </Link>{" "}
          para entender modos e acesso. Dados externos servem de contexto e não substituem a
          temporada da sua carreira.
        </p>
      </Section>
      <Section id="preparar" title="3. Checklist antes de ficar sem sinal">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Com conexão, abra a carreira correta e confira clube, temporada e rodada.</li>
          <li>Visite as telas que pretende usar e aguarde o carregamento dos recursos.</li>
          <li>Confira o salvamento local e, se usa conta, o estado da sincronização.</li>
          <li>Exporte uma cópia quando possível e guarde-a em um local acessível.</li>
          <li>
            Teste uma sessão curta sem conexão antes de depender desse acesso por muito tempo.
          </li>
        </ol>
        <p>
          Se o teste falhar, anote qual tela não abriu e preserve a carreira. Reestabeleça a conexão
          para carregar o recurso antes de tentar novamente. Em aparelhos com pouco espaço, o
          sistema ou o navegador pode remover dados armazenados.
        </p>
      </Section>
      <Section id="backup" title="4. Backup e troca de aparelho">
        <p>
          Identifique a cópia por clube, temporada e rodada, além da data. Antes de trocar de
          aparelho, conclua a sincronização no dispositivo de origem e confira os mesmos dados no
          destino. Guarde o arquivo original até verificar a recuperação.
        </p>
        <p>
          Evite alternar entre dispositivos enquanto ambos possuem alterações ainda não enviadas.
          Resolva qual cópia contém o progresso que deseja manter. Não publique arquivos de carreira
          no Discord; use um canal privado de suporte quando for necessário enviá-los.
        </p>
        <p>
          Modo privado, limpeza de dados e reinstalação do navegador podem remover armazenamento
          local. A criação de uma conta não recupera automaticamente uma cópia que nunca chegou à
          nuvem.
        </p>
      </Section>
      <Section id="conflito" title="5. O que fazer quando a sincronização falha">
        <p>
          Conexão instável, sessão expirada ou divergência entre versões podem exigir atenção.
          Confira o aviso exibido, a conta usada e o progresso em cada aparelho. Preserve um backup
          antes de escolher uma versão; evite apagar a cópia local como primeira tentativa.
        </p>
        <p>
          Uma data de arquivo mais recente não prova que a carreira tem mais progresso. Compare
          temporada, rodada e identidade. Se a interface rejeitar um envio antigo, procure a cópia
          correta ou peça ajuda com esses dados.
        </p>
        <p>
          Depois de resolver o aviso, confirme o estado novamente antes de encerrar. Uma tentativa
          iniciada e um envio concluído são eventos diferentes. O{" "}
          <Link to="/contato" className="text-primary underline">
            suporte oficial
          </Link>{" "}
          pode ajudar a interpretar um erro persistente.
        </p>
      </Section>
      <Section id="instalar" title="6. Adicionar à tela inicial facilita o acesso">
        <p>
          Quando o navegador oferecer a opção, use “Adicionar à tela de início” ou o controle de
          instalação. Nome e disponibilidade variam. O atalho facilita abrir o jogo, sem garantir
          que todo recurso esteja armazenado offline.
        </p>
        <p>
          No celular, teste a leitura e os controles. Ajustes gráficos mais leves podem ajudar a
          manter uma sessão confortável, mas não garantem autonomia de bateria nem uma taxa fixa de
          quadros. Resolva acesso e salvamento antes de iniciar uma sessão longa.
        </p>
      </Section>
      <Section id="suporte" title="7. Como descrever um problema de progresso">
        <p>
          Informe aparelho, navegador, conta usada, clube, temporada, rodada e a ação anterior ao
          problema. Diga se aconteceu após trocar de dispositivo, ficar offline ou importar uma
          cópia. Descreva o aviso sem incluir senha ou códigos de autenticação.
        </p>
        <p>
          Guarde as cópias existentes até entender o que ocorreu. Use os canais de{" "}
          <Link to="/contato" className="text-primary underline">
            contato
          </Link>{" "}
          para pedir ajuda. Para organizar decisões entre sessões, volte ao{" "}
          <Link to="/dicas-de-gestao" className="text-primary underline">
            planejamento da temporada
          </Link>
          .
        </p>
      </Section>
    </ArticleShell>
  );
}
