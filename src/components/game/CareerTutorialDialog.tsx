import { Link } from "@tanstack/react-router";
import { BookOpen, Check, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TUTORIAL_CHAPTERS, parseTutorialLessons, tutorialProgress } from "@/game/career-tutorial";

export default function CareerTutorialDialog({
  open,
  onOpenChange,
  careerKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  careerKey: string;
}) {
  const [learned, setLearned] = useState<Set<string>>(() => new Set());
  const storageKey = `jm.tutorial:${careerKey}`;
  useEffect(() => {
    try {
      setLearned(parseTutorialLessons(JSON.parse(localStorage.getItem(storageKey) ?? "[]")));
    } catch {
      setLearned(new Set());
    }
  }, [storageKey]);
  function save(next: Set<string>) {
    setLearned(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      /* Session guidance still works. */
    }
  }
  const progress = tutorialProgress(learned);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle className="flex items-center gap-2">
          <BookOpen size={20} aria-hidden />
          Tutorial da carreira
        </DialogTitle>
        <DialogDescription>
          Retome de onde parou ou reveja qualquer capítulo. Marque as lições que já praticou.
        </DialogDescription>
        <p role="status" className="text-sm text-primary">
          {progress.completed} de {progress.total} lições praticadas
        </p>
        <progress
          aria-label="Lições praticadas"
          className="h-2 w-full accent-primary"
          max={progress.total}
          value={progress.completed}
        />
        {TUTORIAL_CHAPTERS.map((chapter, index) => (
          <section key={chapter.title} className="border-t border-border pt-4">
            <h2 className="font-display text-lg">
              {index + 1}. {chapter.title}
            </h2>
            <ul className="mt-3 space-y-4">
              {chapter.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    {learned.has(lesson.id) ? (
                      <Check size={16} aria-label="Praticada" className="text-primary" />
                    ) : null}
                    {lesson.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{lesson.instruction}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                      <Link to={lesson.to}>Abrir tela</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-pressed={learned.has(lesson.id)}
                      onClick={() => {
                        const next = new Set(learned);
                        if (next.has(lesson.id)) next.delete(lesson.id);
                        else next.add(lesson.id);
                        save(next);
                      }}
                    >
                      {learned.has(lesson.id) ? "Revisar depois" : "Já pratiquei"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={() => save(new Set())}>
            <RotateCcw size={16} aria-hidden />
            Reiniciar lições
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/perguntas-frequentes">Buscar no FAQ</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
