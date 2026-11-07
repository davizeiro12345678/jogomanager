import { Check } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import "./creation-steps.css";

/** Navigation is presentation-only; each creator owns validation and unlocked steps. */
export function CreationSteps({
  labels,
  current,
  furthest,
  onSelect,
}: {
  labels: readonly string[];
  current: number;
  furthest: number;
  onSelect: (index: number) => void;
}) {
  const heading = useRef<HTMLParagraphElement>(null);
  const previous = useRef(current);
  useEffect(() => {
    if (previous.current === current) return;
    previous.current = current;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [current]);
  return (
    <nav className="creation-steps" aria-label="Etapas de criação">
      <p
        ref={heading}
        tabIndex={-1}
        className="creation-step-heading"
        aria-live="polite"
        aria-atomic="true"
      >
        <span>
          Etapa {current + 1} de {labels.length}
        </span>
        <strong>{labels[current]}</strong>
      </p>
      <ol>
        {labels.map((label, index) => (
          <li key={label}>
            <Button
              type="button"
              variant="ghost"
              aria-current={current === index ? "step" : undefined}
              disabled={index > furthest}
              onClick={() => onSelect(index)}
              className="creation-step-button"
              aria-label={`${index + 1}. ${label}${index < furthest ? ", visitada" : ""}`}
            >
              <span className="creation-step-number" aria-hidden="true">
                {index < furthest ? <Check size={16} /> : index + 1}
              </span>
              <span>{label}</span>
            </Button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
