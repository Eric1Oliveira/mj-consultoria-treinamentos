-- =============================================================================
-- MJ Consultoria — estrutura completa do banco (Supabase / PostgreSQL)
--
-- Como aplicar: Supabase → SQL Editor → colar este arquivo inteiro → Run.
-- Pode ser executado de novo: recria funções e políticas sem apagar dados.
--
-- Segurança:
--   * Toda tabela tem RLS. O navegador só LÊ o que o perfil pode ver.
--   * Nenhuma escrita direta: tudo passa por funções (RPC) que conferem a
--     permissão no servidor e gravam a auditoria.
--   * O gabarito das avaliações fica em tabela que só a equipe lê; a correção
--     é feita no servidor (enviar_avaliacao).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------------ tabelas --

create table if not exists public.empresas (
    id                  uuid primary key default gen_random_uuid(),
    nome                text not null check (char_length(nome) between 1 and 150),
    identificador       text not null unique check (char_length(identificador) <= 60 and identificador ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    cor                 text check (cor ~ '^#[0-9a-f]{6}$'),
    cor_secundaria      text check (cor_secundaria ~ '^#[0-9a-f]{6}$'),
    logo                text check (logo ~ '^data:image/(png|jpeg|webp|svg\+xml)[;,]' and octet_length(logo) <= 300000),
    academia            text not null default '' check (char_length(academia) <= 60),
    estilo_menu         text not null default 'escuro' check (estilo_menu in ('escuro', 'marca', 'claro')),
    cantos              text not null default 'suave' check (cantos in ('suave', 'reto', 'redondo')),
    fonte               text not null default 'marcante' check (fonte in ('marcante', 'classica', 'neutra')),
    capas_marca         boolean not null default false,
    ativa               boolean not null default true,
    mensagem            text not null default '' check (char_length(mensagem) <= 300),
    solicitacoes_ativas boolean not null default false,
    aprovador           text not null default 'empresa' check (aprovador in ('empresa', 'consultoria')),
    criado_em           timestamptz not null default now()
);

-- Uma linha por conta do Supabase Auth. Só é criada pelo aceite de convite
-- (ou manualmente, para o primeiro administrador).
create table if not exists public.perfis (
    id            uuid primary key references auth.users (id) on delete cascade,
    nome          text not null check (char_length(nome) between 1 and 120),
    email         text not null unique,
    perfil        text not null check (perfil in ('admin', 'consultant', 'company_admin', 'student')),
    empresa_id    uuid references public.empresas (id),
    ativo         boolean not null default true,
    idioma        text not null default 'pt-BR' check (char_length(idioma) <= 10),
    ultimo_acesso timestamptz,
    criado_em     timestamptz not null default now(),
    check ((perfil in ('company_admin', 'student')) = (empresa_id is not null))
);

create table if not exists public.convites (
    id            uuid primary key default gen_random_uuid(),
    email         text not null,
    perfil        text not null check (perfil in ('admin', 'consultant', 'company_admin', 'student')),
    empresa_id    uuid references public.empresas (id) on delete cascade,
    convidado_por uuid references public.perfis (id) on delete set null,
    codigo        text not null unique,
    criado_em     timestamptz not null default now(),
    expira_em     timestamptz not null,
    aceito_em     timestamptz,
    cancelado_em  timestamptz
);

create table if not exists public.solicitacoes (
    id           uuid primary key default gen_random_uuid(),
    empresa_id   uuid not null references public.empresas (id) on delete cascade,
    nome         text not null check (char_length(nome) between 1 and 120),
    email        text not null,
    mensagem     text not null default '' check (char_length(mensagem) <= 500),
    situacao     text not null default 'pendente' check (situacao in ('pendente', 'aprovada', 'recusada')),
    criado_em    timestamptz not null default now(),
    decidido_por uuid references public.perfis (id) on delete set null,
    decidido_em  timestamptz,
    motivo       text
);

-- modulos: [{ id, titulo, aulas: [{ id, titulo, tipo, minutos, conteudo, videoId }] }]
-- questoes: [{ id, enunciado, alternativas: [] }]  (SEM a resposta certa)
create table if not exists public.cursos (
    id                uuid primary key default gen_random_uuid(),
    titulo            text not null check (char_length(titulo) between 1 and 150),
    descricao         text not null default '' check (char_length(descricao) <= 600),
    carga_horaria     int not null default 1 check (carga_horaria between 1 and 400),
    nota_minima       int not null default 70 check (nota_minima between 0 and 100),
    tentativas        int not null default 3 check (tentativas between 1 and 10),
    ativo             boolean not null default false,
    avanco_automatico boolean not null default true,
    empresas          uuid[] not null default '{}',
    modulos           jsonb not null default '[]' check (jsonb_typeof(modulos) = 'array'),
    questoes          jsonb not null default '[]' check (jsonb_typeof(questoes) = 'array'),
    criado_em         timestamptz not null default now()
);

-- Gabarito: { "<id da questão>": <índice da alternativa certa> }. Só a equipe lê.
create table if not exists public.cursos_gabarito (
    curso_id  uuid primary key references public.cursos (id) on delete cascade,
    respostas jsonb not null default '{}'
);

-- tentativas: [{ em, nota, aprovado }]
create table if not exists public.matriculas (
    id               uuid primary key default gen_random_uuid(),
    curso_id         uuid not null references public.cursos (id) on delete cascade,
    usuario_id       uuid not null references public.perfis (id) on delete cascade,
    criado_em        timestamptz not null default now(),
    aulas_concluidas text[] not null default '{}',
    tentativas       jsonb not null default '[]',
    ultima_atividade timestamptz not null default now(),
    concluido_em     timestamptz,
    certificado_id   uuid,
    unique (curso_id, usuario_id)
);

-- Guarda nome, curso e empresa do momento da emissão (o certificado não muda depois).
create table if not exists public.certificados (
    id            uuid primary key default gen_random_uuid(),
    curso_id      uuid references public.cursos (id) on delete set null,
    usuario_id    uuid not null references public.perfis (id) on delete cascade,
    emitido_em    timestamptz not null default now(),
    codigo        text not null unique,
    nome          text not null,
    curso_titulo  text not null,
    carga_horaria int not null,
    empresa_nome  text not null default ''
);

create table if not exists public.pontos (
    id         bigint generated always as identity primary key,
    usuario_id uuid not null references public.perfis (id) on delete cascade,
    tipo       text not null,
    ref        text not null,
    valor      int not null,
    em         timestamptz not null default now(),
    unique (usuario_id, tipo, ref)
);

create table if not exists public.auditoria (
    id         bigint generated always as identity primary key,
    em         timestamptz not null default now(),
    autor_id   uuid references public.perfis (id) on delete set null,
    autor_nome text,
    acao       text not null,
    empresa_id uuid references public.empresas (id) on delete set null,
    alvo       text
);

create index if not exists perfis_empresa_idx       on public.perfis (empresa_id);
create index if not exists convites_empresa_idx     on public.convites (empresa_id);
create index if not exists convites_email_idx       on public.convites (email);
create index if not exists solicitacoes_empresa_idx on public.solicitacoes (empresa_id, situacao);
create index if not exists matriculas_usuario_idx   on public.matriculas (usuario_id);
create index if not exists certificados_usuario_idx on public.certificados (usuario_id);
create index if not exists pontos_usuario_idx       on public.pontos (usuario_id, em);
create index if not exists auditoria_em_idx         on public.auditoria (em desc);
create index if not exists auditoria_empresa_idx    on public.auditoria (empresa_id);

-- ------------------------------------------------------- funções auxiliares --

-- Perfil de quem está logado, só se a conta e a empresa estiverem ativas.
create or replace function public.eu() returns public.perfis
language sql stable security definer set search_path = public as $$
    select p.* from perfis p left join empresas e on e.id = p.empresa_id
    where p.id = auth.uid() and p.ativo and (p.empresa_id is null or e.ativa)
$$;

create or replace function public.meu_papel() returns text
language sql stable security definer set search_path = public as $$ select (eu()).perfil $$;

create or replace function public.minha_empresa() returns uuid
language sql stable security definer set search_path = public as $$ select (eu()).empresa_id $$;

create or replace function public.sou_equipe() returns boolean
language sql stable security definer set search_path = public as $$
    select coalesce((eu()).perfil in ('admin', 'consultant'), false)
$$;

-- Erros que o navegador entende: message = código, detail = campos em JSON.
create or replace function public._erro(codigo text, campos jsonb default '{}') returns void
language plpgsql as $$
begin
    raise exception using errcode = 'P0001', message = codigo, detail = campos::text;
end $$;

create or replace function public._exigir_eu() returns public.perfis
language plpgsql stable security definer set search_path = public as $$
declare v perfis := eu();
begin
    if v.id is null then perform _erro('proibido'); end if;
    return v;
end $$;

create or replace function public._exigir_equipe() returns public.perfis
language plpgsql stable security definer set search_path = public as $$
declare v perfis := _exigir_eu();
begin
    if v.perfil not in ('admin', 'consultant') then perform _erro('proibido'); end if;
    return v;
end $$;

create or replace function public._registrar(p_acao text, p_autor public.perfis, p_empresa uuid, p_alvo text) returns void
language sql security definer set search_path = public as $$
    insert into auditoria (autor_id, autor_nome, acao, empresa_id, alvo)
    values (p_autor.id, p_autor.nome, p_acao, p_empresa, p_alvo)
$$;

create or replace function public._texto(v text, maximo int) returns text
language sql immutable as $$ select left(btrim(coalesce(v, '')), maximo) $$;

create or replace function public._email_valido(v text) returns boolean
language sql immutable as $$ select char_length(v) <= 255 and v ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' $$;

create or replace function public._convite_pendente(c public.convites) returns boolean
language sql stable as $$ select c.aceito_em is null and c.cancelado_em is null and c.expira_em > now() $$;

create or replace function public._pode_convidar(p_eu public.perfis, p_perfil text, p_empresa public.empresas) returns boolean
language sql stable as $$
    select p_eu.id is not null
        and p_perfil in ('admin', 'consultant', 'company_admin', 'student')
        and ((p_perfil in ('company_admin', 'student')) = (p_empresa.id is not null))
        and (p_empresa.id is null or p_empresa.ativa)
        and case p_eu.perfil
            when 'admin' then true
            when 'consultant' then p_perfil in ('company_admin', 'student')
            when 'company_admin' then p_perfil = 'student' and p_empresa.id = p_eu.empresa_id
            else false end
$$;

create or replace function public._pode_gerir_pessoa(p_eu public.perfis, p_alvo public.perfis) returns boolean
language sql stable as $$
    select p_alvo.id is not null and p_alvo.id <> p_eu.id and case p_eu.perfil
        when 'admin' then true
        when 'consultant' then p_alvo.perfil not in ('admin', 'consultant')
        when 'company_admin' then p_alvo.perfil = 'student' and p_alvo.empresa_id = p_eu.empresa_id
        else false end
$$;

-- Motivo para não convidar este e-mail (ou null).
create or replace function public._bloqueio_email(p_email text) returns text
language sql stable security definer set search_path = public as $$
    select case
        when not coalesce(_email_valido(p_email), false) then 'email'
        when exists (select 1 from perfis where email = p_email) then 'contaExiste'
        when exists (select 1 from convites c where c.email = p_email and _convite_pendente(c)) then 'convitePendente'
        else null end
$$;

create or replace function public._novo_convite(p_eu public.perfis, p_email text, p_perfil text, p_empresa uuid) returns public.convites
language plpgsql security definer set search_path = public, extensions as $$
declare v convites;
begin
    insert into convites (email, perfil, empresa_id, convidado_por, codigo, expira_em)
    values (p_email, p_perfil, p_empresa, p_eu.id, encode(gen_random_bytes(18), 'hex'), now() + interval '7 days')
    returning * into v;
    perform _registrar(case when p_empresa is null then 'equipe.convidada' else 'convite.criado' end, p_eu, p_empresa, p_email);
    return v;
end $$;

create or replace function public._convite_json(c public.convites) returns jsonb
language sql stable security definer set search_path = public as $$
    select to_jsonb(c) || jsonb_build_object('convidado_por_nome', (select nome from perfis where id = c.convidado_por))
$$;

create or replace function public._ids_aulas(c public.cursos) returns text[]
language sql immutable as $$
    select coalesce(array_agg(a ->> 'id'), '{}')
    from jsonb_array_elements(c.modulos) m, jsonb_array_elements(m -> 'aulas') a
$$;

create or replace function public._curso_liberado(c public.cursos, p public.perfis) returns boolean
language sql stable as $$
    select c.ativo and p.perfil in ('student', 'company_admin') and p.empresa_id = any (c.empresas)
$$;

create or replace function public._somar_pontos(p_usuario uuid, p_tipo text, p_ref text, p_valor int) returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
    insert into pontos (usuario_id, tipo, ref, valor) values (p_usuario, p_tipo, p_ref, p_valor)
    on conflict (usuario_id, tipo, ref) do nothing returning valor into v;
    return coalesce(v, 0);
end $$;

-- Desafio semanal: 3 aulas em 7 dias = 25 pontos (uma vez por semana).
create or replace function public._verificar_desafio(p_usuario uuid) returns int
language plpgsql security definer set search_path = public as $$
begin
    if (select count(*) from pontos where usuario_id = p_usuario and tipo = 'aula' and em >= now() - interval '7 days') < 3 then
        return 0;
    end if;
    return _somar_pontos(p_usuario, 'desafio', 'semana-' || floor(extract(epoch from now()) / (7 * 86400))::bigint, 25);
end $$;

-- Curso completo = todas as aulas + avaliação aprovada (se houver). Emite o certificado.
create or replace function public._concluir_se_possivel(p_curso public.cursos, p_matricula uuid, p_pessoa public.perfis) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
    m matriculas;
    aulas text[] := _ids_aulas(p_curso);
    v_cert uuid;
begin
    select * into m from matriculas where id = p_matricula;
    if m.concluido_em is not null or cardinality(aulas) = 0 or not (aulas <@ m.aulas_concluidas) then return; end if;
    if jsonb_array_length(p_curso.questoes) > 0
       and not exists (select 1 from jsonb_array_elements(m.tentativas) t where (t ->> 'aprovado')::boolean) then
        return;
    end if;
    insert into certificados (curso_id, usuario_id, codigo, nome, curso_titulo, carga_horaria, empresa_nome)
    values (p_curso.id, p_pessoa.id,
            'MJC-' || upper(encode(gen_random_bytes(2), 'hex')) || '-' || upper(encode(gen_random_bytes(2), 'hex')),
            p_pessoa.nome, p_curso.titulo, p_curso.carga_horaria,
            coalesce((select nome from empresas where id = p_pessoa.empresa_id), ''))
    returning id into v_cert;
    update matriculas set concluido_em = now(), certificado_id = v_cert where id = p_matricula;
    perform _somar_pontos(p_pessoa.id, 'curso', p_curso.id::text, 50);
    perform _registrar('curso.concluido', p_pessoa, p_pessoa.empresa_id, p_curso.titulo);
    perform _registrar('certificado.emitido', p_pessoa, p_pessoa.empresa_id, p_curso.titulo);
end $$;

-- ---------------------------------------------------------- RLS (leitura) --

alter table public.empresas        enable row level security;
alter table public.perfis          enable row level security;
alter table public.convites        enable row level security;
alter table public.solicitacoes    enable row level security;
alter table public.cursos          enable row level security;
alter table public.cursos_gabarito enable row level security;
alter table public.matriculas      enable row level security;
alter table public.certificados    enable row level security;
alter table public.pontos          enable row level security;
alter table public.auditoria       enable row level security;

drop policy if exists ler on public.empresas;
create policy ler on public.empresas for select to authenticated
    using (sou_equipe() or id = minha_empresa());

drop policy if exists ler on public.perfis;
create policy ler on public.perfis for select to authenticated
    using (id = auth.uid() or sou_equipe() or (meu_papel() = 'company_admin' and empresa_id = minha_empresa()));

drop policy if exists ler on public.convites;
create policy ler on public.convites for select to authenticated
    using (sou_equipe() or (meu_papel() = 'company_admin' and empresa_id = minha_empresa()));

drop policy if exists ler on public.solicitacoes;
create policy ler on public.solicitacoes for select to authenticated
    using (sou_equipe() or (meu_papel() = 'company_admin' and empresa_id = minha_empresa()));

drop policy if exists ler on public.cursos;
create policy ler on public.cursos for select to authenticated
    using (sou_equipe() or (ativo and meu_papel() in ('student', 'company_admin') and minha_empresa() = any (empresas)));

drop policy if exists ler on public.cursos_gabarito;
create policy ler on public.cursos_gabarito for select to authenticated using (sou_equipe());

drop policy if exists ler on public.matriculas;
create policy ler on public.matriculas for select to authenticated
    using (usuario_id = auth.uid() or sou_equipe()
        or (meu_papel() = 'company_admin' and usuario_id in (select id from perfis where empresa_id = minha_empresa())));

drop policy if exists ler on public.certificados;
create policy ler on public.certificados for select to authenticated
    using (usuario_id = auth.uid() or sou_equipe()
        or (meu_papel() = 'company_admin' and usuario_id in (select id from perfis where empresa_id = minha_empresa())));

drop policy if exists ler on public.pontos;
create policy ler on public.pontos for select to authenticated
    using (usuario_id = auth.uid() or sou_equipe()
        or (meu_papel() = 'company_admin' and usuario_id in (select id from perfis where empresa_id = minha_empresa())));

-- admin: tudo; consultora: eventos de empresas, de cursos e os próprios; gestor: a empresa; aluno: os seus.
drop policy if exists ler on public.auditoria;
create policy ler on public.auditoria for select to authenticated
    using (case meu_papel()
        when 'admin' then true
        when 'consultant' then empresa_id is not null or autor_id = auth.uid() or acao like 'curso.%'
        when 'company_admin' then empresa_id = minha_empresa()
        when 'student' then autor_id = auth.uid()
        else false end);

-- Só leitura pela API; escrita apenas pelas funções abaixo.
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;

-- ------------------------------------------------------- RPC: área pública --

create or replace function public.listar_empresas_publicas() returns jsonb
language sql stable security definer set search_path = public as $$
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'nome', nome, 'identificador', identificador, 'cor', cor, 'cor_secundaria', cor_secundaria,
        'logo', logo, 'academia', academia, 'estilo_menu', estilo_menu, 'cantos', cantos, 'fonte', fonte,
        'capas_marca', capas_marca) order by nome), '[]')
    from empresas where ativa
