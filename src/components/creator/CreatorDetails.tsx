import { CREATOR } from "@/content/creator";
import { useT } from "@/i18n/provider";
import { creatorMessages } from "@/i18n/creator-messages";

/** Public details supplied by the project owner for the information pages. */
export function CreatorDetails() {
  const { lang } = useT();
  const copy = creatorMessages(lang);
  return (
    <section
      className="surface-card mt-8 rounded-2xl border border-border/60 p-5 sm:p-6"
      aria-labelledby="creator-details-title"
    >
      <h2 id="creator-details-title" className="font-display text-xl uppercase">
        {copy.title}
      </h2>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-widest text-muted-foreground">{copy.owner}</dt>
          <dd className="mt-1 font-medium">{CREATOR.name}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-widest text-muted-foreground">{copy.cpf}</dt>
          <dd className="mt-1 tabular-nums" aria-label={copy.cpf}>
            ***.***.***-**
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{copy.onlineSupport}</p>
    </section>
  );
}
