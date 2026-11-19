import type { Metadata } from "next";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/pageMetadata";
import Link from "next/link";
import { CONTACT_EMAIL, formatPageDate, PAGE_UPDATED } from "@/lib/site";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = pageMetadata(
  "Privacy",
  "What the Stroop game stores about you, and why.",
  "/privacy",
);

const UPDATED = formatPageDate(PAGE_UPDATED.privacy);

export default function PrivacyPage() {
  return (
    <main className="shell policy-shell">
      <div className="room-light" aria-hidden />
      <JsonLd data={breadcrumbJsonLd("Privacy", "/privacy")} />
      <article className="paper policy">
        <h1>Privacy</h1>
        <p className="paper-meta">
          Stroop · stroop.lianhonglim.my · last updated {UPDATED}
        </p>

        <hr />

        <p>
          Stroop is a free browser game made by an independent developer. This
          page explains what it stores about you. In short: very little, and
          nothing is sold or used for advertising.
        </p>

        <h2>Playing without an account</h2>
        <p>
          You can play without signing in. Your settings, unlocked modes and
          best scores are saved only in your own browser (local storage). They
          are not sent to us, and clearing your browser data erases them.
        </p>

        <h2>Signing in with Google</h2>
        <p>
          Signing in is optional and only needed to put scores on the
          leaderboard. Google&apos;s sign-in button is loaded from Google only
          when you open the sign-in form. When you sign in, Google shares your
          email address, name and profile picture with the game&apos;s sign-in
          service. These are stored as your account record so you can stay
          signed in. The email address is never shown to other players, and your
          Google name and picture are not used in the game.
        </p>
        <p>
          On the leaderboard you appear under a username. You get a random one
          (for example &ldquo;Subject-4821&rdquo;) and can change it at any
          time.
        </p>

        <h2>What is stored for your account</h2>
        <ul>
          <li>Your account record from Google sign-in, as described above.</li>
          <li>Your username.</li>
          <li>
            Runs you play while signed in: the mode, your answers and their
            timing, and your score. These are used to check that scores are
            genuine: an automatic check looks at how human the timing is, and
            a top score that looks unusual may be held until someone reviews
            it by hand.
          </li>
          <li>
            If your account is barred from ranked play for breaking the fair
            play rules, a note of that and the reason.
          </li>
          <li>Your best score and average reaction time for each mode.</li>
          <li>
            Your unlocked modes and personal bests, so they follow you to other
            devices. The first time you sign in, the progress you made as a
            guest on that device is copied to your account.
          </li>
        </ul>

        <h2>What is public</h2>
        <p>
          Your username, your best scores and your average reaction time can
          appear on the leaderboard. Nothing else about you is shown.
        </p>

        <h2>Bot check</h2>
        <p>
          When you start a run that can count for the leaderboard, Cloudflare
          Turnstile checks in the background that you are not a bot. Cloudflare
          processes technical information about your browser and connection to
          do this. There is no puzzle to solve.
        </p>

        <h2>Services the game uses</h2>
        <ul>
          <li>
            <strong>Cloudflare</strong> hosts the website and runs the bot
            check. Like any web host, it receives your IP address and browser
            details when you load the page.
          </li>
          <li>
            <strong>Supabase</strong> stores accounts, usernames and scores, and
            handles sign-in.
          </li>
          <li>
            <strong>Google</strong> provides the &ldquo;Sign in with
            Google&rdquo; option.
          </li>
        </ul>
        <p>
          The game has no ads, no analytics and no tracking cookies. Signing in
          keeps a session token in your browser so you stay signed in.
        </p>

        <h2>Deleting your data</h2>
        <p>
          Your account data is kept until you delete it. Choose{" "}
          <em>Delete account</em> in the game&apos;s account menu to remove your
          account, username, runs and scores permanently.
          {CONTACT_EMAIL && (
            <>
              {" "}
              You can also email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> to ask for
              your data to be deleted or to ask what is stored.
            </>
          )}
        </p>

        <h2>Changes</h2>
        <p>
          If this policy changes, the date at the top of this page will be
          updated. The rules for playing are in the{" "}
          <Link href="/terms">terms of service</Link>.
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