$$;

create or replace function public.obter_empresa_publica(p_identificador text) returns jsonb
language sql stable security definer set search_path = public as $$
    select jsonb_build_object(
        'id', id, 'nome', nome, 'identificador', identificador, 'cor', cor, 'cor_secundaria', cor_secundaria,
        'logo', logo, 'academia', academia, 'estilo_menu', estilo_menu, 'cantos', cantos, 'fonte', fonte,
        'capas_marca', capas_marca, 'mensagem', mensagem, 'solicitacoes_ativas', solicitacoes_ativas, 'ativa', ativa)
    from empresas where identificador = p_identificador and ativa
$$;

create or replace function public.obter_convite(p_codigo text) returns jsonb
language sql stable security definer set search_path = public as $$
    select jsonb_build_object('email', c.email, 'perfil', c.perfil, 'empresa', case when e.id is null then null else jsonb_build_object(
        'id', e.id, 'nome', e.nome, 'mensagem', e.mensagem, 'cor', e.cor, 'cor_secundaria', e.cor_secundaria, 'logo', e.logo,
        'academia', e.academia, 'estilo_menu', e.estilo_menu, 'cantos', e.cantos, 'fonte', e.fonte, 'capas_marca', e.capas_marca) end)
    from convites c left join empresas e on e.id = c.empresa_id
    where c.codigo = p_codigo and _convite_pendente(c) and (c.empresa_id is null or e.ativa)
