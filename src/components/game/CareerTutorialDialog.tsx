import { Link } from "@tanstack/react-router";
import { BookOpen, Check, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  TUTORIAL_CHAPTERS,
  parseReviewedTutorialLessons,
  verifiedCareerLessons,
  tutorialProgress,
} from "@/game/career-tutorial";
import type { CareerState } from "@/game/types";
import "./career-tutorial.css";

export default function CareerTutorialDialog({
  open,
  onOpenChange,
  onReturnFocus,
  careerKey,
  career,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReturnFocus?: () => boolean;
  careerKey: string;
  career: CareerState;
}) {
  const [onlyPending, setOnlyPending] = useState(false);
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set());
  const storageKey = `jm.tutorial:${careerKey}`;
  useEffect(() => {
    try {
      // Legacy arrays contain local review marks, never verified career evidence.
      setReviewed(
        parseReviewedTutorialLessons(JSON.parse(localStorage.getItem(storageKey) ?? "[]")),
      );
    } catch {
      setReviewed(new Set());
    }
  }, [storageKey]);
  function save(next: Set<string>) {
    setReviewed(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      /* Session guidance still works. */
    }
  }
  const verified = verifiedCareerLessons(career);
  const progress = tutorialProgress(verified, reviewed);
  const completed = new Set([...verified, ...reviewed]);
  const chapters = TUTORIAL_CHAPTERS.map((chapter, index) => ({
    ...chapter,
    index,
    completed: chapter.lessons.filter(({ id }) => completed.has(id)).length,
    total: chapter.lessons.length,
    lessons: onlyPending ? chapter.lessons.filter(({ id }) => !completed.has(id)) : chapter.lessons,
  })).filter(({ lessons }) => lessons.length > 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="career-guide max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto overscroll-contain sm:max-w-2xl"
        onCloseAutoFocus={(event) => {
          if (onReturnFocus?.()) event.preventDefault();
        }}
      >
        <DialogTitle className="flex items-center gap-2">
          <BookOpen size={20} aria-hidden />
          Tutorial da carreira
        </DialogTitle>
        <DialogDescription>
          Retome de onde parou. O guia usa os registros da carreira para reconhecer ações. Você
          também pode marcar lições que revisou.
        </DialogDescription>
        <p role="status" className="career-guide-progress text-sm">
          <strong>
            {progress.completed}/{progress.total} lições concluídas ou revisadas
          </strong>
          <span>
            {progress.verified} comprovadas na carreira · {progress.reviewed} marcadas por você
          </span>
        </p>
        <progress
          aria-label="Progresso da tutorial, incluindo prática comprovada e revisão manual"
          aria-valuetext={`${progress.completed} de ${progress.total}; ${progress.verified} comprovadas na carreira e ${progress.reviewed} marcadas por você`}
          className="h-2 w-full accent-primary"
          max={progress.total}
          value={progress.completed}
        />
        {progress.next ? (
          <div className="border-b border-border pb-4">
            <p className="mb-1 text-xs text-muted-foreground">Próximo passo</p>
            <h3 className="mb-2 text-base font-semibold">{progress.next.title}</h3>
            <p className="mb-3 text-sm text-muted-foreground">{progress.next.instruction}</p>
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
            Todas as lições têm prática registrada ou foram marcadas como revisadas. Você pode rever
            qualquer capítulo.
          </p>
        )}
        <label className="career-guide-filter">
          <input
            type="checkbox"
            checked={onlyPending}
            onChange={(event) => setOnlyPending(event.target.checked)}
          />
          Mostrar apenas lições pendentes
        </label>
        {chapters.length === 0 && onlyPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Nenhuma lição pendente.
          </p>
        ) : null}
        {chapters.map((chapter) => (
          <details
            key={chapter.title}
            open={chapter.lessons.some((lesson) => lesson.id === progress.next?.id)}
            className="career-guide-chapter"
          >
            <summary className="career-guide-chapter-heading">
              <span>
                {chapter.index + 1}. {chapter.title}
              </span>
              <span className="career-guide-chapter-count">
                {chapter.completed}/{chapter.total}
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
                      {verified.has(lesson.id) ? "Concluída na carreira" : "Marcada por você"}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">{lesson.instruction}</p>
                  {lesson.exercise && (
                    <p className="career-guide-exercise mt-2 text-sm">
                      <strong>Experimente.</strong> {lesson.exercise}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      asChild
                      size="sm"
                      className="min-h-11"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                    >
                      <Link to={lesson.to} aria-label={`Abrir tela da lição ${lesson.title}`}>
                        Abrir tela
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-11"
                      disabled={verified.has(lesson.id)}
                      aria-pressed={reviewed.has(lesson.id)}
                      onClick={() => {
                        const next = new Set(reviewed);
                        if (next.has(lesson.id)) next.delete(lesson.id);
                        else next.add(lesson.id);
                        save(next);
                      }}
                    >
                      {verified.has(lesson.id)
                        ? "Concluída na carreira"
                        : reviewed.has(lesson.id)
                          ? "Desmarcar revisão"
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
