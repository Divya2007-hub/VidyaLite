# VidyaLite

VidyaLite is a static, offline-capable learning app. Local practice and saved progress work without a configured account service. Account sign-in, teacher-created student accounts, cross-device sync, and shared teacher reports require Supabase.

## Local development

Install Node.js 18 or newer, then run:

```sh
npm install
npm run build
```

Serve this directory over HTTP (not `file://`) to test IndexedDB and the service worker. For example, with Vercel CLI run `vercel dev`.

## Supabase setup

1. Create a Supabase project and run [`supabase/schema.sql`](./supabase/schema.sql) in its SQL Editor.
2. In Authentication, create the initial teacher account. Copy its Auth user UUID, then add its profile in the SQL Editor:

   ```sql
   insert into public.profiles (id, role, display_name, email)
   values ('AUTH_USER_UUID', 'teacher', 'Teacher name', 'teacher@example.com');
   ```

   Teacher accounts are provisioned by an administrator; there is no public teacher or student sign-up.
3. Configure these Vercel environment variables for the target deployment:
   - `SUPABASE_URL`: the project URL shown in Supabase project settings (not the VidyaLite website URL).
   - `SUPABASE_ANON_KEY`: the project's publishable/anon key.
   - `SUPABASE_SERVICE_ROLE_KEY`: the server-only service role key. Never expose it in browser code or commit it.
4. Deploy/redeploy. The browser receives only the project URL and anon key from `/api/config`; server functions keep the service-role key private.
5. Students sign in with email/password accounts created by their teacher. Teachers create those accounts from the teacher dashboard. Keep initial passwords private and ask students to change them through Supabase's account recovery flow.

Without these settings, local practice remains available and account/sync actions show an explicit configuration error rather than simulating success.
