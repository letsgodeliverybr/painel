-- Os cron jobs que chamam Edge Functions via net.http_post (despacho-engine,
-- ifood-polling, ifood-status-sync) tinham a service role key hardcoded em
-- texto puro dentro de cron.job.command — visível pra qualquer role com
-- SELECT no schema cron, e agora também exposta numa conversa. Migrado pro
-- Supabase Vault (extensão supabase_vault, já instalada), que criptografa
-- em repouso e só é legível por `postgres`/`service_role` via
-- vault.decrypted_secrets — nem anon nem authenticated têm acesso.
--
-- A chave em si NÃO fica neste arquivo (nem em nenhum outro arquivo
-- versionado) — foi inserida diretamente no banco via
-- vault.create_secret(valor, 'cron_dispatch_key', ...). Rotação futura:
-- vault.update_secret(<secret_id>, '<novo_valor>') — nenhum cron job
-- precisa ser editado depois, todos referenciam o secret pelo nome.
--
-- Este arquivo documenta só a ALTERAÇÃO DE PADRÃO (de literal pra lookup),
-- não o valor. Para reproduzir em outro ambiente, rode antes:
--   select vault.create_secret('<service_role_ou_secret_key>', 'cron_dispatch_key', '...');

select cron.alter_job(job_id := 2, command := $$
  select net.http_post(
    url := 'https://astbkmpegcmqljltmdpx.supabase.co/functions/v1/despacho-engine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_dispatch_key')
    ),
    body := '{}'::jsonb
  );
$$);

select cron.alter_job(job_id := 6, command := $$
  select net.http_post(
    url := 'https://astbkmpegcmqljltmdpx.supabase.co/functions/v1/ifood-polling',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_dispatch_key')
    ),
    body := '{}'::jsonb
  );
$$);

select cron.alter_job(job_id := 7, command := $$
  select net.http_post(
    url := 'https://astbkmpegcmqljltmdpx.supabase.co/functions/v1/ifood-status-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_dispatch_key')
    ),
    body := '{}'::jsonb
  );
$$);
