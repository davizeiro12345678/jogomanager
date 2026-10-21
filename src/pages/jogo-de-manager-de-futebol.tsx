import { Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";
import { JOGO_DE_MANAGER_DE_FUTEBOL_PATH as PATH } from "@/lib/public-route-paths";

export function Page() {
  return (
    <div className="pitch-bg min-h-screen px-4 py-14">
      <article className="mx-auto max-w-3xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Grátis</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Jogo de manager de futebol grátis online em 3D
        </h1>
        <p className="mt-4 text-muted-foreground">
          O Pro Football Manager 3D roda direto no navegador: você assume o comando de um clube,
          decide contratações, escala o time, escolhe a tática e assiste aos 90 minutos com
          jogadores em 3D. Conheça os clubes e campeonatos disponíveis no modo carreira; as opções
          variam conforme o modo e os dados integrados. Você pode começar sem criar conta.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/new"
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground"
          >
            Começar carreira
          </Link>
          <Link
            to="/tabelas"
            className="rounded-lg border border-border px-6 py-3 font-display text-sm uppercase tracking-widest"
          >
            Ver as ligas
          </Link>
        </div>

        <h2 className="mt-12 font-display text-2xl">Como funciona</h2>
        <ol className="mt-4 space-y-3 text-muted-foreground">
          <li>
            <h3 className="font-display text-lg text-foreground">1. Escolha o clube</h3> Clubes com
            força acima de 85 cobram título já na primeira temporada; entre 70 e 78 a diretoria dá
            tempo para você construir um projeto.
          </li>
          <li>
            <h3 className="font-display text-lg text-foreground">2. Monte o elenco</h3> 22 a 26
            jogadores é o equilíbrio entre folha salarial e segurança contra lesões.
          </li>
          <li>
            <h3 className="font-display text-lg text-foreground">3. Defina a tática</h3> Formação,
            mentalidade, altura da linha e ritmo mudam o comportamento do time dentro da partida.
          </li>
          <li>
            <h3 className="font-display text-lg text-foreground">4. Assista ou pule</h3> Veja o jogo
            em 3D com câmera de transmissão ou simule o resultado em segundos.
          </li>
        </ol>

        <h2 className="mt-12 font-display text-2xl">Precisa instalar ou pagar?</h2>
        <p className="mt-3 text-muted-foreground">
          Não. O jogo é gratuito e roda no navegador do computador ou do celular. A conta é
          opcional: jogando como convidado a carreira fica salva no próprio aparelho; criando conta,
          ela é salva na nuvem e você continua de onde parou em qualquer lugar.
        </p>

        <h2 className="mt-12 font-display text-2xl">Próximos passos</h2>
        <p className="mt-3 text-muted-foreground">
          Se é sua primeira carreira, comece pelo{" "}
          <Link to="/guias" className="text-primary underline">
            passo a passo para novos treinadores
          </Link>{" "}
          e depois estude as{" "}
          <Link to="/melhores-formacoes" className="text-primary underline">
            táticas e formações
          </Link>
          .
        </p>

        <section aria-labelledby="manager-decisoes" className="mt-12 space-y-5">
          <h2 id="manager-decisoes" className="font-display text-2xl">
            O que faz um treinador no Pro Football Manager 3D?
          </h2>
          <p className="text-muted-foreground">
            Ser técnico não é apenas escolher a escalação. Você precisa conciliar resultados,
            condição dos atletas, dinheiro e desenvolvimento do elenco. Uma mudança tática que
            funciona contra um rival pode deixar espaços contra outro: o desafio está em observar a
            partida e adaptar o planejamento às necessidades do clube.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "Escolha do clube e objetivos",
                detail:
                  "Comece por um desafio compatível com sua experiência. Analise a qualidade do elenco, as posições descobertas e as expectativas da temporada antes de aceitar a missão.",
              },
              {
                title: "Formações e instruções",
                detail:
                  "Organize os setores, experimente diferentes esquemas e observe onde o adversário encontra espaço. Compare alterações de mentalidade, pressão e substituições.",
              },
              {
                title: "Elenco e contratações",
                detail:
                  "Compare idade, posição, nota, potencial e custo. Evite gastar toda a verba em um nome quando o time precisa de reforços em mais de uma posição.",
              },
              {
                title: "Partidas e acompanhamento",
                detail:
                  "Assista ao confronto em 3D ou use as opções de simulação disponíveis. Avalie o que mudou em campo antes de tomar a próxima decisão.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-border/60 surface-card p-4">
                <h3 className="font-display text-lg">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="manager-primeira-temporada" className="mt-12">
          <h2 id="manager-primeira-temporada" className="font-display text-2xl">
            Exemplo prático: sua primeira temporada
          </h2>
          <p className="mt-3 text-muted-foreground">
            Imagine que você assumiu um clube de meio de tabela. O elenco tem bons atacantes, mas
            apenas um lateral disponível e pouco orçamento. Em vez de contratar outro centroavante
            famoso, um plano sustentável começa pela posição mais vulnerável. É uma situação
            ilustrativa, não um resultado pré-programado.
          </p>
          <ol className="mt-4 list-decimal space-y-3 pl-6 text-muted-foreground">
            <li>
              <strong className="text-foreground">Antes da estreia:</strong> confira as posições e a
              condição física, defina uma formação simples e preserve parte da verba.
            </li>
            <li>
              <strong className="text-foreground">Após três partidas:</strong> analise os espaços
              cedidos e a qualidade das chances criadas. Faça uma alteração por vez para entender o
              efeito.
            </li>
            <li>
              <strong className="text-foreground">Na janela de transferências:</strong> compare
              alternativas para o setor carente, incluindo salário e perspectiva de evolução.
            </li>
            <li>
              <strong className="text-foreground">Na metade da temporada:</strong> revise as metas,
              o equilíbrio financeiro e o desempenho contra adversários de diferentes níveis.
            </li>
            <li>
              <strong className="text-foreground">Antes da próxima temporada:</strong> identifique
              contratações que deram certo e exporte uma cópia da carreira.
            </li>
          </ol>
        </section>

        <section aria-labelledby="manager-escolher" className="mt-12">
          <h2 id="manager-escolher" className="font-display text-2xl">
            Como escolher entre carreira, partida rápida e multiplayer
          </h2>
          <div className="mt-4 space-y-4 text-muted-foreground">
            <p>
              <strong className="text-foreground">Carreira de treinador:</strong> é a escolha para
              quem gosta de decisões acumuladas ao longo de várias rodadas, planejamento e evolução
              de um clube.{" "}
              <Link to="/new" className="text-primary underline">
                Criar treinador
              </Link>
              .
            </p>
            <p>
              <strong className="text-foreground">Partida rápida:</strong> é ideal para conhecer o
              ritmo da simulação e testar um confronto antes de dedicar tempo a uma temporada.{" "}
              <Link to="/partida-rapida" className="text-primary underline">
                Experimentar uma partida
              </Link>
              .
            </p>
            <p>
              <strong className="text-foreground">Multiplayer:</strong> permite organizar confrontos
              com outras pessoas. Confira as condições de conexão e a disponibilidade do modo antes
              de entrar.{" "}
              <Link to="/multiplayer" className="text-primary underline">
                Conhecer multiplayer
              </Link>
              .
            </p>
            <p>
              <strong className="text-foreground">Carreira de jogador:</strong> concentra a
              experiência na trajetória de um atleta. Consulte a página do modo para saber os
              recursos disponíveis nesta versão.{" "}
              <Link to="/jogador" className="text-primary underline">
                Ver carreira de jogador
              </Link>
              .
            </p>
          </div>
        </section>

        <section aria-labelledby="manager-dados" className="mt-12">
          <h2 id="manager-dados" className="font-display text-2xl">
            Clubes reais, catálogo de dados e ligas jogáveis: qual é a diferença?
          </h2>
          <p className="mt-3 text-muted-foreground">
            A plataforma reúne informações de clubes, atletas e competições de diferentes fontes.
            Estar cadastrado na base não significa automaticamente que um clube tenha elenco
            completo, estádio específico ou esteja selecionável em todos os modos. Para escolher seu
            desafio, consulte as opções mostradas dentro do próprio jogo e veja as
            <Link to="/tabelas" className="text-primary underline">
              {" "}
              ligas apresentadas
            </Link>
            . As{" "}
            <Link to="/tabelas" className="text-primary underline">
              tabelas reais
            </Link>{" "}
            são um recurso informativo separado da simulação da sua carreira.
          </p>
        </section>

        <section aria-labelledby="manager-saves" className="mt-12">
          <h2 id="manager-saves" className="font-display text-2xl">
            Como salvar sua carreira e evitar perder progresso
          </h2>
          <p className="mt-3 text-muted-foreground">
            Ao começar como convidado, seus dados podem ficar associados ao navegador e ao
            dispositivo atual. Uma conta oferece recursos de sincronização quando a conexão está
            disponível, mas é importante confirmar o estado do save antes de alternar aparelhos,
            limpar dados locais ou substituir uma carreira existente.
          </p>
          <p className="mt-3 text-muted-foreground">
            Faça exportações periódicas como cópia de segurança, sobretudo antes de testar mudanças
            importantes. Leia o{" "}
            <Link to="/jogar-offline" className="text-primary underline">
              guia de uso offline
            </Link>{" "}
            para conhecer as limitações e as recomendações de backup.
          </p>
        </section>

        <section aria-labelledby="manager-faq" className="mt-12">
          <h2 id="manager-faq" className="font-display text-2xl">
            Dúvidas comuns de quem está começando
          </h2>
          <dl className="mt-4 space-y-4 text-muted-foreground">
            <div>
              <dt className="font-display text-lg text-foreground">Preciso instalar o jogo?</dt>
              <dd>
                Não para jogar pela web: abra o site em um navegador compatível. O desempenho do 3D
                depende do dispositivo e do navegador.
              </dd>
            </div>
            <div>
              <dt className="font-display text-lg text-foreground">Qual é a melhor formação?</dt>
              <dd>
                Não existe uma resposta universal. O melhor esquema depende dos jogadores
                disponíveis e do adversário. Veja o{" "}
                <Link to="/melhores-formacoes" className="text-primary underline">
                  comparativo de formações
                </Link>
                .
              </dd>
            </div>
            <div>
              <dt className="font-display text-lg text-foreground">
                É possível jogar gratuitamente?
              </dt>
              <dd>
                Existe acesso gratuito aos modos básicos. Produtos opcionais da loja devem ter
                preços e condições consultados antes da compra.
              </dd>
            </div>
            <div>
              <dt className="font-display text-lg text-foreground">Onde encontro ajuda?</dt>
              <dd>
                Consulte as{" "}
                <Link to="/perguntas-frequentes" className="text-primary underline">
                  perguntas frequentes
                </Link>{" "}
                ou o{" "}
                <Link to="/contato" className="text-primary underline">
                  suporte
                </Link>
                .
              </dd>
            </div>
          </dl>
        </section>

        <PublicLinks exclude={PATH} />
      </article>
    </div>
  );
}
