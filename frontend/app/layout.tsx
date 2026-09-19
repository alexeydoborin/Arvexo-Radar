import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
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
      <body>
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`
            (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j=0; j<document.scripts.length; j++) {
                if (document.scripts[j].src===r) return;
              }
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a);
            })(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=112824798','ym');
            ym(112824798,'init',{ssr:true,webvisor:true,clickmap:true,ecommerce:'dataLayer',referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});
          `}
        </Script>
        <noscript>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://mc.yandex.ru/watch/112824798"
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </div>
        </noscript>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
