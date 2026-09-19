import type { MetadataRoute } from "next";
import { EN_READY, localeUrls } from "../lib/i18n";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const languages = EN_READY ? { ru: localeUrls.ru, en: localeUrls.en } : undefined;
  return [
    { url: localeUrls.ru, lastModified, changeFrequency: "weekly", priority: 1, alternates: languages && { languages } },
    ...(EN_READY
      ? [{ url: localeUrls.en, lastModified, changeFrequency: "weekly" as const, priority: 0.9, alternates: { languages: languages! } }]
      : []),
  ];
}
