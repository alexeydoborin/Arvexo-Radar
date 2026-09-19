import { Landing } from "../components/Landing";
import { ResearchSection } from "../components/ResearchSection";
import { languageAlternates } from "../lib/i18n";
import type { Metadata } from "next";

export const metadata: Metadata = { alternates: { canonical: "/", ...languageAlternates() } };

const webApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Arvexo Radar",
  url: "https://radar.arvexo.ru/",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  inLanguage: "ru-RU",
  description:
    "Сервис аналитики промптов и запросов к ИИ-агентам: классификация сценариев, оценка эффективности, ROI и формирование лучших практик.",
  featureList: [
    "Классификация запросов к ИИ-агентам",
    "Поиск устойчивых сценариев использования",
    "Оценка эффективности и ROI",
    "Формирование лучших практик внедрения AI",
  ],
  publisher: {
    "@type": "Organization",
    name: "Arvexo",
    url: "https://arvexo.ru/",
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webApplicationSchema).replace(/</g, "\\u003c"),
        }}
      />
      <Landing research={<ResearchSection />} />
    </>
  );
}