$$;

-- Pedido de acesso: resposta sempre igual (ninguém descobre dados de terceiros).
create or replace function public.enviar_solicitacao(p_identificador text, p_nome text, p_email text, p_mensagem text) returns void
language plpgsql security definer set search_path = public as $$
declare
    e empresas;
    v_email text := lower(_texto(p_email, 255));
    erros jsonb := '{}';
begin
    select * into e from empresas where identificador = p_identificador and ativa and solicitacoes_ativas;
    if e.id is null then perform _erro('nao-encontrado'); end if;
    if _texto(p_nome, 120) = '' then erros := erros || '{"nome":"obrigatorio"}'; end if;
    if not _email_valido(v_email) then erros := erros || '{"email":"email"}'; end if;
    if erros <> '{}' then perform _erro('validacao', erros); end if;
    if exists (select 1 from perfis where email = v_email)
       or exists (select 1 from convites c where c.email = v_email and _convite_pendente(c))
       or exists (select 1 from solicitacoes where empresa_id = e.id and email = v_email and situacao = 'pendente')
       or (select count(*) from solicitacoes where empresa_id = e.id and criado_em > now() - interval '1 hour') >= 30 then
        return;
    end if;
    insert into solicitacoes (empresa_id, nome, email, mensagem) values (e.id, _texto(p_nome, 120), v_email, _texto(p_mensagem, 500));
    insert into auditoria (acao, empresa_id, alvo) values ('solicitacao.criada', e.id, v_email);
