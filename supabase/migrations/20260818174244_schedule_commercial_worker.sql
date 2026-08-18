create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'viks_project_url') then
    perform vault.create_secret('https://spiobabjyzxtyhcedung.supabase.co', 'viks_project_url', 'Viks worker project URL');
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'viks_worker_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'viks_worker_secret', 'Viks scheduled worker secret');
  end if;
end;
$$;

create function private.verify_worker_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_secret is not null and exists (
    select 1 from vault.decrypted_secrets
    where name = 'viks_worker_secret'
      and extensions.digest(decrypted_secret, 'sha256') = extensions.digest(p_secret, 'sha256')
  );
$$;

revoke execute on function private.verify_worker_secret(text) from public, anon, authenticated;
grant execute on function private.verify_worker_secret(text) to service_role;

create function public.verify_worker_secret(p_secret text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.verify_worker_secret(p_secret); $$;

revoke execute on function public.verify_worker_secret(text) from public, anon, authenticated;
grant execute on function public.verify_worker_secret(text) to service_role;

select cron.schedule(
  'viks-commercial-worker',
  '* * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'viks_project_url') || '/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'viks_worker_secret')
      ),
      body := jsonb_build_object('scheduled_at', now()),
      timeout_milliseconds := 10000
    ) as request_id;
  $job$
);
