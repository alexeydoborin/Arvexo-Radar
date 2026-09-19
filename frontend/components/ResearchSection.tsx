import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { getLatestResearch } from "@/lib/research";

const LIST_URL = "https://arvexo.ru/ru/research";

export async function ResearchSection() {
  const notes = await getLatestResearch(3);
  if (notes.length === 0) return null;

  return (
    <section className="insights-section" id="ресурсы">
      <div className="insights-heading">
        <h2>Новые исследования</h2>
        <a className="secondary-action" href={LIST_URL}>Все материалы</a>
      </div>
      <div className="insights-grid">
        {notes.map((note) => (
          <a className="rp-insight-card" href={note.url} key={note.slug}>
            <span>Исследование</span>
            <h3>{note.title}</h3>
            {note.excerpt && <p>{note.excerpt}</p>}
            <b>Читать <ArrowRight size={15} /></b>
          </a>
        ))}
      </div>
    </section>
  );
}
