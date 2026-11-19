import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { DIFFICULTIES } from "@/lib/difficulty";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/pageMetadata";
import { PAGE_UPDATED, SITE_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata(
  "How to play the Stroop effect test",
  "What the Stroop effect is, how to play Stroop, the Easy, Normal and Hard modes, scoring, the leaderboard, and tips for naming the ink faster.",
  "/how-to-play",
);

const secs = (ms: number) => `${ms / 1000} second${ms === 1000 ? "" : "s"}`;

/** The visible modes. The hidden one after Hard stays a secret here too. */
const MODES = Object.values(DIFFICULTIES).filter((d) => !d.hidden);

/**
 * Questions people search for. Shown on the page and repeated as FAQPage
 * structured data; the two must say the same thing.
 */
const FAQ: { q: string; a: string }[] = [
  {
    q: "Is Stroop free?",
    a: "Yes. It's free to play in your browser, with no download and no ads. You don't need an account unless you want your scores on the leaderboard.",
  },
  {
    q: "Can I play on my phone?",
    a: "Yes. Stroop works in the browser on phones, tablets and computers. Tap the answers on a touch screen, or use keys 1 to 9 on a keyboard.",
  },
  {
    q: "Do I need sound?",
    a: "No, but it's better with it. A voice reads each word aloud to pull you towards the wrong answer. You can play without sound, or switch the voice off under Voice in the menu.",
  },
  {
    q: "Is this a real Stroop test?",
    a: "It uses the same colour-word conflict as the classic Stroop experiment, with time limits, a voice and a horror setting added. It's a game, not a clinical or psychological assessment, and the score says nothing about your health.",
  },
  {
    q: "Why is the Stroop test so hard?",
    a: "Because reading is automatic for practised readers. The word is understood before you decide to read it, so naming the ink means overriding an answer your brain has already produced.",
  },
  {
    q: "How do I get on the leaderboard?",
    a: "Sign in with Google from the menu. Every run you play while signed in is checked by the server, and your best score in each mode counts. The board shows the top five per mode.",
  },
];

const STRUCTURED_DATA = {
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/how-to-play`,
      url: `${SITE_URL}/how-to-play`,
      name: "How to play the Stroop effect test",
      inLanguage: "en",
      dateModified: PAGE_UPDATED.howToPlay,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#game` },
      breadcrumb: breadcrumbJsonLd("How to play", "/how-to-play"),
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

export default function HowToPlayPage() {
  return (
    <main className="shell policy-shell">
      <div className="room-light" aria-hidden />
      <JsonLd data={STRUCTURED_DATA} />
      <article className="paper policy">
        <h1>How to play Stroop</h1>
        <p className="paper-meta">Stroop · the Stroop effect test, played as a horror game</p>

        <hr />

        <p>
          A colour word appears, like <strong>RED</strong>, painted in a
          different ink, like green. Name the colour of the <em>ink</em>, not
          the word. It sounds easy. Your brain reads the word before you can
          stop it, and a voice reads it aloud to make it worse.
        </p>

        <div className="paper-actions">
          <Link className="act act-primary" href="/">
            ▸ Play now, free in your browser
          </Link>
        </div>

        <h2>What is the Stroop effect?</h2>
        <p>
          The Stroop effect is the delay you feel when a word and its colour
          disagree. Psychologist J. Ridley Stroop described it in 1935: people
          name the ink of a word like &ldquo;BLUE&rdquo; printed in red more
          slowly, and make more mistakes, than when they name a plain block of
          red. Reading is so practised that it happens automatically, and
          stopping it takes effort.
        </p>
        <p>
          The Stroop test is one of the best-known experiments in psychology
          and is used to study attention and self-control. This game turns it
          into a challenge you can play: how fast, and how accurately, can you
          ignore what you read and hear?
        </p>

        <h2>How a run works</h2>
        <ul>
          <li>A colour word appears in an ink. Pick the ink&apos;s colour from the panel of answers.</li>
          <li>
            Click or tap an answer, or press keys <kbd>1</kbd> to <kbd>9</kbd>{" "}
            for the answers in order. <kbd>Esc</kbd> quits a run.
          </li>
          <li>
            Most of the time the word and the ink disagree. Now and then they
            match, so you can&apos;t simply rule out the word.
          </li>
          <li>
            Each word has a time limit. Too slow counts as a miss.
          </li>
          <li>
            A voice reads every word aloud. Play with sound on and headphones
            for the full effect, or switch the voice off under{" "}
            <strong>Voice</strong> in the menu.
          </li>
        </ul>

        <h2>Modes</h2>
        <p>Each mode opens when you pass the one before it.</p>
        <ul>
          {MODES.map((m) => (
            <li key={m.id}>
              <strong>{m.label}:</strong> {m.options} ink colours, {m.rounds}{" "}
              words, {secs(m.roundMs)} each. Pass with {m.goal} of {m.rounds}{" "}
              correct{m.goal === m.rounds ? ", so no mistakes at all" : ""}.
            </li>
          ))}
        </ul>
        <p>Pass Hard, and you&apos;ll find the file isn&apos;t closed.</p>

        <h2>Scores and the leaderboard</h2>
        <p>
          Your score is the number of inks you named correctly. Equal scores
          are ranked by average reaction time on correct answers, so faster is
          better. Your progress is saved in your browser as you play.
        </p>
        <p>
          Sign in with Google to put your runs on the leaderboard, which shows
          the top five players in each mode. Every ranked run is checked by
          the server, so scores have to be played, not typed in.
        </p>

        <h2>Tips for a better score</h2>
        <ul>
          <li>Look at the edge of a letter rather than the whole word. It makes reading a little harder.</li>
          <li>Learn where each colour sits on the panel, so your eyes only have to find the ink.</li>
          <li>Don&apos;t rush after a mistake. Errors cluster when you try to win time back.</li>
          <li>Take a break between runs. Holding back reading gets harder when you&apos;re tired.</li>
        </ul>

        <h2>Questions</h2>
        {FAQ.map(({ q, a }) => (
          <div key={q} className="faq">
            <h3>{q}</h3>
            <p>{a}</p>
          </div>
        ))}

        <h2>Good to know</h2>
        <p>
          Stroop is a game, not a medical or psychological assessment, and its
          scores say nothing about your health. It uses flickering and
          flashing effects; if you are sensitive to them, please take care.
          See the <Link href="/terms">terms</Link> and the{" "}
          <Link href="/privacy">privacy policy</Link> for more.
        </p>

        <div className="paper-actions">
          <Link className="act act-primary" href="/">
            ▸ Play Stroop
          </Link>
        </div>
      </article>
      <div className="grain" aria-hidden />
      <div className="vignette" aria-hidden />
    </main>
  );
}