end $$;

-- ------------------------------------------------------------ RPC: conta --

create or replace function public.meu_perfil() returns jsonb
language sql stable security definer set search_path = public as $$
    select case when (eu()).id is null then null else to_jsonb(eu()) end
$$;

create or replace function public.registrar_acesso() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v perfis := eu();
begin
    if v.id is null then return null; end if;
    update perfis set ultimo_acesso = now() where id = v.id returning * into v;
    return to_jsonb(v);
end $$;

-- Aceite: e-mail, perfil e empresa vêm do convite; a conta Auth já foi criada com o mesmo e-mail.
create or replace function public.aceitar_convite(p_codigo text, p_nome text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    c convites;
    v perfis;
    v_email text := lower((select email from auth.users where id = auth.uid()));
begin
    select * into c from convites where codigo = p_codigo for update;
    if c.id is null or not _convite_pendente(c) or c.email <> v_email then perform _erro('nao-encontrado'); end if;
    if c.empresa_id is not null and not (select ativa from empresas where id = c.empresa_id) then perform _erro('nao-encontrado'); end if;
    if _texto(p_nome, 120) = '' then perform _erro('validacao', '{"nome":"obrigatorio"}'); end if;
    if exists (select 1 from perfis where id = auth.uid() or email = c.email) then perform _erro('nao-encontrado'); end if;
    insert into perfis (id, nome, email, perfil, empresa_id, ultimo_acesso)
    values (auth.uid(), _texto(p_nome, 120), c.email, c.perfil, c.empresa_id, now())
    returning * into v;
    update convites set aceito_em = now() where id = c.id;
    perform _registrar('convite.aceito', v, v.empresa_id, v.email);
    return to_jsonb(v);
end $$;

create or replace function public.definir_idioma(p_idioma text) returns void
language sql security definer set search_path = public as $$
    update perfis set idioma = left(p_idioma, 10) where id = (eu()).id
$$;

create or replace function public.atualizar_conta(p_nome text, p_idioma text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v perfis := _exigir_eu();
begin
    if _texto(p_nome, 120) = '' then perform _erro('validacao', '{"nome":"obrigatorio"}'); end if;
    update perfis set nome = _texto(p_nome, 120), idioma = coalesce(nullif(left(p_idioma, 10), ''), idioma)
    where id = v.id returning * into v;
    perform _registrar('conta.atualizada', v, v.empresa_id, v.nome);
    return to_jsonb(v);
end $$;

-- --------------------------------------------------------- RPC: empresas --

create or replace function public.salvar_empresa(entrada jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_equipe();
    v_id uuid := nullif(entrada ->> 'id', '')::uuid;
    v_nome text := _texto(entrada ->> 'nome', 150);
    v_ident text := lower(_texto(entrada ->> 'identificador', 60));
    v_aprovador text := case when entrada ->> 'aprovador' = 'consultoria' then 'consultoria' else 'empresa' end;
    erros jsonb := '{}';
    v empresas;
begin
    if v_id is not null and not exists (select 1 from empresas where id = v_id) then perform _erro('nao-encontrado'); end if;
    if v_nome = '' then erros := erros || '{"nome":"obrigatorio"}'; end if;
    if v_ident !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then erros := erros || '{"identificador":"identificador"}';
    elsif exists (select 1 from empresas where identificador = v_ident and id is distinct from v_id) then erros := erros || '{"identificador":"identificadorEmUso"}';
    end if;
    if erros <> '{}' then perform _erro('validacao', erros); end if;

    if v_id is not null then
        update empresas set nome = v_nome, identificador = v_ident, mensagem = _texto(entrada ->> 'mensagem', 300),
            ativa = coalesce((entrada ->> 'ativa')::boolean, false),
            solicitacoes_ativas = coalesce((entrada ->> 'solicitacoesAtivas')::boolean, false), aprovador = v_aprovador
        where id = v_id returning * into v;
        perform _registrar('empresa.atualizada', v_eu, v.id, v.nome);
    else
        insert into empresas (nome, identificador, mensagem, solicitacoes_ativas, aprovador)
        values (v_nome, v_ident, _texto(entrada ->> 'mensagem', 300), coalesce((entrada ->> 'solicitacoesAtivas')::boolean, false), v_aprovador)
        returning * into v;
        perform _registrar('empresa.criada', v_eu, v.id, v.nome);
    end if;
    return to_jsonb(v);
end $$;

create or replace function public.salvar_marca(p_empresa uuid, entrada jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_eu();
    v_cor text := lower(_texto(entrada ->> 'cor', 7));
    v_cor2 text := lower(_texto(entrada ->> 'corSecundaria', 7));
    v_logo text := nullif(entrada ->> 'logo', '');
    erros jsonb := '{}';
    v empresas;
begin
    if not (v_eu.perfil in ('admin', 'consultant') or (v_eu.perfil = 'company_admin' and v_eu.empresa_id = p_empresa)) then
        perform _erro('proibido');
    end if;
    if not exists (select 1 from empresas where id = p_empresa) then perform _erro('nao-encontrado'); end if;
    if v_cor <> '' and v_cor !~ '^#[0-9a-f]{6}$' then erros := erros || '{"cor":"corFormato"}'; end if;
    if v_cor2 <> '' and v_cor2 !~ '^#[0-9a-f]{6}$' then erros := erros || '{"corSecundaria":"corFormato"}'; end if;
    if v_logo is not null and (v_logo !~ '^data:image/(png|jpeg|webp|svg\+xml)[;,]' or octet_length(v_logo) > 300000) then
        erros := erros || '{"logo":"logoTipo"}';
    end if;
    if erros <> '{}' then perform _erro('validacao', erros); end if;

    update empresas set
        cor = nullif(v_cor, ''), cor_secundaria = nullif(v_cor2, ''), logo = v_logo,
        academia = _texto(entrada ->> 'academia', 60),
        mensagem = case when entrada ? 'mensagem' then _texto(entrada ->> 'mensagem', 300) else mensagem end,
        estilo_menu = case when entrada ->> 'estiloMenu' in ('escuro', 'marca', 'claro') then entrada ->> 'estiloMenu' else 'escuro' end,
        cantos = case when entrada ->> 'cantos' in ('suave', 'reto', 'redondo') then entrada ->> 'cantos' else 'suave' end,
        fonte = case when entrada ->> 'fonte' in ('marcante', 'classica', 'neutra') then entrada ->> 'fonte' else 'marcante' end,
        capas_marca = coalesce((entrada ->> 'capasMarca')::boolean, false)
    where id = p_empresa returning * into v;
    perform _registrar('empresa.marca', v_eu, v.id, v.nome);
    return to_jsonb(v);
end $$;

-- ---------------------------------------------------------- RPC: pessoas --

create or replace function public.definir_situacao_pessoa(p_pessoa uuid, p_ativo boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_eu perfis := _exigir_eu(); v perfis;
begin
    select * into v from perfis where id = p_pessoa;
    if v.id is null then perform _erro('nao-encontrado'); end if;
    if not _pode_gerir_pessoa(v_eu, v) then perform _erro('proibido'); end if;
    update perfis set ativo = p_ativo where id = p_pessoa returning * into v;
    perform _registrar(case when p_ativo then 'pessoa.reativada' else 'pessoa.desativada' end, v_eu, v.empresa_id, v.nome);
    return to_jsonb(v);
end $$;

create or replace function public.definir_perfil_pessoa(p_pessoa uuid, p_perfil text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_eu perfis := _exigir_equipe(); v perfis;
begin
    select * into v from perfis where id = p_pessoa;
    if v.id is null then perform _erro('nao-encontrado'); end if;
    if v.id = v_eu.id or v.perfil not in ('company_admin', 'student') or p_perfil not in ('company_admin', 'student') then
        perform _erro('proibido');
    end if;
    update perfis set perfil = p_perfil where id = p_pessoa returning * into v;
    perform _registrar('pessoa.perfil', v_eu, v.empresa_id, v.nome);
    return to_jsonb(v);
end $$;

create or replace function public.renomear_pessoa(p_pessoa uuid, p_nome text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_eu perfis := _exigir_eu(); v perfis;
begin
    select * into v from perfis where id = p_pessoa;
    if v.id is null then perform _erro('nao-encontrado'); end if;
    if not _pode_gerir_pessoa(v_eu, v) then perform _erro('proibido'); end if;
    if _texto(p_nome, 120) = '' then perform _erro('validacao', '{"nome":"obrigatorio"}'); end if;
    update perfis set nome = _texto(p_nome, 120) where id = p_pessoa returning * into v;
    perform _registrar('pessoa.editada', v_eu, v.empresa_id, v.nome);
    return to_jsonb(v);
end $$;

-- --------------------------------------------------------- RPC: convites --

create or replace function public.criar_convite(p_email text, p_perfil text, p_empresa uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_eu();
    e empresas;
    v_email text := lower(_texto(p_email, 255));
    v_bloqueio text;
begin
    if p_empresa is not null then select * into e from empresas where id = p_empresa; end if;
    if not _pode_convidar(v_eu, p_perfil, e) then perform _erro('proibido'); end if;
    v_bloqueio := _bloqueio_email(v_email);
    if v_bloqueio is not null then perform _erro('validacao', jsonb_build_object('email', v_bloqueio)); end if;
    return _convite_json(_novo_convite(v_eu, v_email, p_perfil, e.id));
end $$;

-- Para o convite em lote: motivo de bloqueio de cada e-mail (null = pode convidar).
create or replace function public.emails_bloqueados(p_emails text[]) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_eu perfis := _exigir_eu();
begin
    if v_eu.perfil not in ('admin', 'consultant', 'company_admin') then perform _erro('proibido'); end if;
    return (select coalesce(jsonb_object_agg(x, _bloqueio_email(x)), '{}') from unnest(p_emails[1:200]) x);
end $$;

create or replace function public.criar_convites_lote(p_empresa uuid, p_emails text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_eu();
    e empresas;
    v_email text;
    resultado jsonb := '[]';
begin
    select * into e from empresas where id = p_empresa;
    if not _pode_convidar(v_eu, 'student', e) then perform _erro('proibido'); end if;
    for v_email in select distinct lower(btrim(x)) from unnest(p_emails[1:200]) x loop
        if _bloqueio_email(v_email) is null then
            resultado := resultado || jsonb_build_array(_convite_json(_novo_convite(v_eu, v_email, 'student', e.id)));
        end if;
    end loop;
    return resultado;
end $$;

create or replace function public._convite_gerivel(p_eu public.perfis, p_id uuid) returns public.convites
language plpgsql security definer set search_path = public as $$
declare c convites; e empresas;
begin
    select * into c from convites where id = p_id;
    if c.id is null or c.aceito_em is not null or c.cancelado_em is not null then perform _erro('nao-encontrado'); end if;
    if c.empresa_id is not null then select * into e from empresas where id = c.empresa_id; end if;
    if not _pode_convidar(p_eu, c.perfil, e) then perform _erro('proibido'); end if;
    return c;
end $$;

-- Gera link novo (o anterior deixa de valer) e renova a validade.
create or replace function public.renovar_convite(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_eu perfis := _exigir_eu(); c convites := _convite_gerivel(v_eu, p_id);
begin
    update convites set codigo = encode(gen_random_bytes(18), 'hex'), expira_em = now() + interval '7 days'
    where id = c.id returning * into c;
    perform _registrar('convite.renovado', v_eu, c.empresa_id, c.email);
    return _convite_json(c);
end $$;

create or replace function public.cancelar_convite(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu perfis := _exigir_eu(); c convites := _convite_gerivel(v_eu, p_id);
begin
    update convites set cancelado_em = now() where id = c.id;
    perform _registrar('convite.cancelado', v_eu, c.empresa_id, c.email);
end $$;

-- ----------------------------------------------------- RPC: solicitações --

create or replace function public._solicitacao_decidivel(p_eu public.perfis, p_id uuid) returns public.solicitacoes
language plpgsql security definer set search_path = public as $$
declare s solicitacoes; e empresas;
begin
    select * into s from solicitacoes where id = p_id for update;
    if s.id is null then perform _erro('nao-encontrado'); end if;
    select * into e from empresas where id = s.empresa_id;
    if not (p_eu.perfil in ('admin', 'consultant')
            or (p_eu.perfil = 'company_admin' and e.id = p_eu.empresa_id and e.aprovador = 'empresa')) then
        perform _erro('proibido');
    end if;
    if s.situacao <> 'pendente' then perform _erro('validacao', '{"solicitacao":"jaDecidida"}'); end if;
    return s;
end $$;

create or replace function public.aprovar_solicitacao(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_eu();
    s solicitacoes := _solicitacao_decidivel(v_eu, p_id);
    v_bloqueio text := _bloqueio_email(s.email);
    c convites;
begin
    if v_bloqueio is not null then perform _erro('validacao', jsonb_build_object('solicitacao', v_bloqueio)); end if;
    c := _novo_convite(v_eu, s.email, 'student', s.empresa_id);
    update solicitacoes set situacao = 'aprovada', decidido_por = v_eu.id, decidido_em = now() where id = s.id;
    perform _registrar('solicitacao.aprovada', v_eu, s.empresa_id, s.email);
    return _convite_json(c);
end $$;

create or replace function public.recusar_solicitacao(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu perfis := _exigir_eu(); s solicitacoes := _solicitacao_decidivel(v_eu, p_id);
begin
    if _texto(p_motivo, 300) = '' then perform _erro('validacao', '{"motivo":"obrigatorio"}'); end if;
    update solicitacoes set situacao = 'recusada', decidido_por = v_eu.id, decidido_em = now(), motivo = _texto(p_motivo, 300)
    where id = s.id;
    perform _registrar('solicitacao.recusada', v_eu, s.empresa_id, s.email);
end $$;

-- ----------------------------------------------------------- RPC: cursos --

-- Recebe o curso já normalizado pelo navegador; confere a estrutura e separa o gabarito.
create or replace function public.salvar_curso(entrada jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_equipe();
    v_id uuid := nullif(entrada ->> 'id', '')::uuid;
    v_mod jsonb := coalesce(entrada -> 'modulos', '[]');
    v_q jsonb := coalesce(entrada -> 'avaliacao' -> 'questoes', '[]');
    v_empresas uuid[];
    erros jsonb := '{}';
    v cursos;
begin
    if v_id is not null and not exists (select 1 from cursos where id = v_id) then perform _erro('nao-encontrado'); end if;
    if _texto(entrada ->> 'titulo', 150) = '' then erros := erros || '{"titulo":"obrigatorio"}'; end if;
    if jsonb_typeof(v_mod) <> 'array' or jsonb_typeof(v_q) <> 'array' then perform _erro('validacao', '{"titulo":"obrigatorio"}'); end if;
    if exists (select 1 from jsonb_array_elements(v_mod) m, jsonb_array_elements(m -> 'aulas') a
               where a ->> 'tipo' = 'video' and coalesce(a ->> 'videoId', '') !~ '^[A-Za-z0-9_-]{11}$') then
        erros := erros || '{"video":"video"}';
    end if;
    if exists (select 1 from jsonb_array_elements(v_q) q
               where _texto(q ->> 'enunciado', 400) = '' or jsonb_array_length(coalesce(q -> 'alternativas', '[]')) < 2
                  or coalesce((q ->> 'correta')::int, -1) not between 0 and jsonb_array_length(q -> 'alternativas') - 1) then
        erros := erros || '{"questoes":"questao"}';
    end if;
    if erros <> '{}' then perform _erro('validacao', erros); end if;

    select coalesce(array_agg(e.id), '{}') into v_empresas
    from empresas e where e.id::text in (select jsonb_array_elements_text(coalesce(entrada -> 'empresas', '[]')));

    if v_id is null then
        insert into cursos (titulo) values (_texto(entrada ->> 'titulo', 150)) returning id into v_id;
        perform _registrar('curso.criado', v_eu, null, _texto(entrada ->> 'titulo', 150));
    else
        perform _registrar('curso.atualizado', v_eu, null, _texto(entrada ->> 'titulo', 150));
    end if;

    update cursos set
        titulo = _texto(entrada ->> 'titulo', 150),
        descricao = _texto(entrada ->> 'descricao', 600),
        carga_horaria = least(400, greatest(1, coalesce((entrada ->> 'cargaHoraria')::int, 1))),
        nota_minima = least(100, greatest(0, coalesce((entrada ->> 'notaMinima')::int, 70))),
        tentativas = least(10, greatest(1, coalesce((entrada ->> 'tentativas')::int, 3))),
        ativo = coalesce((entrada ->> 'ativo')::boolean, false),
        avanco_automatico = coalesce((entrada ->> 'avancoAutomatico')::boolean, false),
        empresas = v_empresas,
        modulos = v_mod,
        questoes = (select coalesce(jsonb_agg(q - 'correta'), '[]') from jsonb_array_elements(v_q) q)
    where id = v_id returning * into v;

    insert into cursos_gabarito (curso_id, respostas)
    values (v_id, (select coalesce(jsonb_object_agg(q ->> 'id', (q ->> 'correta')::int), '{}') from jsonb_array_elements(v_q) q))
    on conflict (curso_id) do update set respostas = excluded.respostas;

    return to_jsonb(v);
end $$;

create or replace function public.matricular(p_curso uuid, p_pessoa uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_eu();
    c cursos;
    p perfis;
    m matriculas;
begin
    select * into c from cursos where id = p_curso;
    select * into p from perfis where id = coalesce(p_pessoa, v_eu.id);
    if c.id is null or p.id is null then perform _erro('nao-encontrado'); end if;
    if not (_curso_liberado(c, p) and p.ativo and (
            p.id = v_eu.id or v_eu.perfil in ('admin', 'consultant')
            or (v_eu.perfil = 'company_admin' and p.empresa_id = v_eu.empresa_id))) then
        perform _erro('proibido');
    end if;
    select * into m from matriculas where curso_id = c.id and usuario_id = p.id;
    if m.id is null then
        insert into matriculas (curso_id, usuario_id) values (c.id, p.id) returning * into m;
        perform _registrar('matricula.criada', v_eu, p.empresa_id, p.nome || ' — ' || c.titulo);
    end if;
    return to_jsonb(m);
end $$;

create or replace function public.concluir_aula(p_curso uuid, p_aula text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_eu();
    c cursos;
    m matriculas;
    v_titulo text;
    ganhos int := 0;
begin
    select * into c from cursos where id = p_curso;
    if c.id is null then perform _erro('nao-encontrado'); end if;
    if not _curso_liberado(c, v_eu) then perform _erro('proibido'); end if;
    select * into m from matriculas where curso_id = c.id and usuario_id = v_eu.id for update;
    if m.id is null then perform _erro('proibido'); end if;
    select a ->> 'titulo' into v_titulo from jsonb_array_elements(c.modulos) x, jsonb_array_elements(x -> 'aulas') a where a ->> 'id' = p_aula;
    if v_titulo is null then perform _erro('nao-encontrado'); end if;

    if not (p_aula = any (m.aulas_concluidas)) then
        update matriculas set aulas_concluidas = aulas_concluidas || p_aula where id = m.id;
        ganhos := ganhos + _somar_pontos(v_eu.id, 'aula', p_aula, 10);
        ganhos := ganhos + _verificar_desafio(v_eu.id);
        perform _registrar('aula.concluida', v_eu, v_eu.empresa_id, v_titulo);
    end if;
    update matriculas set ultima_atividade = now() where id = m.id;
    perform _concluir_se_possivel(c, m.id, v_eu);
    select * into m from matriculas where id = m.id;
    return jsonb_build_object('matricula', to_jsonb(m), 'pontosGanhos', ganhos);
end $$;

-- Correção no servidor: as respostas chegam, o gabarito nunca sai daqui.
create or replace function public.enviar_avaliacao(p_curso uuid, p_respostas jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_eu();
    c cursos;
    m matriculas;
    g jsonb;
    total int;
    certas int;
    v_nota int;
    v_aprovado boolean;
    ganhos int := 0;
begin
    select * into c from cursos where id = p_curso;
    if c.id is null then perform _erro('nao-encontrado'); end if;
    if not _curso_liberado(c, v_eu) then perform _erro('proibido'); end if;
    select * into m from matriculas where curso_id = c.id and usuario_id = v_eu.id for update;
    if m.id is null then perform _erro('proibido'); end if;
    total := jsonb_array_length(c.questoes);
    if total = 0 then perform _erro('nao-encontrado'); end if;
    if not (_ids_aulas(c) <@ m.aulas_concluidas) then perform _erro('validacao', '{"avaliacao":"aulasPendentes"}'); end if;
    if exists (select 1 from jsonb_array_elements(m.tentativas) t where (t ->> 'aprovado')::boolean) then
        perform _erro('validacao', '{"avaliacao":"jaAprovado"}');
    end if;
    if jsonb_array_length(m.tentativas) >= c.tentativas then perform _erro('validacao', '{"avaliacao":"semTentativas"}'); end if;
    if exists (select 1 from jsonb_array_elements(c.questoes) q where coalesce(p_respostas ->> (q ->> 'id'), '') = '') then
        perform _erro('validacao', '{"avaliacao":"respondaTodas"}');
    end if;

    select respostas into g from cursos_gabarito where curso_id = c.id;
    g := coalesce(g, '{}');
    select count(*) into certas from jsonb_array_elements(c.questoes) q
    where (p_respostas ->> (q ->> 'id')) = (g ->> (q ->> 'id'));
    v_nota := round(certas * 100.0 / total);
    v_aprovado := v_nota >= c.nota_minima;

    update matriculas set
        tentativas = tentativas || jsonb_build_array(jsonb_build_object('em', now(), 'nota', v_nota, 'aprovado', v_aprovado)),
        ultima_atividade = now()
    where id = m.id;
    if v_aprovado then
        ganhos := ganhos + _somar_pontos(v_eu.id, 'avaliacao', c.id::text, 30);
        if v_nota = 100 then ganhos := ganhos + _somar_pontos(v_eu.id, 'notaMaxima', c.id::text, 20); end if;
    end if;
    perform _registrar(case when v_aprovado then 'avaliacao.aprovada' else 'avaliacao.reprovada' end, v_eu, v_eu.empresa_id, c.titulo);
    perform _concluir_se_possivel(c, m.id, v_eu);
    select * into m from matriculas where id = m.id;

    return jsonb_build_object(
        'nota', v_nota, 'aprovado', v_aprovado, 'notaMinima', c.nota_minima, 'pontosGanhos', ganhos,
        'correcao', (select jsonb_agg(jsonb_build_object('id', q ->> 'id', 'acertou', (p_respostas ->> (q ->> 'id')) = (g ->> (q ->> 'id'))))
                     from jsonb_array_elements(c.questoes) q),
        'matricula', to_jsonb(m));
end $$;

-- Ranking só da própria empresa (top 10).
create or replace function public.ranking_empresa() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_eu perfis := _exigir_eu();
begin
    if v_eu.empresa_id is null then perform _erro('proibido'); end if;
    return (select coalesce(jsonb_agg(r), '[]') from (
        select p.id, p.nome, coalesce(sum(pt.valor), 0)::int as pontos
        from perfis p left join pontos pt on pt.usuario_id = p.id
        where p.empresa_id = v_eu.empresa_id and p.ativo and p.perfil in ('student', 'company_admin')
        group by p.id, p.nome
        order by 3 desc, p.nome
        limit 10) r);
end $$;

-- ----------------------------------------------------------- permissões --

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
    public.eu(), public.meu_papel(), public.minha_empresa(), public.sou_equipe()
to authenticated;

grant execute on function
    public.listar_empresas_publicas(), public.obter_empresa_publica(text), public.obter_convite(text),
    public.enviar_solicitacao(text, text, text, text)
to anon, authenticated;

grant execute on function
    public.meu_perfil(), public.registrar_acesso(), public.aceitar_convite(text, text),
    public.definir_idioma(text), public.atualizar_conta(text, text),
    public.salvar_empresa(jsonb), public.salvar_marca(uuid, jsonb),
    public.definir_situacao_pessoa(uuid, boolean), public.definir_perfil_pessoa(uuid, text), public.renomear_pessoa(uuid, text),
    public.criar_convite(text, text, uuid), public.emails_bloqueados(text[]), public.criar_convites_lote(uuid, text[]),
    public.renovar_convite(uuid), public.cancelar_convite(uuid),
    public.aprovar_solicitacao(uuid), public.recusar_solicitacao(uuid, text),
    public.salvar_curso(jsonb), public.matricular(uuid, uuid), public.concluir_aula(uuid, text),
    public.enviar_avaliacao(uuid, jsonb), public.ranking_empresa()
to authenticated;

-- =============================================================================
-- PRIMEIRO ADMINISTRADOR (rodar uma vez, depois de aplicar o arquivo):
--   1. Supabase → Authentication → Users → Add user → e-mail + senha
--      (marque "Auto Confirm User").
--   2. Troque o e-mail e o nome abaixo e execute:
--
-- insert into public.perfis (id, nome, email, perfil)
-- select id, 'Seu Nome', lower(email), 'admin' from auth.users where email = 'voce@empresa.com';
-- =============================================================================
