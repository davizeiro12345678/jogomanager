import { Link } from "@tanstack/react-router";

const COPY = {
  en: {
    label: "A football manager game in your browser",
    title: "Manage your club. Shape your story.",
    intro:
      "In jogomanager, you are the football coach: build a squad, choose your tactics and follow matches in 3D. Start your career free on a computer or phone.",
    start: "Start a career",
    match: "Try a quick match",
    note: "Free to start · No initial sign-up · Played in your browser",
    modesTitle: "Choose how to play",
    modes: [
      [
        "Manager career",
        "Choose a club, create your coach and plan beyond the next match. Review your squad, tactics and finances as the season unfolds.",
      ],
      [
        "Quick match",
        "Pick two teams and try a match before committing to a season. It is a useful way to explore the match view and controls.",
      ],
      [
        "With friends",
        "Visit the multiplayer area to organize a match with other players. Availability and connection requirements depend on the mode.",
      ],
      [
        "Player career",
        "Explore a career focused on an athlete rather than the club's manager. Check the mode for the features available in this version.",
      ],
    ],
    decisionsTitle: "What does a football manager do?",
    decisions: [
      [
        "Prepare the squad",
        "Check positions, fitness and available substitutes. Balance immediate needs with the players and budget you already have.",
      ],
      [
        "Set a game plan",
        "Choose a formation and instructions, then watch how your team creates space and defends. Adjust one thing at a time when comparing matches.",
      ],
      [
        "Plan transfers",
        "Compare a player's position and cost, including salary, before negotiating. A good fit for the squad can matter more than a famous name.",
      ],
    ],
    exampleTitle: "A simple tactical starting point",
    example:
      "A 4-4-2 places two lines of four behind two forwards; a 4-3-3 uses three players in the front line. Neither formation guarantees a win. Look at your squad and opponents, then use the match view to see where space opens up. Fitness and the instructions available in your game also matter.",
    questionsTitle: "Before your first match",
    questions: [
      [
        "Do I need an account?",
        "You can start as a guest. Guest progress is kept in the current browser and device; account and cloud features depend on a working connection.",
      ],
      [
        "Is it free?",
        "You can start playing for free. Optional purchases may be available; check the product details before buying.",
      ],
      [
        "Will every club in the catalogue be playable?",
        "Not necessarily. Some records are informational, and availability varies by mode. Check the club selection in the game for the current options.",
      ],
      [
        "How do I protect my progress?",
        "Keep a backup where export is available and check that your save is synchronized before changing devices or clearing browser data.",
      ],
    ],
    languageNote: "Game screens and linked guides may vary by language and mode.",
    footer: "Learn more about the game",
    about: "About (Portuguese)",
    privacy: "Privacy (Portuguese)",
    terms: "Terms (Portuguese)",
    language: "Page language",
  },
  es: {
    label: "Un juego de mánager de fútbol en tu navegador",
    title: "Dirige tu club. Construye tu historia.",
    intro:
      "En jogomanager eres el entrenador: prepara la plantilla, elige tu táctica y sigue los partidos en 3D. Empieza tu carrera gratis desde el ordenador o el móvil.",
    start: "Empezar una carrera",
    match: "Probar un partido rápido",
    note: "Gratis para empezar · Sin registro inicial · Desde el navegador",
    modesTitle: "Elige cómo jugar",
    modes: [
      [
        "Carrera de entrenador",
        "Elige un club, crea a tu entrenador y planifica más allá del próximo partido. Revisa la plantilla, la táctica y las finanzas durante la temporada.",
      ],
      [
        "Partido rápido",
        "Elige dos equipos y prueba un encuentro antes de comenzar una temporada. Es una forma de conocer la vista del partido y los controles.",
      ],
      [
        "Con amigos",
        "Visita la sección multijugador para organizar partidos con otras personas. La disponibilidad y los requisitos de conexión dependen del modo.",
      ],
      [
        "Carrera de jugador",
        "Explora una trayectoria centrada en un futbolista en lugar del entrenador del club. Consulta las funciones disponibles en esta versión.",
      ],
    ],
    decisionsTitle: "¿Qué hace un entrenador de fútbol?",
    decisions: [
      [
        "Prepara la plantilla",
        "Revisa las posiciones, el estado físico y los suplentes disponibles. Equilibra las necesidades inmediatas con tus jugadores y presupuesto.",
      ],
      [
        "Define el plan de juego",
        "Elige una formación y las instrucciones; observa cómo tu equipo crea espacios y defiende. Cambia una cosa cada vez para comparar partidos.",
      ],
      [
        "Planifica los fichajes",
        "Compara la posición y el coste del jugador, incluido su salario, antes de negociar. Su encaje en la plantilla puede importar más que un nombre famoso.",
      ],
    ],
    exampleTitle: "Un punto de partida para la táctica",
    example:
      "El 4-4-2 organiza dos líneas de cuatro detrás de dos delanteros; el 4-3-3 sitúa a tres jugadores en la línea de ataque. Ninguna formación garantiza la victoria. Observa tu plantilla y a los rivales, y usa la vista del partido para ver dónde aparecen espacios. El estado físico y las instrucciones disponibles también influyen.",
    questionsTitle: "Antes del primer partido",
    questions: [
      [
        "¿Necesito una cuenta?",
        "Puedes empezar como invitado. El progreso de invitado se guarda en el navegador y dispositivo actuales; las funciones de cuenta y nube dependen de la conexión.",
      ],
      [
        "¿Es gratis?",
        "Puedes empezar a jugar gratis. Puede haber compras opcionales; consulta los detalles del producto antes de comprar.",
      ],
      [
        "¿Se puede jugar con todos los clubes del catálogo?",
        "No necesariamente. Algunos registros son informativos y la disponibilidad cambia según el modo. Consulta la selección de clubes dentro del juego.",
      ],
      [
        "¿Cómo protejo mi progreso?",
        "Guarda una copia cuando esté disponible la exportación y comprueba la sincronización antes de cambiar de dispositivo o borrar los datos del navegador.",
      ],
    ],
    languageNote:
      "El idioma de las pantallas del juego y las guías enlazadas puede variar según el modo y la configuración.",
    footer: "Más información sobre el juego",
    about: "Acerca de (portugués)",
    privacy: "Privacidad (portugués)",
    terms: "Condiciones (portugués)",
    language: "Idioma de la página",
  },
} as const;

