import type { Metadata } from "next";

const SITE = "https://radar.arvexo.ru";

/**
 * Flip to true once the English landing at /en is translated. Until then /en is
 * noindex and hreflang is not emitted, so search engines never see an
 * alternate that is really a copy of the Russian page.
 */
export const EN_READY = false;

export const localeUrls = { ru: `${SITE}/`, en: `${SITE}/en` } as const;

/** hreflang cluster; every locale must list itself and all its alternates. */
export function languageAlternates(): Metadata["alternates"] {
  if (!EN_READY) return undefined;
  return {
    languages: { ru: localeUrls.ru, en: localeUrls.en, "x-default": localeUrls.ru },
  };
}
