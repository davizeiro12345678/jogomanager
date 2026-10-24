import { Asset, HeadContent, useLocation, useRouter, useTags } from "@tanstack/react-router";
import { isLightweightCssPath } from "@/lib/public-content-routes";

/** Public SSR content can paint while the browser fetches its interactive shell. */
export function RouteHeadContent() {
  const pathname = useLocation({ select: (location) => location.pathname });
  return isLightweightCssPath(pathname) ? <PublicHeadContent /> : <HeadContent />;
}

function PublicHeadContent() {
  const tags = useTags();
  const nonce = useRouter().options.ssr?.nonce;
  // Discover responsive hero images before the framework's hydration hints.
  const images = tags.filter(
    (tag) =>
      tag.tag === "link" && tag.attrs?.["rel"] === "preload" && tag.attrs?.["as"] === "image",
  );
  const remaining = tags.filter((tag) => !images.includes(tag));
  const hintIndex = remaining.findIndex(
    (tag) => tag.tag === "link" && tag.attrs?.["rel"] === "modulepreload",
  );
  remaining.splice(hintIndex < 0 ? remaining.length : hintIndex, 0, ...images);
  return (
    <>
      {remaining.map((tag) => (
        <Asset
          {...tag}
          attrs={{
            ...tag.attrs,
            ...(tag.tag === "link" && tag.attrs?.["rel"] === "modulepreload"
              ? { fetchPriority: "low" }
              : {}),
          }}
          key={`tsr-meta-${JSON.stringify(tag)}`}
          {...(nonce ? { nonce } : {})}
        />
      ))}
    </>
  );
}
