import type { Metadata } from "next";
import { Landing } from "../../components/Landing";
import { ResearchSection } from "../../components/ResearchSection";
import { EN_READY, languageAlternates, localeUrls } from "../../lib/i18n";

const title = "Arvexo Radar — AI prompt analytics and ROI";
const description =
  "Arvexo Radar analyzes prompts sent to AI agents: it classifies use cases, measures effectiveness and ROI, and turns what works into company-wide best practices.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: localeUrls.en, ...languageAlternates() },
  robots: EN_READY ? { index: true, follow: true } : { index: false, follow: true },
  openGraph: { type: "website", locale: "en_US", url: localeUrls.en, siteName: "Arvexo Radar", title, description },
  twitter: { card: "summary_large_image", title, description },
};

// TODO(i18n): Landing copy is still Russian; translate it (and switch EN_READY) before indexing.
export default function EnglishHomePage() {
  return <Landing research={<ResearchSection />} />;
}