export function InternationalHome({ locale }: { locale: "en" | "es" }) {
  const copy = COPY[locale];
  return (
    <main className="pitch-bg min-h-screen px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-6">
          <Link to="/" className="font-display text-xl font-bold text-foreground">
            jogomanager
          </Link>
          <nav aria-label={copy.language} className="flex gap-4 text-sm text-primary">
            <Link to="/" lang="pt-BR">
              Português
            </Link>
            <Link to="/en" lang="en" aria-current={locale === "en" ? "page" : undefined}>
              English
            </Link>
            <Link to="/es" lang="es" aria-current={locale === "es" ? "page" : undefined}>
              Español
            </Link>
          </nav>
        </header>
        <section className="py-12 sm:py-16" aria-labelledby="international-title">
          <p className="text-sm font-medium text-primary">{copy.label}</p>
          <h1
            id="international-title"
            className="mt-4 max-w-3xl font-display text-4xl font-bold leading-tight text-foreground sm:text-6xl"
          >
            {copy.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {copy.intro}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/new"
              className="rounded-lg bg-primary px-6 py-3 font-display font-semibold text-primary-foreground"
            >
              {copy.start}
            </Link>
            <Link
              to="/partida-rapida"
              className="rounded-lg border border-border px-6 py-3 font-display font-semibold text-foreground"
            >
              {copy.match}
            </Link>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">{copy.note}</p>
        </section>
        <section className="border-t border-border/60 py-10" aria-labelledby="international-modes">
          <h2 id="international-modes" className="font-display text-3xl text-foreground">
            {copy.modesTitle}
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {copy.modes.map(([title, text]) => (
              <article key={title} className="surface-card rounded-xl border border-border/60 p-5">
                <h3 className="font-display text-xl text-foreground">{title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section
          className="border-t border-border/60 py-10"
          aria-labelledby="international-decisions"
        >
          <h2 id="international-decisions" className="font-display text-3xl text-foreground">
            {copy.decisionsTitle}
          </h2>
          <div className="mt-5 space-y-5">
            {copy.decisions.map(([title, text]) => (
              <div key={title}>
                <h3 className="font-display text-xl text-foreground">{title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
          <h3 className="mt-8 font-display text-xl text-foreground">{copy.exampleTitle}</h3>
          <p className="mt-2 leading-relaxed text-muted-foreground">{copy.example}</p>
        </section>
        <section
          className="border-t border-border/60 py-10"
          aria-labelledby="international-questions"
        >
          <h2 id="international-questions" className="font-display text-3xl text-foreground">
            {copy.questionsTitle}
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {copy.questions.map(([question, answer]) => (
              <article
                key={question}
                className="surface-card rounded-xl border border-border/60 p-5"
              >
                <h3 className="font-display text-lg text-foreground">{question}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{answer}</p>
              </article>
            ))}
          </div>
          <p className="mt-5 text-sm text-muted-foreground">{copy.languageNote}</p>
        </section>
        <footer className="border-t border-border/60 py-8 text-sm text-muted-foreground">
          <p>{copy.footer}</p>
          <nav className="mt-3 flex flex-wrap gap-4 text-primary" aria-label={copy.footer}>
            <Link to="/sobre">{copy.about}</Link>
            <Link to="/privacidade">{copy.privacy}</Link>
            <Link to="/termos">{copy.terms}</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
