export async function handler() {
  const keys = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
  ];
  const report = Object.fromEntries(
    keys.map((k) => [k, !!process.env[k]])
  );
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(report, null, 2),
  };
}
