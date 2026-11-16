# Backend setup: Google, Supabase and Cloudflare

These are the dashboard steps for adding accounts and a leaderboard to the game:

- **Google sign-in** (through Supabase) ties scores to an account.
- **Cloudflare Turnstile** runs an invisible bot check before a run counts.
- **Supabase** stores players, runs and best scores. Two Edge Functions check Turnstile and the scores.
- **The site stays static** on Cloudflare Pages.

Work through the parts in order. Each one needs a value from the part before it.

> **Keep secrets out of git.** `.gitignore` already ignores every `.env*` file. Only the three `NEXT_PUBLIC_…` values are safe in the browser. Never put the Google client secret, the Turnstile secret key or the Supabase secret key in app code or in Cloudflare Pages.

---

## The values you will collect

| Value | Looks like | Public? | Where it ends up |
| --- | --- | --- | --- |
| Supabase project URL | `https://abcd1234.supabase.co` | yes | Pages env, `.env.local` |
| Supabase project ref | `abcd1234` | yes | Google redirect URI, Supabase CLI |
| Supabase publishable key | `sb_publishable_…` (or the legacy `anon` key) | yes | Pages env, `.env.local` |
| Google client ID | `…apps.googleusercontent.com` | yes | Supabase Google provider, Pages env, `.env.local` |
| Google client secret | `GOCSPX-…` | **no** | Supabase Google provider only |
| Turnstile site key | `0x4AAAA…` | yes | Pages env, `.env.local` |
| Turnstile secret key | `0x4AAAA…` | **no** | Supabase Edge Function secrets only |

---

## Part 1: Supabase project details

1. Open your project at <https://supabase.com/dashboard>.
2. Go to **Project Settings → General** and copy the **Project ID**. This is the *project ref*, for example `abcd1234`.
3. Go to **Project Settings → API Keys** and copy the **publishable key**.
   - If the project only shows legacy keys, use the **`anon` public** key. It does the same job.
   - **Don't copy** the secret / `service_role` key into anything. The Edge Functions receive it automatically.
4. Your Google callback URL is:

   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

   You can copy the exact URL from **Authentication → Sign In / Providers → Google**. Don't enable the provider yet.

---

## Part 2: Google Cloud (OAuth client)

Open <https://console.cloud.google.com> and sign in with the Google account that should own the app.

### 2.1 Project
1. Use the project picker at the top and choose **New project**. Name it something like `stroop`.
2. Make sure the new project is selected before you continue.

### 2.2 Google Auth Platform: branding and audience
1. Search for **Google Auth Platform** and click **Get started**.
2. Fill in **App information**:
   - **App name:** `Stroop`. Players see this on the Google consent screen.
   - **User support email:** your email.
3. **Audience:** choose **External**.
4. **Contact information:** your email. Agree to the policy and click **Create**.
5. Open **Branding**:
   - **Application home page:** `https://stroop.lianhonglim.my`
   - **Privacy policy link:** `https://stroop.lianhonglim.my/privacy`. **Required:** Google won't let you publish an External app without one. The page is in the game at `src/app/privacy/page.tsx`, so deploy it before filling this in.
   - **Terms of service link:** `https://stroop.lianhonglim.my/terms`. Optional for publishing, but include it when you request brand verification.
   - **Authorized domains:** add `lianhonglim.my` and `<project-ref>.supabase.co`.
   - **Don't upload a logo.** A logo makes Google require brand verification before the consent screen shows it.
6. Open **Data Access → Add or remove scopes** and tick only these three:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`

   These are basic scopes, so Google doesn't need to review the app.
7. Open **Audience** and click **Publish app** so it is **In production**.
   - Left in **Testing**, only test users you add by hand can sign in, and their sign-ins expire after 7 days.
   - With basic scopes, publishing takes effect straight away.

### 2.3 OAuth client
1. Open **Clients → Create client**.
2. **Application type:** Web application. **Name:** `Stroop web`.
3. **Authorized JavaScript origins:** the game's "Sign in with Google" button opens Google's pop-up from these pages, so every address you play on must be listed.
   - `https://stroop.lianhonglim.my`
   - `http://localhost`. Google also needs the bare `localhost`, without a port, for local testing.
   - `http://localhost:3000`
   - `http://localhost:3100`
