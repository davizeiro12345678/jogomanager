import { Link } from "@tanstack/react-router";
import { BookOpen, Check, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  TUTORIAL_CHAPTERS,
  parseTutorialLessons,
  practicedCareerLessons,
  tutorialProgress,
} from "@/game/career-tutorial";
import type { CareerState } from "@/game/types";

export default function CareerTutorialDialog({
  open,
  onOpenChange,
  careerKey,
  career,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  careerKey: string;
  career: CareerState;
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
  const practiced = practicedCareerLessons(career);
  const completed = new Set([...learned, ...practiced]);
  const progress = tutorialProgress(completed);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto overscroll-contain sm:max-w-2xl">
        <DialogTitle className="flex items-center gap-2">
          <BookOpen size={20} aria-hidden />
          Tutorial da carreira
        </DialogTitle>
        <DialogDescription>
          Retome de onde parou. O guia usa os registros da carreira para reconhecer ações. Você
          também pode marcar lições que revisou.
        </DialogDescription>
        <p role="status" className="text-sm text-primary">
          {progress.completed} de {progress.total} lições concluídas ou marcadas
        </p>
        <progress
          aria-label="Lições concluídas ou marcadas"
          className="h-2 w-full accent-primary"
          max={progress.total}
          value={progress.completed}
        />
        {progress.next ? (
          <div className="border-b border-border pb-4">
            <p className="mb-2 text-sm font-semibold">Próximo passo: {progress.next.title}</p>
            <Button
              asChild
              className="min-h-11 h-auto whitespace-normal text-left"
              onClick={() => onOpenChange(false)}
            >
              <Link to={progress.next.to}>Continuar: {progress.next.title}</Link>
            </Button>
          </div>
        ) : (
          <p className="text-sm text-primary">
            Todas as lições foram concluídas ou marcadas. Você pode rever qualquer capítulo.
          </p>
        )}
        {TUTORIAL_CHAPTERS.map((chapter, index) => (
          <details
            key={chapter.title}
            open={chapter.lessons.some((lesson) => lesson.id === progress.next?.id)}
            className="rounded-lg border border-border px-3 py-1 sm:px-4"
          >
            <summary className="min-h-11 cursor-pointer py-2.5 font-display text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              {index + 1}. {chapter.title}{" "}
              <span className="text-sm text-muted-foreground">
                ({chapter.lessons.filter((lesson) => completed.has(lesson.id)).length}/
                {chapter.lessons.length})
              </span>
            </summary>
            <ul className="mt-2 space-y-4 pb-3">
              {chapter.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    {completed.has(lesson.id) ? (
                      <Check size={16} aria-hidden className="text-primary" />
                    ) : null}
                    {lesson.title}
                  </h3>
                  {completed.has(lesson.id) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {practiced.has(lesson.id) ? "Concluída na carreira" : "Marcada por você"}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">{lesson.instruction}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      asChild
                      size="sm"
                      className="min-h-11"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                    >
                      <Link to={lesson.to}>Abrir tela</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-11"
                      disabled={practiced.has(lesson.id)}
                      aria-pressed={completed.has(lesson.id)}
                      onClick={() => {
                        const next = new Set(learned);
                        if (next.has(lesson.id)) next.delete(lesson.id);
                        else next.add(lesson.id);
                        save(next);
                      }}
                    >
                      {practiced.has(lesson.id)
                        ? "Concluída na carreira"
                        : learned.has(lesson.id)
                          ? "Revisar depois"
                          : "Marcar como revisada"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        ))}
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={() => save(new Set())}>
            <RotateCcw size={16} aria-hidden />
            Limpar marcações manuais
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/perguntas-frequentes">Buscar no FAQ</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
