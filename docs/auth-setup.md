# Sentinel Atlas auth setup

Use these Supabase Dashboard steps when you are ready to enable browser-based email/password authentication.

1. Open your Supabase project dashboard.
2. Go to Authentication > Settings.
3. Set Site URL to your local development origin, for example `http://localhost:5173`.
4. Add a local redirect URL for authentication flows, for example `http://localhost:5173/auth`.
5. In Email auth, enable email/password sign-ins.
6. Configure email confirmation behaviour for your desired experience. For a simple local preview, you can disable email confirmation; for a stricter flow, leave it enabled and use the confirmation pending state in the app.
7. Set the password reset redirect URL to `http://localhost:5173/auth`.
8. Ensure the browser client uses the published anon key from the project settings and the matching `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` values.
9. Confirm the `public.profiles` table is available for the authenticated user to read and write their own row.
