-- Cardápio Digital — Fase 1
-- Tabelas de categorias e produtos por loja.
-- Isolamento por loja_id aplicado na camada de aplicação (anon key, padrão do projeto).

create table if not exists public.cardapio_categorias (
  id         uuid        primary key default gen_random_uuid(),
  loja_id    uuid        not null references public.lojas(id) on delete cascade,
  nome       text        not null,
  ordem      integer     not null default 0,
  ativo      boolean     not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_cardapio_categorias_loja on public.cardapio_categorias(loja_id, ordem);

create table if not exists public.cardapio_produtos (
  id           uuid        primary key default gen_random_uuid(),
  loja_id      uuid        not null references public.lojas(id) on delete cascade,
  categoria_id uuid        references public.cardapio_categorias(id) on delete set null,
  nome         text        not null,
  descricao    text,
  preco        numeric(10,2) not null default 0,
  foto_url     text,
  disponivel   boolean     not null default true,
  ordem        integer     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_cardapio_produtos_loja     on public.cardapio_produtos(loja_id, ordem);
create index if not exists idx_cardapio_produtos_categoria on public.cardapio_produtos(categoria_id, ordem);

alter table public.cardapio_categorias enable row level security;
alter table public.cardapio_produtos     enable row level security;

-- O painel usa a anon key diretamente; isolamento por loja_id é feito na aplicação.
create policy "anon_all_cardapio_categorias" on public.cardapio_categorias
  for all to anon using (true) with check (true);

create policy "anon_all_cardapio_produtos" on public.cardapio_produtos
  for all to anon using (true) with check (true);

-- Storage: bucket cardapio-fotos criado via Management API (já existe).
-- Policy de upload público para anon (painel e futura app de cliente).
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('cardapio-fotos', 'cardapio-fotos', true,
        array['image/jpeg','image/png','image/webp'], 2097152)
on conflict (id) do nothing;

create policy "anon_upload_cardapio_fotos" on storage.objects
  for insert to anon with check (bucket_id = 'cardapio-fotos');

create policy "public_read_cardapio_fotos" on storage.objects
  for select using (bucket_id = 'cardapio-fotos');

create policy "anon_delete_cardapio_fotos" on storage.objects
  for delete to anon using (bucket_id = 'cardapio-fotos');
