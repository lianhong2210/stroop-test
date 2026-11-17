import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms · Stroop",
  description: "The rules for playing Stroop and using its leaderboard.",
};

const UPDATED = "16 November 2026";

export default function TermsPage() {
  return (
    <main className="shell policy-shell">
      <div className="room-light" aria-hidden />
      <article className="paper policy">
        <h2>Terms of service</h2>
        <p className="paper-meta">
          Stroop · stroop.lianhonglim.my · last updated {UPDATED}
        </p>

        <hr />

        <p>
          Stroop is a free browser game made by an independent developer. By
          playing it or signing in, you agree to these terms. If you
          don&apos;t agree, please don&apos;t use the game.
        </p>

        <h3>Health warning</h3>
        <p>
          The game uses flashing colours, flickering light effects, screen
          shake and sudden sounds. If you have photosensitive epilepsy or are
          sensitive to flashing lights, don&apos;t play. Stop at once if you
          feel dizzy, unwell or disoriented. Turning on your system&apos;s
          &ldquo;reduce motion&rdquo; setting switches most effects off.
        </p>

        <h3>Accounts</h3>
        <ul>
          <li>
            You can play without an account. Signing in with Google is
            optional and only needed for the leaderboard.
          </li>
          <li>Use one account, your own, and keep it to yourself.</li>
          <li>
            Choose a username that isn&apos;t offensive, hateful, sexual,
            misleading, or someone else&apos;s name or brand. A username that
            breaks this may be changed back to a random one without notice.
          </li>
          <li>
            You can delete your account at any time from the account form in
            the game.
          </li>
        </ul>

        <h3>Fair play</h3>
        <p>
          Leaderboard scores must come from you playing the game yourself.
          Don&apos;t use bots, scripts, auto-clickers or other automation,
          don&apos;t tamper with the game, its requests or its servers, and
          don&apos;t try to get around the bot check or the score checks.
          Runs that fail those checks aren&apos;t counted. A top score may be
          held for a manual check before it appears. Scores that appear
          to have been obtained unfairly may be removed, and accounts behind
          them may be suspended or deleted.
        </p>

        <h3>The leaderboard</h3>
        <p>
          The leaderboard is offered for fun. It may be corrected, reset or
          removed at any time, for example after a rule change or to undo
          cheating. Rankings carry no prize or reward.
        </p>

        <h3>The game itself</h3>
        <p>
          The game, its code, artwork, music and sounds belong to its
          developer, except the fonts (Anton and Special Elite, used under the
          SIL Open Font License) and the services listed in the{" "}
          <Link href="/privacy">privacy policy</Link>. The Stroop effect it is
          built on is a psychology experiment from 1935 that anyone may use.
          Stroop is an independent project and is not connected to any other
          game or company.
        </p>
        <p>
          The game is provided &ldquo;as is&rdquo;, without guarantees that it
          will always be available, free of errors, or that your progress or
          scores will be kept. It may be changed, paused or shut down at any
          time. As far as the law allows, the developer isn&apos;t liable for
          any loss or harm that comes from using it.
        </p>
        <p>
          The game measures reaction time for entertainment. It is not a
          medical, psychological or cognitive assessment.
        </p>

        <h3>Privacy</h3>
        <p>
          What the game stores, and how to delete it, is described in the{" "}
          <Link href="/privacy">privacy policy</Link>.
        </p>

        <h3>Changes</h3>
        <p>
          These terms may be updated; the date at the top will change when
          they are. Continuing to play after a change means you accept the
          updated terms.
          {CONTACT_EMAIL && (
            <>
              {" "}
              Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </>
          )}
        </p>

        <div className="paper-actions">
          <Link className="act" href="/">
            ◂ Back to the game
          </Link>
        </div>
      </article>
      <div className="grain" aria-hidden />
      <div className="vignette" aria-hidden />
    </main>
  );
}
