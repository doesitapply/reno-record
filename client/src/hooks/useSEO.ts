import { useEffect } from "react";

const SITE_NAME = "The Reno Record";
const SITE_URL = typeof window !== "undefined" ? window.location.origin : "https://therenorecord.com";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;
const DEFAULT_DESCRIPTION =
  "A public-interest archive documenting court delay, ignored filings, pretrial detention harm, and procedural misconduct patterns in Washoe County, Nevada.";

interface SEOProps {
  title?: string;
  description?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  canonicalPath?: string;
  noIndex?: boolean;
}

function setMeta(name: string, content: string, property = false) {
  const attr = property ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useSEO({
  title,
  description = DEFAULT_DESCRIPTION,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = "website",
  canonicalPath,
  noIndex = false,
}: SEOProps = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Receipts for Due Process`;
    document.title = fullTitle;

    // Standard meta
    setMeta("description", description);
    if (noIndex) setMeta("robots", "noindex,nofollow");

    // Open Graph
    setMeta("og:type", ogType, true);
    setMeta("og:site_name", SITE_NAME, true);
    setMeta("og:title", fullTitle, true);
    setMeta("og:description", description, true);
    setMeta("og:image", ogImage, true);
    if (canonicalPath) {
      const canonical = `${SITE_URL}${canonicalPath}`;
      setMeta("og:url", canonical, true);
      setLink("canonical", canonical);
    }

    // Twitter / X card
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", description);
    setMeta("twitter:image", ogImage);
  }, [title, description, ogImage, ogType, canonicalPath, noIndex]);
}