4. **Authorized redirect URIs:** add exactly one:
   - `https://<project-ref>.supabase.co/auth/v1/callback`

   Google redirects to Supabase, not to the game. Supabase then sends the player back to the game.
5. Click **Create** and **copy the client ID and client secret immediately**. The Google console may not show the secret again. If you lose it, add a new secret to the client.

---

## Part 3: Supabase authentication

### 3.1 Turn on Google
1. Go to **Authentication → Sign In / Providers → Google** and switch on **Enable Sign in with Google**.
2. Paste the **Client ID** into *Client IDs* and the **Client Secret** into *Client Secret (for OAuth)*.
3. Leave **Skip nonce checks** off and **Allow users without an email** off, then click **Save**.
4. Optional: in **Sign In / Providers → Email**, turn the email provider off, so that Google is the only way to create an account.
   - **Don't** turn off **Allow new users to sign up** in the general auth settings. That would block Google sign-ups too.

### 3.2 Where players may be sent back to
Go to **Authentication → URL Configuration**:

- **Site URL:** `https://stroop.lianhonglim.my`
- **Redirect URLs:** click *Add URL* for each of these.

  | URL | What it's for |
  | --- | --- |
  | `https://stroop.lianhonglim.my/**` | the live site |
  | `http://localhost:3000/**` | local dev |
  | `http://localhost:3100/**` | local dev |
  | `http://192.168.*.*:3000/**` | phone on your Wi-Fi (adjust if your network isn't `192.168.x.x`) |
  | `https://*.<your-pages-project>.pages.dev/**` | Cloudflare preview deployments (optional) |

A wrong or missing entry here sends the player to the Site URL after sign-in instead of the page they came from.

### 3.3 Turnstile secret for the Edge Functions
Do this after Part 4 gives you the Turnstile secret key.

1. Go to **Edge Functions → Secrets** (or **Project Settings → Edge Functions**) and add:

   | Name | Value |
   | --- | --- |
   | `TURNSTILE_SECRET_KEY` | the Turnstile **secret** key |

2. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are already available to every function. Don't add them yourself.

### 3.4 Database tables
You don't need to create anything by hand. The tables are:

- `profiles`
- `runs`
- `best_scores`
- the `leaderboard` view

They come as a migration in `supabase/migrations/`, together with the row-level security rules, and are applied with the Supabase CLI (Part 6).

### 3.5 Free plan note
Supabase pauses free projects after about a week with no activity. A paused project means sign-in and the leaderboard stop working until you press **Restore** in the dashboard. The game itself still loads and plays.

---

## Part 4: Cloudflare Turnstile

1. Open <https://dash.cloudflare.com> and go to **Turnstile → Add widget**.
2. **Widget name:** `Stroop`.
3. **Hostnames:**
   - `stroop.lianhonglim.my`
   - `localhost`, so desktop dev works with the real keys
   - optionally `<your-pages-project>.pages.dev` for preview deployments
4. **Widget mode: Invisible.** Players never see a box or puzzle. A visitor who fails the check can still play, but their score won't be posted.
   - **Managed** would instead show a checkbox to the rare suspicious visitor.
5. **Pre-clearance:** No.
6. Click **Create**, then copy the **Site key** (public) and the **Secret key** (private).
   - The secret key goes into Supabase (Part 3.3).
   - The site key goes into Pages (Part 5) and `.env.local` (Part 6).

**Phone testing on your Wi-Fi:** Turnstile can't allow a raw IP address such as `192.168.1.20`. On a phone, test the Turnstile step on the live site or a Pages preview instead. Everything else works over Wi-Fi as usual.

Cloudflare also has dummy keys for automated tests, such as the always-passing site key `1x00000000000000000000AA` with secret `1x0000000000000000000000000000000AA`.
- A dummy token is only accepted by the dummy secret, so dummy keys won't work against the deployed Edge Function.
- **Never** put a dummy secret in production: it accepts any token.

---

## Part 5: Cloudflare Pages settings

1. Open **Workers & Pages → your Stroop project → Settings → Variables and Secrets**.
2. Add these as **Text** variables (not *Secret*: the build needs them, and they're public anyway). Add them to both **Production** and **Preview**.

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable (or `anon`) key |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | the Turnstile site key |
   | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | the Google **client ID** from Part 2.3 (`….apps.googleusercontent.com`), never the secret |

3. Leave the build settings as they are: build command `npm run build`, output directory `out`.
4. `NEXT_PUBLIC_…` values are copied into the page at build time. **After changing any of them, start a new deployment** (push a commit, or *Deployments → Retry deployment*).

---

## Part 6: Your machine

### 6.1 `.env.local`
Create `.env.local` in the project root. It is already git-ignored.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAA...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
```

Restart `npm run dev` after creating or changing it.

### 6.2 Supabase CLI
The CLI applies the database migration and deploys the Edge Functions.

1. Install it:

   ```bash
   brew install supabase/tap/supabase
   ```

2. Sign in:

   ```bash
   supabase login
   ```

3. Link this folder to your project:

   ```bash
   supabase link --project-ref <project-ref>
   ```

Docker is only needed if you want to run a full Supabase stack locally. It isn't needed to push migrations or deploy functions.

### 6.3 Create the tables
Push the migration in `supabase/migrations/` to your project:

```bash
supabase db push
```

This creates:
- the `profiles`, `runs` and `best_scores` tables, with their access rules
- the leaderboard and account functions
- the trigger that gives each new player a random `Subject-#####` name

To check, open **Table Editor** in the dashboard. The three tables should be listed, each marked RLS enabled.

### 6.4 Deploy the Edge Functions
```bash
supabase functions deploy start-run --no-verify-jwt
```

```bash
supabase functions deploy finish-run --no-verify-jwt
```

`--no-verify-jwt` matches `supabase/config.toml`: the functions check the player's session themselves, which works with the new API keys.

The functions also need `TURNSTILE_SECRET_KEY` from Part 3.3. Check that it's set:

```bash
supabase secrets list
```

**Redeploy both functions whenever `supabase/functions/_shared/stroop.ts` changes.** That file holds the rounds, timings and pass marks, and the server replays runs with it. If the server's copy and the game's copy differ, every ranked run is rejected.

---

## Part 7: Check it works

Once the app code is in place:

1. On `http://localhost:3000`, click **Sign in with Google**.
   - You go to Google, then come back signed in.
   - In Supabase, **Authentication → Users** lists you.
2. Start a run. No captcha appears. In Supabase, **Edge Functions → start-run → Logs** shows a successful Turnstile check.
3. Finish a run. Your score appears in the leaderboard.
4. Repeat on `https://stroop.lianhonglim.my` after deploying.

### Common errors

| You see | Cause | Fix |
| --- | --- | --- |
| Google `Error 400: redirect_uri_mismatch` | Google's redirect URI isn't exactly the Supabase callback | In Google → Clients, set it to `https://<project-ref>.supabase.co/auth/v1/callback`, with no trailing slash |
| Google says "Access blocked: app is in testing" | App not published | Google Auth Platform → Audience → **Publish app** |
| **Publish app** is greyed out | App name, support email, home page or privacy policy URL missing on Branding | Fill in all four on the Branding page (privacy policy: `https://stroop.lianhonglim.my/privacy`) |
| After sign-in you land on the live site while testing locally | Local URL missing from Supabase Redirect URLs | Add it in Authentication → URL Configuration |
| Turnstile error `110200` / invalid domain | Hostname not on the widget | Add the hostname in Turnstile → widget → Hostnames |
| `start-run` reports `invalid-input-secret` | Wrong or missing secret in Supabase | Re-enter `TURNSTILE_SECRET_KEY` in Edge Function secrets |
| Leaderboard empty and requests fail on the live site | Pages env vars missing, or not redeployed after adding them | Check Part 5, then redeploy |
| Everything suddenly fails after a quiet week | Free Supabase project paused | Dashboard → **Restore project** |
