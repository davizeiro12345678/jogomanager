import { Link } from "@tanstack/react-router";
import { ArrowRight, Gamepad2, Trophy, Users } from "lucide-react";

/** Static home choices retain normal links and SEO-readable server markup. */
export function GameModeCards() {
  return (
          <div className="home-mode-grid">
            <Link to="/new" className="home-mode home-mode-career">
              <div className="home-mode-art" aria-hidden="true">
                <span>01</span>
                <Trophy size={86} />
              </div>
              <p className="home-kicker">O SEU PROJETO</p>
              <h3>Modo carreira</h3>
              <p>
                Escolha o clube, crie o treinador e conduza a próxima temporada. Elenco, tática,
                finanças e a torcida esperam por você.
              </p>
              <span className="home-mode-link">
                Assumir um clube
                <ArrowRight size={19} />
              </span>
            </Link>
            <Link to="/partida-rapida" className="home-mode">
              <div className="home-mode-art home-mode-art-match" aria-hidden="true">
                <span>02</span>
                <Gamepad2 size={76} />
              </div>
              <p className="home-kicker">O PRIMEIRO APITO</p>
              <h3>Partida rápida</h3>
              <p>
                Escolha dois times e vá para o estádio. Conheça os controles, as câmeras e o ritmo
                do jogo antes da sua carreira.
              </p>
              <span className="home-mode-link">
                Jogar uma partida
                <ArrowRight size={19} />
              </span>
            </Link>
            <Link to="/jogador" className="home-mode">
              <div className="home-mode-art home-mode-art-match" aria-hidden="true">
                <span>★</span>
                <Users size={76} />
              </div>
              <p className="home-kicker">DA BASE AO AUGE</p>
              <h3>Carreira de jogador</h3>
              <p>
                Crie seu atleta, treine, ganhe a vaga de titular, negocie contratos e chegue à
                seleção.
              </p>
              <span className="home-mode-link">
                Criar meu atleta
                <ArrowRight size={19} />
              </span>
            </Link>
            <Link to="/multiplayer" className="home-mode">
              <div className="home-mode-art home-mode-art-friends" aria-hidden="true">
                <span>03</span>
                <Users size={76} />
              </div>
              <p className="home-kicker">A RIVALIDADE CONTINUA</p>
              <h3>Com amigos</h3>
              <p>
                Abra uma sala, compartilhe o código e combine o próximo confronto. Cada treinador
                com o seu plano de jogo.
              </p>
              <span className="home-mode-link">
                Abrir multiplayer
                <ArrowRight size={19} />
              </span>
            </Link>
          </div>
  );
}
