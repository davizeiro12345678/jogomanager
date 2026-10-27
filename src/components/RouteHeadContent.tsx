import { Asset, useLocation, useRouter, useTags } from "@tanstack/react-router";
import { isLightweightCssPath } from "@/lib/public-content-routes";

/** Public SSR content can paint while the browser fetches its interactive shell. */
export function RouteHeadContent() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const tags = useTags();
  const nonce = useRouter().options.ssr?.nonce;
  // The small client entry starts hydration after the first paint. Preloading
  // its runtime here would compete with the SSR content. Preserve all other
  // tags, their original order and the framework's CSP nonce handling.
  const visibleTags = isLightweightCssPath(pathname)
    ? tags.filter((tag) => !(tag.tag === "link" && tag.attrs?.["rel"] === "modulepreload"))
    : tags;
  return (
    <>
      {visibleTags.map((tag) => (
        <Asset {...tag} key={JSON.stringify(tag)} {...(nonce ? { nonce } : {})} />
      ))}
    </>
  );
}
