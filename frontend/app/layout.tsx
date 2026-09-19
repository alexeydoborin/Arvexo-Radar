import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";

const siteUrl = "https://radar.arvexo.ru";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Arvexo Radar — аналитика промптов и эффективности ИИ",
  description:
    "Arvexo Radar анализирует промпты и запросы к ИИ-агентам: классифицирует сценарии, измеряет эффективность, ROI и формирует лучшие практики внедрения AI.",
  applicationName: "Arvexo Radar",
  authors: [{ name: "Arvexo", url: "https://arvexo.ru" }],
  creator: "Arvexo",
  publisher: "Arvexo",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: siteUrl,
    siteName: "Arvexo Radar",
    title: "Arvexo Radar — аналитика промптов и эффективности ИИ",
    description:
      "Классификация запросов к ИИ-агентам, карта сценариев, оценка ROI и лучшие практики внедрения AI.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Arvexo Radar — аналитика промптов и эффективности ИИ",
    description:
      "Классификация запросов к ИИ-агентам, карта сценариев, оценка ROI и лучшие практики внедрения AI.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
