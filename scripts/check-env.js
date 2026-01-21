// Check required env vars early during build
const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
];

const missing = required.filter((k) => !process.env[k]);

if (missing.length) {
    console.error('\n\u274C Missing required environment variables: ' + missing.join(', '));
    console.error('\nPlease add them in Railway → Project → Variables (or in your .env) and redeploy.');
    process.exit(1);
}

console.log('✅ All required environment variables present: ' + required.join(', '));
