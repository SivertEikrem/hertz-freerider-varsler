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
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvc2l3enhmemhmaHdhcG1qeGFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwODg5MTIsImV4cCI6MjEwNTY2NDkxMn0.h9Xk-8YJ6adF3IWZlHYpfXSiNsZrpDd11SWoX4av8rE";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Henter aktiv innlogget økt, eller sender brukeren til login.html
 * hvis ingen økt finnes. Kall denne øverst på sider som krever
 * innlogging (f.eks. app.html).
 */
async function requireSession() {
  const { data, error } = await sb.auth.getSession();
  if (error || !data.session) {
    window.location.href = "login.html";
    return null;
  }
  return data.session;
}

async function signOut() {
  await sb.auth.signOut();
  window.location.href = "index.html";
}
