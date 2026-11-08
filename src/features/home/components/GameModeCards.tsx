import { Link } from "@tanstack/react-router";
import { ArrowRight, Gamepad2, Trophy, Users } from "lucide-react";

/** Keep the mode data separate from the single reusable markup template. */
const MODES = [
  {
    to: "/new",
    cardClass: "home-mode-career",
    artClass: "",
    numeral: "01",
    icon: Trophy,
    iconSize: 86,
    kicker: "O SEU PROJETO",
    title: "Modo carreira",
    description:
      "Escolha o clube, crie o treinador e conduza a próxima temporada. Elenco, tática, finanças e a torcida esperam por você.",
    action: "Assumir um clube",
  },
  {
    to: "/partida-rapida",
    cardClass: "",
    artClass: "home-mode-art-match",
    numeral: "02",
    icon: Gamepad2,
    iconSize: 76,
    kicker: "O PRIMEIRO APITO",
    title: "Partida rápida",
    description:
      "Escolha dois times e vá para o estádio. Conheça os controles, as câmeras e o ritmo do jogo antes da sua carreira.",
    action: "Jogar uma partida",
  },
  {
    to: "/jogador",
    cardClass: "",
    artClass: "home-mode-art-match",
    numeral: "★",
    icon: Users,
    iconSize: 76,
    kicker: "DA BASE AO AUGE",
    title: "Carreira de jogador",
    description:
      "Crie seu atleta, treine, ganhe a vaga de titular, negocie contratos e chegue à seleção.",
    action: "Criar meu atleta",
  },
  {
    to: "/multiplayer",
    cardClass: "",
    artClass: "home-mode-art-friends",
    numeral: "03",
    icon: Users,
    iconSize: 76,
    kicker: "A RIVALIDADE CONTINUA",
    title: "Com amigos",
    description:
      "Abra uma sala, compartilhe o código e combine o próximo confronto. Cada treinador com o seu plano de jogo.",
    action: "Abrir multiplayer",
  },
] as const;

export function GameModeCards() {
  return (
    <div className="home-mode-grid">
      {MODES.map((mode) => {
        const Icon = mode.icon;
        return (
          <Link key={mode.to} to={mode.to} className={`home-mode ${mode.cardClass}`}>
            <div className={`home-mode-art ${mode.artClass}`} aria-hidden="true">
              <span>{mode.numeral}</span>
              <Icon size={mode.iconSize} />
            </div>
            <p className="home-kicker">{mode.kicker}</p>
            <h3>{mode.title}</h3>
            <p>{mode.description}</p>
            <span className="home-mode-link">
              {mode.action}
              <ArrowRight size={19} />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
