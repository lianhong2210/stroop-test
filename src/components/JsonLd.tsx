/** Structured data for search engines, as a JSON-LD script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // "<" escaped so text in the data can never close the script tag.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c"),
      }}
    />
  );
}
