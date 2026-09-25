/* ==================================================================
 * Supabase-oppsett for Freerider-ruter.
 *
 * VIKTIG: Fyll inn dine egne verdier under før dette tas i bruk.
 * Begge verdiene er trygge å ha i klientkoden (de er ikke hemmelige —
 * det er Supabase sine Row Level Security-regler som faktisk
 * beskytter dataene, se supabase_schema.sql).
 *
 * Du finner disse under Project Settings → API i Supabase-prosjektet
 * ditt, etter at du har fulgt SETUP.md.
 * ================================================================== */

const SUPABASE_URL = "https://dosiwzxfzhfhwapmjxam.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_...(din faktiske nøkkel)...";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Henter aktiv innlogget økt, eller sender brukeren til login.html
 * hvis ingen gyldig økt finnes. Kall denne øverst på sider som krever
 * innlogging (f.eks. app.html).
 *
 * Bruker getUser() (ikke bare getSession()) fordi getSession() bare
 * leser det som ligger lagret lokalt i nettleseren — den sjekker ikke
 * at brukeren faktisk fortsatt finnes i databasen. Uten denne
 * kontrollen kan en "foreldreløs" økt (f.eks. etter at en konto er
 * slettet på en annen enhet) se gyldig ut helt til man faktisk prøver
 * å lagre noe, og da feiler det med en kryptisk databasefeil i stedet
 * for å sende brukeren til innlogging slik den burde.
 */
async function requireSession() {
  const { data: sessionData, error: sessionError } = await sb.auth.getSession();
  if (sessionError || !sessionData.session) {
    window.location.href = "login.html";
    return null;
  }

  const { error: userError } = await sb.auth.getUser();
  if (userError) {
    // Økten er foreldreløs eller ugyldig — rydd den bort og send til innlogging.
    await sb.auth.signOut();
    window.location.href = "login.html";
    return null;
  }

  return sessionData.session;
}

async function signOut() {
  await sb.auth.signOut();
  window.location.href = "index.html";
}
