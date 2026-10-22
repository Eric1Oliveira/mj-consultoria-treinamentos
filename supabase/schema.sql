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

-- Área (setor) da pessoa: agrupa o ranking e os resultados dos diagnósticos.
alter table public.perfis add column if not exists area text not null default '' check (char_length(area) <= 60);

-- Prazo combinado na atribuição do curso (opcional).
alter table public.matriculas add column if not exists prazo date;

-- --------------------------------------------- cultura e maturidade --
-- Modelos de diagnóstico (questionários de referência, baseados em normas).
-- dimensoes: [{ id, nome, descricao, recomendacao, cursos: [uuid] }]
-- questoes:  [{ id, dimensao, texto, invertida }]   (escala de 1 a 5)
-- niveis:    [] ou 5 nomes próprios de nível (ex.: escada de Hudson)
create table if not exists public.diagnosticos_modelos (
    id            uuid primary key default gen_random_uuid(),
    titulo        text not null check (char_length(titulo) between 1 and 150),
    descricao     text not null default '' check (char_length(descricao) <= 800),
    norma         text not null default '' check (char_length(norma) <= 300),
    interpretacao text not null default 'maturidade' check (interpretacao in ('maturidade', 'risco')),
    niveis        jsonb not null default '[]' check (jsonb_typeof(niveis) = 'array'),
    dimensoes     jsonb not null default '[]' check (jsonb_typeof(dimensoes) = 'array'),
    questoes      jsonb not null default '[]' check (jsonb_typeof(questoes) = 'array'),
    publicado     boolean not null default true,
    padrao        boolean not null default false,
    criado_em     timestamptz not null default now()
);

-- Aplicação de um modelo numa empresa. Guarda uma cópia do questionário (mais as
-- perguntas próprias da empresa): mudar o modelo depois não altera o que já foi respondido.
create table if not exists public.diagnosticos (
    id               uuid primary key default gen_random_uuid(),
    empresa_id       uuid not null references public.empresas (id) on delete cascade,
    modelo_id        uuid references public.diagnosticos_modelos (id) on delete set null,
    titulo           text not null check (char_length(titulo) between 1 and 150),
    norma            text not null default '',
    interpretacao    text not null default 'maturidade' check (interpretacao in ('maturidade', 'risco')),
    niveis           jsonb not null default '[]',
    dimensoes        jsonb not null default '[]',
    questoes         jsonb not null default '[]',
    publico          text not null default 'todos' check (publico in ('todos', 'funcionarios', 'gestores')),
    enps             boolean not null default true,
    comentarios      boolean not null default true,
    anonimato_minimo int not null default 3 check (anonimato_minimo between 3 and 20),
    situacao         text not null default 'aberto' check (situacao in ('aberto', 'encerrado')),
    fecha_em         date,
    criado_por       uuid references public.perfis (id) on delete set null,
    criado_em        timestamptz not null default now(),
    encerrado_em     timestamptz
);

-- Quem já respondeu (para a taxa de resposta e para responder uma vez só).
-- Fica SEPARADO das respostas: nada liga uma pessoa ao que ela respondeu.
create table if not exists public.diagnosticos_participacoes (
    diagnostico_id uuid not null references public.diagnosticos (id) on delete cascade,
    usuario_id     uuid not null references public.perfis (id) on delete cascade,
    respondido_em  timestamptz not null default now(),
    primary key (diagnostico_id, usuario_id)
);

-- Respostas anônimas: sem usuário e só com o dia. Ninguém lê pela API (sem política
-- de leitura); os resultados saem agregados por resultado_diagnostico, que esconde
-- grupos com menos respostas que o mínimo de anonimato.
create table if not exists public.diagnosticos_respostas (
    id             uuid primary key default gen_random_uuid(),
    diagnostico_id uuid not null references public.diagnosticos (id) on delete cascade,
    papel          text not null check (papel in ('gestor', 'funcionario')),
    area           text not null default '',
    respostas      jsonb not null,
    enps           int check (enps between 0 and 10),
    comentario     text not null default '' check (char_length(comentario) <= 600),
    dia            date not null default current_date
);

-- ----------------------------------------------------------- kaizen --
-- Projeto de melhoria no formato A3 / PDCA.
create table if not exists public.kaizens (
    id             uuid primary key default gen_random_uuid(),
    empresa_id     uuid not null references public.empresas (id) on delete cascade,
    numero         int not null,
    titulo         text not null check (char_length(titulo) between 1 and 150),
    problema       text not null default '' check (char_length(problema) <= 2000),
    situacao_atual text not null default '' check (char_length(situacao_atual) <= 2000),
    porques        jsonb not null default '[]' check (jsonb_typeof(porques) = 'array'),
    causa_raiz     text not null default '' check (char_length(causa_raiz) <= 1000),
    contramedida   text not null default '' check (char_length(contramedida) <= 2000),
    meta           text not null default '' check (char_length(meta) <= 500),
    resultado      text not null default '' check (char_length(resultado) <= 2000),
    padronizacao   text not null default '' check (char_length(padronizacao) <= 1000),
    etapa          text not null default 'ideia' check (etapa in ('ideia', 'planejar', 'executar', 'verificar', 'concluido', 'arquivado')),
    dimensao       text not null default '' check (char_length(dimensao) <= 120),
    area           text not null default '' check (char_length(area) <= 60),
    autor_id       uuid references public.perfis (id) on delete set null,
    responsavel_id uuid references public.perfis (id) on delete set null,
    membros        uuid[] not null default '{}',
    economia       numeric(14, 2) not null default 0 check (economia >= 0),
    horas          numeric(10, 1) not null default 0 check (horas >= 0),
    prazo          date,
    destaque       boolean not null default false,
    criado_em      timestamptz not null default now(),
    atualizado_em  timestamptz not null default now(),
    concluido_em   timestamptz,
    unique (empresa_id, numero)
);

create table if not exists public.kaizens_eventos (
    id         bigint generated always as identity primary key,
    kaizen_id  uuid not null references public.kaizens (id) on delete cascade,
    autor_id   uuid references public.perfis (id) on delete set null,
    autor_nome text,
    tipo       text not null check (tipo in ('criado', 'comentario', 'etapa', 'parecer')),
    texto      text not null default '' check (char_length(texto) <= 1000),
    em         timestamptz not null default now()
);

create index if not exists diagnosticos_empresa_idx    on public.diagnosticos (empresa_id, criado_em desc);
create index if not exists diag_respostas_idx          on public.diagnosticos_respostas (diagnostico_id);
create index if not exists kaizens_empresa_idx         on public.kaizens (empresa_id, etapa);
create index if not exists kaizens_eventos_idx         on public.kaizens_eventos (kaizen_id, em);
create index if not exists pontos_tipo_idx             on public.pontos (tipo, em);
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
-- As funções vão entre (select ...): o Postgres as calcula uma vez por consulta, não por linha.

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
alter table public.diagnosticos_modelos       enable row level security;
alter table public.diagnosticos               enable row level security;
alter table public.diagnosticos_participacoes enable row level security;
alter table public.diagnosticos_respostas     enable row level security; -- sem política: ninguém lê pela API
alter table public.kaizens                    enable row level security;
alter table public.kaizens_eventos            enable row level security;

drop policy if exists ler on public.diagnosticos_modelos;
create policy ler on public.diagnosticos_modelos for select to authenticated
    using ((select sou_equipe()) or (publicado and (select meu_papel()) = 'company_admin'));

drop policy if exists ler on public.diagnosticos;
create policy ler on public.diagnosticos for select to authenticated
    using ((select sou_equipe()) or empresa_id = (select minha_empresa()));

drop policy if exists ler on public.diagnosticos_participacoes;
create policy ler on public.diagnosticos_participacoes for select to authenticated
    using (usuario_id = (select auth.uid()) or (select sou_equipe()));

drop policy if exists ler on public.kaizens;
create policy ler on public.kaizens for select to authenticated
    using ((select sou_equipe()) or empresa_id = (select minha_empresa()));

drop policy if exists ler on public.kaizens_eventos;
create policy ler on public.kaizens_eventos for select to authenticated
    using ((select sou_equipe()) or kaizen_id in (select id from kaizens where empresa_id = (select minha_empresa())));

drop policy if exists ler on public.empresas;
create policy ler on public.empresas for select to authenticated
    using ((select sou_equipe()) or id = (select minha_empresa()));

drop policy if exists ler on public.perfis;
create policy ler on public.perfis for select to authenticated
    using (id = (select auth.uid()) or (select sou_equipe()) or ((select meu_papel()) = 'company_admin' and empresa_id = (select minha_empresa())));

drop policy if exists ler on public.convites;
create policy ler on public.convites for select to authenticated
    using ((select sou_equipe()) or ((select meu_papel()) = 'company_admin' and empresa_id = (select minha_empresa())));

drop policy if exists ler on public.solicitacoes;
create policy ler on public.solicitacoes for select to authenticated
    using ((select sou_equipe()) or ((select meu_papel()) = 'company_admin' and empresa_id = (select minha_empresa())));

drop policy if exists ler on public.cursos;
create policy ler on public.cursos for select to authenticated
    using ((select sou_equipe()) or (ativo and (select meu_papel()) in ('student', 'company_admin') and (select minha_empresa()) = any (empresas)));

drop policy if exists ler on public.cursos_gabarito;
create policy ler on public.cursos_gabarito for select to authenticated using ((select sou_equipe()));

drop policy if exists ler on public.matriculas;
create policy ler on public.matriculas for select to authenticated
    using (usuario_id = (select auth.uid()) or (select sou_equipe())
        or ((select meu_papel()) = 'company_admin' and usuario_id in (select id from perfis where empresa_id = (select minha_empresa()))));

drop policy if exists ler on public.certificados;
create policy ler on public.certificados for select to authenticated
    using (usuario_id = (select auth.uid()) or (select sou_equipe())
        or ((select meu_papel()) = 'company_admin' and usuario_id in (select id from perfis where empresa_id = (select minha_empresa()))));

drop policy if exists ler on public.pontos;
create policy ler on public.pontos for select to authenticated
    using (usuario_id = (select auth.uid()) or (select sou_equipe())
        or ((select meu_papel()) = 'company_admin' and usuario_id in (select id from perfis where empresa_id = (select minha_empresa()))));

-- admin: tudo; consultora: eventos de empresas, de cursos e os próprios; gestor: a empresa; aluno: os seus.
drop policy if exists ler on public.auditoria;
create policy ler on public.auditoria for select to authenticated
    using (case (select meu_papel())
        when 'admin' then true
        when 'consultant' then empresa_id is not null or autor_id = (select auth.uid()) or acao like 'curso.%' or acao like 'modelo.%'
        when 'company_admin' then empresa_id = (select minha_empresa())
        when 'student' then autor_id = (select auth.uid())
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

-- Área/setor: quem gere a pessoa (o gestor também define a própria).
create or replace function public.definir_area_pessoa(p_pessoa uuid, p_area text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_eu perfis := _exigir_eu(); v perfis;
begin
    select * into v from perfis where id = p_pessoa;
    if v.id is null then perform _erro('nao-encontrado'); end if;
    if not (_pode_gerir_pessoa(v_eu, v) or (v.id = v_eu.id and v_eu.perfil = 'company_admin')) then perform _erro('proibido'); end if;
    update perfis set area = _texto(p_area, 60) where id = p_pessoa returning * into v;
    perform _registrar('pessoa.area', v_eu, v.empresa_id, v.nome);
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

-- Matricula (ou só atualiza o prazo de quem já está matriculado).
create or replace function public._matricular(p_eu public.perfis, c public.cursos, p public.perfis, p_prazo date) returns public.matriculas
language plpgsql security definer set search_path = public as $$
declare m matriculas;
begin
    if c.id is null or p.id is null then perform _erro('nao-encontrado'); end if;
    if not (_curso_liberado(c, p) and p.ativo and (
            p.id = p_eu.id or p_eu.perfil in ('admin', 'consultant')
            or (p_eu.perfil = 'company_admin' and p.empresa_id = p_eu.empresa_id))) then
        perform _erro('proibido');
    end if;
    select * into m from matriculas where curso_id = c.id and usuario_id = p.id;
    if m.id is null then
        insert into matriculas (curso_id, usuario_id, prazo) values (c.id, p.id, p_prazo) returning * into m;
        perform _registrar('matricula.criada', p_eu, p.empresa_id, p.nome || ' — ' || c.titulo);
    elsif p_prazo is not null and p.id <> p_eu.id then
        update matriculas set prazo = p_prazo where id = m.id returning * into m;
    end if;
    return m;
end $$;

create or replace function public.matricular(p_curso uuid, p_pessoa uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_eu();
    c cursos;
    p perfis;
begin
    select * into c from cursos where id = p_curso;
    select * into p from perfis where id = coalesce(p_pessoa, v_eu.id);
    return to_jsonb(_matricular(v_eu, c, p, null));
end $$;

-- Atribuição em lote (uma chamada só), com prazo opcional.
create or replace function public.matricular_lote(p_curso uuid, p_pessoas uuid[], p_prazo date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_eu();
    c cursos;
    p perfis;
    n int := 0;
begin
    if v_eu.perfil not in ('admin', 'consultant', 'company_admin') then perform _erro('proibido'); end if;
    if p_prazo is not null and p_prazo < current_date then perform _erro('validacao', '{"prazo":"dataPassada"}'); end if;
    select * into c from cursos where id = p_curso;
    if c.id is null then perform _erro('nao-encontrado'); end if;
    for p in select * from perfis where id = any (p_pessoas[1:500]) loop
        perform _matricular(v_eu, c, p, p_prazo);
        n := n + 1;
    end loop;
    return jsonb_build_object('matriculados', n);
end $$;

-- Diagnóstico → treinamento: a consultoria libera um curso para a empresa num clique.
create or replace function public.liberar_curso(p_curso uuid, p_empresa uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_equipe();
    c cursos;
    e empresas;
begin
    select * into c from cursos where id = p_curso for update;
    select * into e from empresas where id = p_empresa;
    if c.id is null or e.id is null then perform _erro('nao-encontrado'); end if;
    if not (e.id = any (c.empresas)) then
        update cursos set empresas = empresas || e.id where id = c.id returning * into c;
        perform _registrar('curso.liberado', v_eu, e.id, c.titulo);
    end if;
    return jsonb_build_object('id', c.id, 'ativo', c.ativo, 'empresas', c.empresas);
end $$;

-- Verificação pública de autenticidade do certificado (pelo código impresso nele).
create or replace function public.validar_certificado(p_codigo text) returns jsonb
language sql stable security definer set search_path = public as $$
    select jsonb_build_object('codigo', codigo, 'nome', nome, 'curso', curso_titulo, 'cargaHoraria', carga_horaria,
                              'empresa', empresa_nome, 'emitidoEm', emitido_em)
    from certificados where codigo = upper(btrim(coalesce(p_codigo, ''))) limit 1
$$;

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

-- ---------------------------------------------------------- RPC: ranking --

-- Ranking por período (semana, mês ou total). Quem é da empresa vê só a própria;
-- a equipe escolhe a empresa ou vê todas. Traz o top 10, a posição de quem pede
-- (mesmo fora do top 10) e a média de pontos por área.
drop function if exists public.ranking_empresa();
create or replace function public.ranking_empresa(p_periodo text default 'total', p_empresa uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_eu();
    v_empresa uuid := case when v_eu.perfil in ('admin', 'consultant') then p_empresa else v_eu.empresa_id end;
    v_desde timestamptz := case p_periodo
        when 'semana' then now() - interval '7 days'
        when 'mes' then date_trunc('month', now())
        else '-infinity'::timestamptz end;
    v jsonb;
begin
    if v_empresa is null and v_eu.perfil not in ('admin', 'consultant') then perform _erro('proibido'); end if;
    with base as (
        select p.id, p.nome, p.area, p.empresa_id, e.nome as empresa,
               coalesce((select sum(pt.valor) from pontos pt where pt.usuario_id = p.id and pt.em >= v_desde), 0)::int as pontos,
               (select count(*) from matriculas m where m.usuario_id = p.id and m.concluido_em >= v_desde)::int as cursos,
               (select count(*) from pontos pt where pt.usuario_id = p.id and pt.tipo = 'kaizen' and pt.em >= v_desde)::int as kaizens
        from perfis p join empresas e on e.id = p.empresa_id
        where p.ativo and e.ativa and p.perfil in ('student', 'company_admin')
          and (v_empresa is null or p.empresa_id = v_empresa)
    ), ordenado as (
        select b.*, rank() over (order by b.pontos desc)::int as posicao from base b
    )
    select jsonb_build_object(
        'participantes', (select count(*) from ordenado),
        'itens', (select coalesce(jsonb_agg(to_jsonb(o) order by o.posicao, o.nome), '[]')
                  from (select * from ordenado order by posicao, nome limit 10) o),
        'voce', (select to_jsonb(o) from ordenado o where o.id = v_eu.id),
        'areas', (select coalesce(jsonb_agg(to_jsonb(a) order by a.media desc, a.area), '[]') from (
                  select area, count(*)::int as pessoas, round(avg(pontos))::int as media, sum(pontos)::int as pontos
                  from ordenado where area <> '' and v_empresa is not null group by area) a)
    ) into v;
    return v;
end $$;

-- ---------------------------------------------- RPC: cultura e maturidade --

create or replace function public._diagnostico_aberto(d public.diagnosticos) returns boolean
language sql stable as $$ select d.situacao = 'aberto' and (d.fecha_em is null or d.fecha_em >= current_date) $$;

-- Resultado agregado. Escala 1–5 vira 0–100 (perguntas invertidas são viradas antes).
-- Com menos respostas que o mínimo de anonimato, só os totais saem. Áreas e equipe
-- seguem o mesmo mínimo; a visão da liderança é avisada no questionário dos gestores.
-- p_completo = false: só o resumo (devolutiva para quem respondeu).
create or replace function public._resultado_diagnostico(d public.diagnosticos, p_completo boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_min int := d.anonimato_minimo;
    v_total int;
    v_gestores int;
    v_func int;
    v_elegiveis int;
    v jsonb;
begin
    select count(*), count(*) filter (where papel = 'gestor'), count(*) filter (where papel = 'funcionario')
      into v_total, v_gestores, v_func
      from diagnosticos_respostas where diagnostico_id = d.id;
    select count(*) into v_elegiveis from perfis
     where empresa_id = d.empresa_id and ativo
       and case d.publico when 'gestores' then perfil = 'company_admin'
                          when 'funcionarios' then perfil = 'student'
                          else perfil in ('company_admin', 'student') end;
    v := jsonb_build_object('respondentes', v_total, 'elegiveis', greatest(v_elegiveis, v_total),
        'gestores', v_gestores, 'funcionarios', v_func, 'anonimatoMinimo', v_min, 'oculto', v_total < v_min);
    if v_total < v_min then return v; end if;

    with q as (
        select x ->> 'id' as qid, x ->> 'dimensao' as dim, coalesce((x ->> 'invertida')::boolean, false) as inv, o
        from jsonb_array_elements(d.questoes) with ordinality as t(x, o)
    ), n as (
        select r.papel, r.area, q.qid, q.dim,
               case when q.inv then 6 - (r.respostas ->> q.qid)::int else (r.respostas ->> q.qid)::int end as nota
        from diagnosticos_respostas r join q on r.respostas ? q.qid
        where r.diagnostico_id = d.id
    )
    select v || jsonb_build_object(
        'geral', (select round(avg(nota - 1) * 25) from n),
        'dimensoes', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', dm ->> 'id',
                'score', (select round(avg(nota - 1) * 25) from n where n.dim = dm ->> 'id'),
                'lideranca', case when p_completo and v_gestores >= 1 and v_func >= v_min
                                  then (select round(avg(nota - 1) * 25) from n where n.dim = dm ->> 'id' and papel = 'gestor') end,
                'equipe', case when p_completo and v_gestores >= 1 and v_func >= v_min
                               then (select round(avg(nota - 1) * 25) from n where n.dim = dm ->> 'id' and papel = 'funcionario') end
            ) order by o), '[]') from jsonb_array_elements(d.dimensoes) with ordinality as t2(dm, o)),
        'questoes', case when p_completo then (select coalesce(jsonb_agg(jsonb_build_object(
                'id', q.qid, 'score', s.score, 'favoravel', s.fav, 'neutro', s.neu, 'desfavoravel', s.desf) order by q.o), '[]')
            from q cross join lateral (
                select round(avg(nota - 1) * 25) as score,
                       round(100.0 * count(*) filter (where nota >= 4) / nullif(count(*), 0)) as fav,
                       round(100.0 * count(*) filter (where nota = 3) / nullif(count(*), 0)) as neu,
                       round(100.0 * count(*) filter (where nota <= 2) / nullif(count(*), 0)) as desf
                from n where n.qid = q.qid) s) end,
        -- Áreas: só as com o mínimo de respostas. E se o que sobra fora delas (outras áreas
        -- e quem não tem área) for um grupo pequeno, nenhuma área aparece: senão "geral menos
        -- as áreas mostradas" revelaria esse grupo pequeno por subtração.
        'areas', case when p_completo then (
            select case when v_total - coalesce(sum(a.qtd), 0) between 1 and v_min - 1 then '[]'::jsonb
                        else coalesce(jsonb_agg(jsonb_build_object(
                            'area', a.area, 'respondentes', a.qtd, 'score', (select round(avg(nota - 1) * 25) from n where n.area = a.area))
                            order by a.area), '[]') end
            from (select area, count(*) as qtd from diagnosticos_respostas
                  where diagnostico_id = d.id and area <> '' group by area having count(*) >= v_min) a) end,
        'enps', case when d.enps then (
            select case when count(*) >= v_min then jsonb_build_object(
                'score', round(100.0 * (count(*) filter (where enps >= 9) - count(*) filter (where enps <= 6)) / count(*)),
                'promotores', count(*) filter (where enps >= 9),
                'neutros', count(*) filter (where enps between 7 and 8),
                'detratores', count(*) filter (where enps <= 6),
                'respostas', count(*)) end
            from diagnosticos_respostas where diagnostico_id = d.id and enps is not null) end,
        'comentarios', case when p_completo and d.comentarios then (
            select coalesce(jsonb_agg(comentario order by random()), '[]')
            from diagnosticos_respostas where diagnostico_id = d.id and comentario <> '') end
    ) into v;
    return v;
end $$;

create or replace function public.salvar_modelo_diagnostico(entrada jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_equipe();
    v_id uuid := nullif(entrada ->> 'id', '')::uuid;
    v_dim jsonb := coalesce(entrada -> 'dimensoes', '[]');
    v_q jsonb := coalesce(entrada -> 'questoes', '[]');
    v_niveis jsonb := coalesce(entrada -> 'niveis', '[]');
    erros jsonb := '{}';
    v diagnosticos_modelos;
begin
    if v_id is not null and not exists (select 1 from diagnosticos_modelos where id = v_id) then perform _erro('nao-encontrado'); end if;
    if jsonb_typeof(v_dim) <> 'array' or jsonb_typeof(v_q) <> 'array' or jsonb_typeof(v_niveis) <> 'array' then
        perform _erro('validacao', '{"dimensoes":"dimensoes"}');
    end if;
    if _texto(entrada ->> 'titulo', 150) = '' then erros := erros || '{"titulo":"obrigatorio"}'; end if;
    if jsonb_array_length(v_dim) not between 1 and 12
       or exists (select 1 from jsonb_array_elements(v_dim) x
                  where coalesce(x ->> 'id', '') !~ '^[a-z0-9_-]{1,40}$' or _texto(x ->> 'nome', 80) = '')
       or (select count(distinct x ->> 'id') from jsonb_array_elements(v_dim) x) <> jsonb_array_length(v_dim) then
        erros := erros || '{"dimensoes":"dimensoes"}';
    end if;
    if jsonb_array_length(v_q) not between 1 and 80
       or exists (select 1 from jsonb_array_elements(v_q) q
                  where coalesce(q ->> 'id', '') !~ '^[a-z0-9_-]{1,40}$' or _texto(q ->> 'texto', 300) = ''
                     or not exists (select 1 from jsonb_array_elements(v_dim) x where x ->> 'id' = q ->> 'dimensao'))
       or (select count(distinct q ->> 'id') from jsonb_array_elements(v_q) q) <> jsonb_array_length(v_q) then
        erros := erros || '{"questoes":"questoesModelo"}';
    end if;
    if jsonb_array_length(v_niveis) not in (0, 5) then erros := erros || '{"niveis":"niveis"}'; end if;
    if erros <> '{}' then perform _erro('validacao', erros); end if;

    v_dim := (select jsonb_agg(jsonb_build_object(
                'id', x ->> 'id', 'nome', _texto(x ->> 'nome', 80), 'descricao', _texto(x ->> 'descricao', 300),
                'recomendacao', _texto(x ->> 'recomendacao', 800),
                'cursos', (select coalesce(jsonb_agg(c.id), '[]') from cursos c
                           where c.id::text in (select jsonb_array_elements_text(
                               case when jsonb_typeof(x -> 'cursos') = 'array' then x -> 'cursos' else '[]' end))))
              order by o) from jsonb_array_elements(v_dim) with ordinality as t(x, o));
    v_q := (select jsonb_agg(jsonb_build_object('id', q ->> 'id', 'dimensao', q ->> 'dimensao', 'texto', _texto(q ->> 'texto', 300),
                'invertida', coalesce((q ->> 'invertida')::boolean, false)) order by o)
            from jsonb_array_elements(v_q) with ordinality as t(q, o));
    v_niveis := (select coalesce(jsonb_agg(_texto(n, 40) order by o), '[]') from jsonb_array_elements_text(v_niveis) with ordinality as t(n, o));

    if v_id is null then
        insert into diagnosticos_modelos (titulo, descricao, norma, interpretacao, niveis, dimensoes, questoes, publicado)
        values (_texto(entrada ->> 'titulo', 150), _texto(entrada ->> 'descricao', 800), _texto(entrada ->> 'norma', 300),
                case when entrada ->> 'interpretacao' = 'risco' then 'risco' else 'maturidade' end,
                v_niveis, v_dim, v_q, coalesce((entrada ->> 'publicado')::boolean, true))
        returning * into v;
        perform _registrar('modelo.criado', v_eu, null, v.titulo);
    else
        update diagnosticos_modelos set
            titulo = _texto(entrada ->> 'titulo', 150), descricao = _texto(entrada ->> 'descricao', 800),
            norma = _texto(entrada ->> 'norma', 300),
            interpretacao = case when entrada ->> 'interpretacao' = 'risco' then 'risco' else 'maturidade' end,
            niveis = v_niveis, dimensoes = v_dim, questoes = v_q, publicado = coalesce((entrada ->> 'publicado')::boolean, true)
        where id = v_id returning * into v;
        perform _registrar('modelo.atualizado', v_eu, null, v.titulo);
    end if;
    return to_jsonb(v);
end $$;

-- Lança um diagnóstico numa empresa: a consultoria em qualquer empresa ativa; o gestor na dele.
-- extras: até 10 perguntas próprias da empresa, cada uma ligada a uma dimensão do modelo.
create or replace function public.criar_diagnostico(entrada jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_eu();
    v_empresa uuid;
    v_extras jsonb := case when jsonb_typeof(entrada -> 'extras') = 'array' then entrada -> 'extras' else '[]' end;
    v_fecha date;
    e empresas;
    m diagnosticos_modelos;
    erros jsonb := '{}';
    v diagnosticos;
begin
    if v_eu.perfil not in ('admin', 'consultant', 'company_admin') then perform _erro('proibido'); end if;
    v_empresa := case when v_eu.perfil = 'company_admin' then v_eu.empresa_id else nullif(entrada ->> 'empresaId', '')::uuid end;
    select * into e from empresas where id = v_empresa and ativa;
    if e.id is null then erros := erros || '{"empresaId":"obrigatorio"}'; end if;
    select * into m from diagnosticos_modelos
     where id = nullif(entrada ->> 'modeloId', '')::uuid and (publicado or v_eu.perfil in ('admin', 'consultant'));
    if m.id is null then
        erros := erros || '{"modeloId":"obrigatorio"}';
    elsif e.id is not null and exists (select 1 from diagnosticos x where x.empresa_id = e.id and x.modelo_id = m.id and _diagnostico_aberto(x)) then
        erros := erros || '{"modeloId":"diagnosticoAberto"}';
    end if;
    if jsonb_array_length(v_extras) > 10
       or (m.id is not null and exists (select 1 from jsonb_array_elements(v_extras) x
              where _texto(x ->> 'texto', 300) = ''
                 or not exists (select 1 from jsonb_array_elements(m.dimensoes) dm where dm ->> 'id' = x ->> 'dimensao'))) then
        erros := erros || '{"extras":"extras"}';
    end if;
    v_fecha := nullif(entrada ->> 'fechaEm', '')::date;
    if v_fecha is not null and v_fecha < current_date then erros := erros || '{"fechaEm":"dataPassada"}'; end if;
    if erros <> '{}' then perform _erro('validacao', erros); end if;

    insert into diagnosticos (empresa_id, modelo_id, titulo, norma, interpretacao, niveis, dimensoes, questoes,
                              publico, enps, comentarios, anonimato_minimo, fecha_em, criado_por)
    values (e.id, m.id, coalesce(nullif(_texto(entrada ->> 'titulo', 150), ''), m.titulo), m.norma, m.interpretacao, m.niveis, m.dimensoes,
            m.questoes || coalesce((select jsonb_agg(jsonb_build_object('id', 'extra-' || o, 'dimensao', x ->> 'dimensao',
                'texto', _texto(x ->> 'texto', 300), 'invertida', false, 'extra', true) order by o)
                from jsonb_array_elements(v_extras) with ordinality as t(x, o)), '[]'),
            case when entrada ->> 'publico' in ('todos', 'funcionarios', 'gestores') then entrada ->> 'publico' else 'todos' end,
            coalesce((entrada ->> 'enps')::boolean, true), coalesce((entrada ->> 'comentarios')::boolean, true),
            least(20, greatest(3, coalesce((entrada ->> 'anonimatoMinimo')::int, 3))), v_fecha, v_eu.id)
    returning * into v;
    perform _registrar('diagnostico.criado', v_eu, e.id, v.titulo);
    return to_jsonb(v);
end $$;

create or replace function public._diagnostico_gerivel(p_eu public.perfis, p_id uuid) returns public.diagnosticos
language plpgsql security definer set search_path = public as $$
declare d diagnosticos;
begin
    select * into d from diagnosticos where id = p_id for update;
    if d.id is null then perform _erro('nao-encontrado'); end if;
    if not (p_eu.perfil in ('admin', 'consultant') or (p_eu.perfil = 'company_admin' and p_eu.empresa_id = d.empresa_id)) then
        perform _erro('proibido');
    end if;
    return d;
end $$;

create or replace function public.encerrar_diagnostico(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_eu perfis := _exigir_eu(); d diagnosticos := _diagnostico_gerivel(v_eu, p_id);
begin
    update diagnosticos set situacao = 'encerrado', encerrado_em = now() where id = d.id returning * into d;
    perform _registrar('diagnostico.encerrado', v_eu, d.empresa_id, d.titulo);
    return to_jsonb(d);
end $$;

create or replace function public.reabrir_diagnostico(p_id uuid, p_fecha_em date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_eu perfis := _exigir_eu(); d diagnosticos := _diagnostico_gerivel(v_eu, p_id);
begin
    if p_fecha_em is not null and p_fecha_em < current_date then perform _erro('validacao', '{"fechaEm":"dataPassada"}'); end if;
    if exists (select 1 from diagnosticos x where x.empresa_id = d.empresa_id and x.modelo_id = d.modelo_id and x.id <> d.id and _diagnostico_aberto(x)) then
        perform _erro('validacao', '{"diagnostico":"diagnosticoAberto"}');
    end if;
    update diagnosticos set situacao = 'aberto', encerrado_em = null, fecha_em = p_fecha_em where id = d.id returning * into d;
    perform _registrar('diagnostico.reaberto', v_eu, d.empresa_id, d.titulo);
    return to_jsonb(d);
end $$;

-- Só sem respostas (para desfazer um lançamento por engano).
create or replace function public.excluir_diagnostico(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu perfis := _exigir_eu(); d diagnosticos := _diagnostico_gerivel(v_eu, p_id);
begin
    if exists (select 1 from diagnosticos_participacoes where diagnostico_id = d.id) then
        perform _erro('validacao', '{"diagnostico":"comRespostas"}');
    end if;
    delete from diagnosticos where id = d.id;
    perform _registrar('diagnostico.excluido', v_eu, d.empresa_id, d.titulo);
end $$;

-- Resposta anônima: a participação e as respostas vão para tabelas sem ligação entre si.
create or replace function public.responder_diagnostico(p_id uuid, p_respostas jsonb, p_enps int default null, p_comentario text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_eu();
    d diagnosticos;
    v_respostas jsonb;
begin
    select * into d from diagnosticos where id = p_id;
    if d.id is null or d.empresa_id is distinct from v_eu.empresa_id then perform _erro('nao-encontrado'); end if;
    if not _diagnostico_aberto(d) then perform _erro('validacao', '{"diagnostico":"diagnosticoEncerrado"}'); end if;
    if not (d.publico = 'todos' or (d.publico = 'gestores' and v_eu.perfil = 'company_admin')
            or (d.publico = 'funcionarios' and v_eu.perfil = 'student')) then
        perform _erro('proibido');
    end if;
    if exists (select 1 from diagnosticos_participacoes where diagnostico_id = d.id and usuario_id = v_eu.id) then
        perform _erro('validacao', '{"diagnostico":"jaRespondido"}');
    end if;
    if jsonb_typeof(p_respostas) is distinct from 'object'
       or exists (select 1 from jsonb_array_elements(d.questoes) q where coalesce(p_respostas ->> (q ->> 'id'), '') !~ '^[1-5]$')
       or (d.enps and (p_enps is null or p_enps not between 0 and 10)) then
        perform _erro('validacao', '{"diagnostico":"respondaTodas"}');
    end if;
    select jsonb_object_agg(q ->> 'id', (p_respostas ->> (q ->> 'id'))::int) into v_respostas from jsonb_array_elements(d.questoes) q;

    insert into diagnosticos_participacoes (diagnostico_id, usuario_id) values (d.id, v_eu.id);
    insert into diagnosticos_respostas (diagnostico_id, papel, area, respostas, enps, comentario)
    values (d.id, case when v_eu.perfil = 'company_admin' then 'gestor' else 'funcionario' end, v_eu.area, v_respostas,
            case when d.enps then p_enps end, case when d.comentarios then _texto(p_comentario, 600) else '' end);
    return jsonb_build_object('pontosGanhos', _somar_pontos(v_eu.id, 'diagnostico', d.id::text, 15));
end $$;

create or replace function public._publico_inclui(p_publico text, p_perfil text) returns boolean
language sql immutable as $$
    select case p_publico when 'gestores' then p_perfil = 'company_admin'
                          when 'funcionarios' then p_perfil = 'student'
                          else p_perfil in ('company_admin', 'student') end
$$;

-- Lista com a contagem de respostas (a tabela de participações não é lida pelo gestor).
create or replace function public.listar_diagnosticos(p_empresa uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_eu perfis := _exigir_eu();
begin
    return (select coalesce(jsonb_agg((to_jsonb(d) - 'questoes') || jsonb_build_object(
            'empresa_nome', e.nome,
            'aberto', _diagnostico_aberto(d),
            'perguntas', jsonb_array_length(d.questoes),
            'respondentes', (select count(*) from diagnosticos_participacoes p where p.diagnostico_id = d.id),
            'elegiveis', (select count(*) from perfis pf where pf.empresa_id = d.empresa_id and pf.ativo and _publico_inclui(d.publico, pf.perfil)),
            'respondi', exists (select 1 from diagnosticos_participacoes p where p.diagnostico_id = d.id and p.usuario_id = v_eu.id),
            'posso_responder', d.empresa_id = v_eu.empresa_id and _publico_inclui(d.publico, v_eu.perfil)
        ) order by d.criado_em desc), '[]')
        from diagnosticos d join empresas e on e.id = d.empresa_id
        where case when v_eu.perfil in ('admin', 'consultant') then p_empresa is null or d.empresa_id = p_empresa
                   else d.empresa_id = v_eu.empresa_id end);
end $$;

-- Equipe e gestor da empresa: resultado completo (com o histórico do mesmo modelo na empresa,
-- para a evolução). Quem é da empresa: o resumo, depois de encerrado.
create or replace function public.resultado_diagnostico(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_eu();
    d diagnosticos;
    v_completo boolean;
begin
    select * into d from diagnosticos where id = p_id;
    if d.id is null then perform _erro('nao-encontrado'); end if;
    v_completo := v_eu.perfil in ('admin', 'consultant') or (v_eu.perfil = 'company_admin' and v_eu.empresa_id = d.empresa_id);
    if not v_completo and not (v_eu.empresa_id = d.empresa_id and not _diagnostico_aberto(d)) then perform _erro('proibido'); end if;
    return _resultado_diagnostico(d, v_completo) || jsonb_build_object('completo', v_completo,
        'historico', case when v_completo then (
            select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'titulo', x.titulo, 'criadoEm', x.criado_em,
                       'geral', rr.r -> 'geral', 'dimensoes', rr.r -> 'dimensoes') order by x.criado_em), '[]')
            from diagnosticos x cross join lateral (select _resultado_diagnostico(x, false) as r) rr
            where x.empresa_id = d.empresa_id and x.modelo_id is not distinct from d.modelo_id and x.criado_em <= d.criado_em) end);
end $$;

-- Panorama da consultoria: o diagnóstico mais recente de um modelo em cada empresa ativa
-- (e a nota geral do anterior, para a tendência).
create or replace function public.panorama_maturidade(p_modelo uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_eu perfis := _exigir_equipe();
begin
    return (select coalesce(jsonb_agg(linha order by nome), '[]') from (
        select e.nome, jsonb_build_object(
            'empresa', jsonb_build_object('id', e.id, 'nome', e.nome, 'cor', e.cor),
            'diagnostico', jsonb_build_object('id', (ul.d).id, 'titulo', (ul.d).titulo, 'situacao', (ul.d).situacao,
                'aberto', _diagnostico_aberto(ul.d), 'criadoEm', (ul.d).criado_em),
            'resultado', _resultado_diagnostico(ul.d, false),
            'anterior', case when an.d is null then null else _resultado_diagnostico(an.d, false) -> 'geral' end) as linha
        from empresas e
        join lateral (select x as d from diagnosticos x where x.empresa_id = e.id and x.modelo_id = p_modelo
                      order by x.criado_em desc limit 1) ul on true
        left join lateral (select x as d from diagnosticos x where x.empresa_id = e.id and x.modelo_id = p_modelo
                           and x.criado_em < (ul.d).criado_em order by x.criado_em desc limit 1) an on true
        where e.ativa) s);
end $$;

-- Saúde de cada empresa cliente: engajamento, cursos, kaizen e a maturidade mais recente.
create or replace function public.panorama_empresas() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_eu perfis := _exigir_equipe();
begin
    return (select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'nome', e.nome, 'cor', e.cor,
        'pessoas', (select count(*) from perfis p where p.empresa_id = e.id and p.ativo),
        'ativos30', (select count(*) from perfis p where p.empresa_id = e.id and p.ativo and p.ultimo_acesso >= now() - interval '30 days'),
        'pontos30', (select coalesce(sum(pt.valor), 0) from pontos pt join perfis p on p.id = pt.usuario_id
                     where p.empresa_id = e.id and pt.em >= now() - interval '30 days'),
        'matriculas', (select count(*) from matriculas m join perfis p on p.id = m.usuario_id where p.empresa_id = e.id),
        'concluidas', (select count(*) from matriculas m join perfis p on p.id = m.usuario_id where p.empresa_id = e.id and m.concluido_em is not null),
        'kaizensAbertos', (select count(*) from kaizens k where k.empresa_id = e.id and k.etapa in ('ideia', 'planejar', 'executar', 'verificar')),
        'kaizensConcluidos', (select count(*) from kaizens k where k.empresa_id = e.id and k.etapa = 'concluido'),
        'economia', (select coalesce(sum(k.economia), 0) from kaizens k where k.empresa_id = e.id and k.etapa = 'concluido'),
        'horas', (select coalesce(sum(k.horas), 0) from kaizens k where k.empresa_id = e.id and k.etapa = 'concluido'),
        'maturidade', (select jsonb_build_object('diagnosticoId', (u.d).id, 'titulo', (u.d).titulo, 'interpretacao', (u.d).interpretacao,
                           'niveis', (u.d).niveis, 'criadoEm', (u.d).criado_em, 'aberto', _diagnostico_aberto(u.d),
                           'geral', _resultado_diagnostico(u.d, false) -> 'geral')
                       from (select x as d from diagnosticos x where x.empresa_id = e.id order by x.criado_em desc limit 1) u)
        ) order by e.nome), '[]') from empresas e where e.ativa);
end $$;

-- ------------------------------------------------------------ RPC: kaizen --

create or replace function public._pode_ver_kaizen(p_eu public.perfis, k public.kaizens) returns boolean
language sql stable as $$ select coalesce(p_eu.perfil in ('admin', 'consultant') or p_eu.empresa_id = k.empresa_id, false) $$;

create or replace function public._pode_aprovar_kaizen(p_eu public.perfis, k public.kaizens) returns boolean
language sql stable as $$
    select coalesce(p_eu.perfil in ('admin', 'consultant') or (p_eu.perfil = 'company_admin' and p_eu.empresa_id = k.empresa_id), false)
$$;

create or replace function public._pode_editar_kaizen(p_eu public.perfis, k public.kaizens) returns boolean
language sql stable as $$
    select coalesce(_pode_aprovar_kaizen(p_eu, k)
        or (p_eu.empresa_id = k.empresa_id
            and (p_eu.id = k.autor_id or p_eu.id = k.responsavel_id or p_eu.id = any (k.membros))), false)
$$;

create or replace function public._evento_kaizen(p_kaizen uuid, p_eu public.perfis, p_tipo text, p_texto text) returns void
language sql security definer set search_path = public as $$
    insert into kaizens_eventos (kaizen_id, autor_id, autor_nome, tipo, texto)
    values (p_kaizen, p_eu.id, p_eu.nome, p_tipo, left(coalesce(p_texto, ''), 1000))
$$;

-- Os nomes vêm junto: quem é da empresa não lê o perfil dos colegas pela API.
create or replace function public._kaizen_json(k public.kaizens) returns jsonb
language sql stable security definer set search_path = public as $$
    select to_jsonb(k) || jsonb_build_object(
        'autor_nome', (select nome from perfis where id = k.autor_id),
        'responsavel_nome', (select nome from perfis where id = k.responsavel_id),
        'membros_nomes', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome) order by nome), '[]')
                          from perfis where id = any (k.membros)),
        'empresa_nome', (select nome from empresas where id = k.empresa_id),
        'comentarios', (select count(*) from kaizens_eventos where kaizen_id = k.id and tipo in ('comentario', 'parecer')))
$$;

create or replace function public.listar_kaizens(p_empresa uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_eu perfis := _exigir_eu();
begin
    return (select coalesce(jsonb_agg(_kaizen_json(k) order by k.atualizado_em desc), '[]') from kaizens k
            where case when v_eu.perfil in ('admin', 'consultant') then p_empresa is null or k.empresa_id = p_empresa
                       else k.empresa_id = v_eu.empresa_id end);
end $$;

create or replace function public.obter_kaizen(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_eu perfis := _exigir_eu(); k kaizens;
begin
    select * into k from kaizens where id = p_id;
    if k.id is null or not _pode_ver_kaizen(v_eu, k) then perform _erro('nao-encontrado'); end if;
    return _kaizen_json(k) || jsonb_build_object(
        'eventos', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'tipo', tipo, 'texto', texto, 'autorNome', autor_nome, 'em', em)
                    order by em, id), '[]') from kaizens_eventos where kaizen_id = k.id),
        'pode', jsonb_build_object('editar', _pode_editar_kaizen(v_eu, k), 'aprovar', _pode_aprovar_kaizen(v_eu, k),
                                   'parecer', v_eu.perfil in ('admin', 'consultant')));
end $$;

-- Pessoas ativas da empresa (nome e área), para escolher responsável e equipe do kaizen.
create or replace function public.colegas(p_empresa uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_eu();
    v_empresa uuid := case when v_eu.perfil in ('admin', 'consultant') then p_empresa else v_eu.empresa_id end;
begin
    if v_empresa is null then return '[]'; end if;
    return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'area', area, 'perfil', perfil) order by nome), '[]')
            from perfis where empresa_id = v_empresa and ativo);
end $$;

create or replace function public.salvar_kaizen(entrada jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_eu();
    v_id uuid := nullif(entrada ->> 'id', '')::uuid;
    v_resp uuid := nullif(entrada ->> 'responsavelId', '')::uuid;
    v_empresa uuid;
    v_membros uuid[];
    v_porques jsonb;
    v_prazo date := nullif(entrada ->> 'prazo', '')::date;
    ganhos int := 0;
    erros jsonb := '{}';
    k kaizens;
begin
    if v_id is not null then
        select * into k from kaizens where id = v_id for update;
        if k.id is null or not _pode_ver_kaizen(v_eu, k) then perform _erro('nao-encontrado'); end if;
        if not _pode_editar_kaizen(v_eu, k) then perform _erro('proibido'); end if;
        v_empresa := k.empresa_id;
    else
        v_empresa := case when v_eu.perfil in ('admin', 'consultant') then nullif(entrada ->> 'empresaId', '')::uuid else v_eu.empresa_id end;
        if v_empresa is null or not exists (select 1 from empresas where id = v_empresa and ativa) then
            erros := erros || '{"empresaId":"obrigatorio"}';
        end if;
    end if;
    if _texto(entrada ->> 'titulo', 150) = '' then erros := erros || '{"titulo":"obrigatorio"}'; end if;
    if _texto(entrada ->> 'problema', 2000) = '' then erros := erros || '{"problema":"obrigatorio"}'; end if;
    if v_resp is not null and not exists (select 1 from perfis where id = v_resp and empresa_id = v_empresa and ativo) then
        erros := erros || '{"responsavelId":"obrigatorio"}';
    end if;
    if coalesce(entrada ->> 'economia', '0') !~ '^\d{1,12}(\.\d{1,2})?$' then erros := erros || '{"economia":"numero"}'; end if;
    if coalesce(entrada ->> 'horas', '0') !~ '^\d{1,9}(\.\d)?$' then erros := erros || '{"horas":"numero"}'; end if;
    if erros <> '{}' then perform _erro('validacao', erros); end if;

    select coalesce(array_agg(p.id), '{}') into v_membros from perfis p
     where p.empresa_id = v_empresa and p.ativo
       and p.id::text in (select jsonb_array_elements_text(case when jsonb_typeof(entrada -> 'membros') = 'array' then entrada -> 'membros' else '[]' end));
    v_porques := (select coalesce(jsonb_agg(_texto(x, 300) order by o), '[]')
                  from jsonb_array_elements_text(case when jsonb_typeof(entrada -> 'porques') = 'array' then entrada -> 'porques' else '[]' end)
                       with ordinality as t(x, o)
                  where o <= 5 and _texto(x, 300) <> '');

    if v_id is null then
        perform pg_advisory_xact_lock(hashtext('kaizen:' || v_empresa::text));
        insert into kaizens (empresa_id, numero, titulo, problema, situacao_atual, porques, causa_raiz, contramedida, meta,
                             resultado, padronizacao, dimensao, area, autor_id, responsavel_id, membros, economia, horas, prazo)
        values (v_empresa, coalesce((select max(numero) from kaizens where empresa_id = v_empresa), 0) + 1,
                _texto(entrada ->> 'titulo', 150), _texto(entrada ->> 'problema', 2000), _texto(entrada ->> 'situacaoAtual', 2000),
                v_porques, _texto(entrada ->> 'causaRaiz', 1000), _texto(entrada ->> 'contramedida', 2000), _texto(entrada ->> 'meta', 500),
                _texto(entrada ->> 'resultado', 2000), _texto(entrada ->> 'padronizacao', 1000), _texto(entrada ->> 'dimensao', 120),
                _texto(entrada ->> 'area', 60), v_eu.id,
                coalesce(v_resp, case when v_eu.empresa_id = v_empresa then v_eu.id end), v_membros,
                coalesce((entrada ->> 'economia')::numeric, 0), coalesce((entrada ->> 'horas')::numeric, 0), v_prazo)
        returning * into k;
        perform _evento_kaizen(k.id, v_eu, 'criado', '');
        if v_eu.empresa_id = v_empresa then ganhos := _somar_pontos(v_eu.id, 'kaizen_ideia', k.id::text, 10); end if;
        perform _registrar('kaizen.criado', v_eu, v_empresa, 'KZ-' || lpad(k.numero::text, 3, '0') || ' ' || k.titulo);
    else
        update kaizens set
            titulo = _texto(entrada ->> 'titulo', 150), problema = _texto(entrada ->> 'problema', 2000),
            situacao_atual = _texto(entrada ->> 'situacaoAtual', 2000), porques = v_porques,
            causa_raiz = _texto(entrada ->> 'causaRaiz', 1000), contramedida = _texto(entrada ->> 'contramedida', 2000),
            meta = _texto(entrada ->> 'meta', 500), resultado = _texto(entrada ->> 'resultado', 2000),
            padronizacao = _texto(entrada ->> 'padronizacao', 1000), dimensao = _texto(entrada ->> 'dimensao', 120),
            area = _texto(entrada ->> 'area', 60), responsavel_id = v_resp, membros = v_membros,
            economia = coalesce((entrada ->> 'economia')::numeric, 0), horas = coalesce((entrada ->> 'horas')::numeric, 0),
            prazo = v_prazo, atualizado_em = now()
        where id = k.id returning * into k;
        perform _registrar('kaizen.atualizado', v_eu, v_empresa, 'KZ-' || lpad(k.numero::text, 3, '0') || ' ' || k.titulo);
    end if;
    return _kaizen_json(k) || jsonb_build_object('pontosGanhos', ganhos);
end $$;

-- Mudança de etapa (PDCA). Concluir exige o resultado registrado e a aprovação do gestor
-- (ou da consultoria); aí todos os envolvidos ganham os pontos.
create or replace function public.mover_kaizen(p_id uuid, p_etapa text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_eu perfis := _exigir_eu();
    k kaizens;
    v_pessoa uuid;
    ganhos int := 0;
    v_ganho int;
begin
    select * into k from kaizens where id = p_id for update;
    if k.id is null or not _pode_ver_kaizen(v_eu, k) then perform _erro('nao-encontrado'); end if;
    if p_etapa not in ('ideia', 'planejar', 'executar', 'verificar', 'concluido', 'arquivado') then perform _erro('validacao', '{"etapa":"etapa"}'); end if;
    if not _pode_editar_kaizen(v_eu, k) then perform _erro('proibido'); end if;
    if p_etapa = k.etapa then return _kaizen_json(k) || '{"pontosGanhos":0}'; end if;
    if (p_etapa = 'concluido' or k.etapa = 'concluido') and not _pode_aprovar_kaizen(v_eu, k) then
        perform _erro('validacao', '{"etapa":"aprovacaoGestor"}');
    end if;
    if p_etapa = 'concluido' and _texto(k.resultado, 2000) = '' then perform _erro('validacao', '{"etapa":"semResultado"}'); end if;

    update kaizens set etapa = p_etapa, atualizado_em = now(),
                       concluido_em = case when p_etapa = 'concluido' then now() end
    where id = k.id returning * into k;
    perform _evento_kaizen(k.id, v_eu, 'etapa', p_etapa);
    if p_etapa = 'concluido' then
        for v_pessoa in select distinct x from unnest(array[k.autor_id, k.responsavel_id] || k.membros) x
                        where x is not null and exists (select 1 from perfis where id = x and empresa_id = k.empresa_id) loop
            v_ganho := _somar_pontos(v_pessoa, 'kaizen', k.id::text, 60);
            if v_pessoa = v_eu.id then ganhos := v_ganho; end if;
        end loop;
        perform _registrar('kaizen.concluido', v_eu, k.empresa_id, 'KZ-' || lpad(k.numero::text, 3, '0') || ' ' || k.titulo);
    else
        perform _registrar('kaizen.etapa', v_eu, k.empresa_id, 'KZ-' || lpad(k.numero::text, 3, '0') || ' ' || k.titulo);
    end if;
    return _kaizen_json(k) || jsonb_build_object('pontosGanhos', ganhos);
end $$;

create or replace function public.comentar_kaizen(p_id uuid, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu perfis := _exigir_eu(); k kaizens;
begin
    select * into k from kaizens where id = p_id;
    if k.id is null or not _pode_ver_kaizen(v_eu, k) then perform _erro('nao-encontrado'); end if;
    if _texto(p_texto, 1000) = '' then perform _erro('validacao', '{"texto":"obrigatorio"}'); end if;
    perform _evento_kaizen(k.id, v_eu, 'comentario', _texto(p_texto, 1000));
    update kaizens set atualizado_em = now() where id = k.id;
end $$;

-- Parecer da consultoria e marcação de boa prática (destaque).
create or replace function public.parecer_kaizen(p_id uuid, p_texto text, p_destaque boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu perfis := _exigir_equipe(); k kaizens;
begin
    select * into k from kaizens where id = p_id for update;
    if k.id is null then perform _erro('nao-encontrado'); end if;
    update kaizens set destaque = coalesce(p_destaque, false), atualizado_em = now() where id = k.id;
    if _texto(p_texto, 1000) <> '' then perform _evento_kaizen(k.id, v_eu, 'parecer', _texto(p_texto, 1000)); end if;
    perform _registrar('kaizen.parecer', v_eu, k.empresa_id, 'KZ-' || lpad(k.numero::text, 3, '0') || ' ' || k.titulo);
end $$;

-- ----------------------------------------- modelos de diagnóstico (padrão) --
-- Questionários de referência que já vêm com a plataforma. Escala Likert de 1 a 5
-- (discordo totalmente → concordo totalmente). "invertida": a pergunta descreve um
-- problema, então concordar puxa a nota para baixo. Rodar o arquivo de novo não
-- sobrescreve as edições feitas pela consultoria (on conflict do nothing).

insert into public.diagnosticos_modelos (id, titulo, descricao, norma, interpretacao, niveis, dimensoes, questoes, padrao) values
(
    'a0000000-0000-4000-8000-000000000001',
    'Maturidade da gestão e da cultura',
    'Autoavaliação de maturidade em 5 níveis inspirada na ISO 9004, organizada pelos 7 princípios da gestão da qualidade. Mostra onde a cultura apoia a estratégia e onde trava.',
    'ABNT NBR ISO 9001:2015 · ISO 9004:2018 (autoavaliação de maturidade) · 7 princípios da gestão da qualidade (ISO 9000:2015)',
    'maturidade', '[]',
    $j$[
      {"id":"cliente","nome":"Foco no cliente","descricao":"Entender e atender as necessidades de quem recebe o nosso trabalho.","recomendacao":"Levar a voz do cliente (reclamações, pesquisas e indicadores de satisfação) para as reuniões de rotina e capacitar a linha de frente em atendimento e tratamento de reclamações.","cursos":[]},
      {"id":"lideranca","nome":"Liderança","descricao":"Direção clara, coerência e exemplo de quem lidera.","recomendacao":"Desdobrar os objetivos em metas por equipe, criar rituais curtos de comunicação da liderança e trabalhar a coerência entre discurso e prática num programa de desenvolvimento de líderes.","cursos":[]},
      {"id":"pessoas","nome":"Engajamento das pessoas","descricao":"Autonomia, reconhecimento e desenvolvimento.","recomendacao":"Estruturar trilhas de capacitação por função, criar um ritual de reconhecimento e ampliar a autonomia com limites claros de decisão.","cursos":[]},
      {"id":"processos","nome":"Abordagem de processo","descricao":"Trabalho padronizado e integrado entre áreas.","recomendacao":"Mapear os processos críticos (SIPOC), padronizar o trabalho com procedimentos visuais e definir donos de processo com indicadores.","cursos":[]},
      {"id":"melhoria","nome":"Melhoria contínua","descricao":"Aprender com erros e melhorar todo dia.","recomendacao":"Implantar um programa de Kaizen com ciclo PDCA, análise de causa raiz (5 porquês e Ishikawa) e celebração dos ganhos.","cursos":[]},
      {"id":"evidencias","nome":"Decisões baseadas em evidências","descricao":"Dados e fatos orientando as decisões.","recomendacao":"Definir poucos indicadores-chave por área, criar quadros de gestão à vista e uma rotina curta de análise dos resultados.","cursos":[]},
      {"id":"relacionamentos","nome":"Gestão de relacionamentos","descricao":"Colaboração entre áreas, fornecedores e parceiros.","recomendacao":"Criar fóruns entre áreas, acordos internos de nível de serviço e avaliação conjunta com os fornecedores-chave.","cursos":[]}
    ]$j$,
    $j$[
      {"id":"cli1","dimensao":"cliente","texto":"Sabemos com clareza o que os nossos clientes esperam do nosso trabalho."},
      {"id":"cli2","dimensao":"cliente","texto":"As reclamações e sugestões dos clientes chegam até a minha equipe e geram ações."},
      {"id":"cli3","dimensao":"cliente","texto":"Medimos a satisfação dos clientes e usamos o resultado para melhorar."},
      {"id":"lid1","dimensao":"lideranca","texto":"A liderança comunica com clareza para onde a empresa está indo."},
      {"id":"lid2","dimensao":"lideranca","texto":"Os líderes agem de acordo com o que falam."},
      {"id":"lid3","dimensao":"lideranca","texto":"Sei como o meu trabalho contribui para os objetivos da empresa."},
      {"id":"pes1","dimensao":"pessoas","texto":"Tenho autonomia e recursos para fazer bem o meu trabalho."},
      {"id":"pes2","dimensao":"pessoas","texto":"As pessoas são reconhecidas pelas suas contribuições."},
      {"id":"pes3","dimensao":"pessoas","texto":"Recebo o treinamento de que preciso para desempenhar a minha função."},
      {"id":"pro1","dimensao":"processos","texto":"As atividades da minha área seguem um padrão conhecido por todos."},
      {"id":"pro2","dimensao":"processos","texto":"Sei quem são os fornecedores e os clientes internos do meu trabalho."},
      {"id":"pro3","dimensao":"processos","texto":"Quando um processo muda, as áreas envolvidas são avisadas a tempo."},
      {"id":"mel1","dimensao":"melhoria","texto":"Aqui é normal sugerir melhorias, e elas são levadas a sério."},
      {"id":"mel2","dimensao":"melhoria","texto":"Quando ocorre um erro, buscamos a causa em vez de culpados."},
      {"id":"mel3","dimensao":"melhoria","texto":"Temos tempo e espaço para implantar melhorias no dia a dia."},
      {"id":"evi1","dimensao":"evidencias","texto":"As decisões importantes se apoiam em dados e fatos."},
      {"id":"evi2","dimensao":"evidencias","texto":"Os indicadores da minha área são acompanhados com regularidade."},
      {"id":"evi3","dimensao":"evidencias","texto":"Tenho acesso às informações de que preciso para decidir bem."},
      {"id":"rel1","dimensao":"relacionamentos","texto":"As áreas colaboram entre si para resolver problemas."},
      {"id":"rel2","dimensao":"relacionamentos","texto":"A empresa mantém uma boa relação com fornecedores e parceiros."},
      {"id":"rel3","dimensao":"relacionamentos","texto":"Há respeito e confiança entre pessoas de diferentes níveis."}
    ]$j$,
    true
),
(
    'a0000000-0000-4000-8000-000000000002',
    'Riscos psicossociais no trabalho',
    'Levantamento da percepção das pessoas sobre os fatores de risco psicossocial, para apoiar a identificação de perigos e a avaliação de riscos do GRO/PGR. Não substitui a análise técnica do responsável pelo PGR.',
    'NR-1 (GRO/PGR, atualizada pela Portaria MTE nº 1.419/2024) · ABNT NBR ISO 45003:2021 · ABNT NBR ISO 45001:2018',
    'risco', '[]',
    $j$[
      {"id":"demandas","nome":"Demandas e ritmo de trabalho","descricao":"Carga, prazos e pressão.","recomendacao":"Revisar a distribuição da carga e as metas com a equipe, mapear os picos de demanda e combinar prioridades. Registrar no PGR as medidas de controle adotadas.","cursos":[]},
      {"id":"autonomia","nome":"Autonomia e controle","descricao":"Voz sobre como o trabalho é feito.","recomendacao":"Envolver as pessoas no planejamento das tarefas, permitir pausas e consultar a equipe antes de mudanças que a afetam.","cursos":[]},
      {"id":"apoio","nome":"Apoio da liderança e dos colegas","descricao":"Suporte e retorno no dia a dia.","recomendacao":"Capacitar as lideranças em feedback e escuta ativa e criar momentos regulares de conversa individual (1:1).","cursos":[]},
      {"id":"relacoes","nome":"Relações e respeito","descricao":"Ausência de assédio e de conflitos destrutivos.","recomendacao":"Divulgar e fortalecer o canal de denúncias (Lei 14.457/2022), treinar as lideranças na prevenção ao assédio e tratar os casos com confidencialidade e sem retaliação.","cursos":[]},
      {"id":"papel","nome":"Clareza de papel","descricao":"Saber o que é esperado de cada um.","recomendacao":"Revisar descrições de função, alinhar responsabilidades entre líderes e eliminar orientações contraditórias.","cursos":[]},
      {"id":"reconhecimento","nome":"Reconhecimento e justiça","descricao":"Valorização e decisões transparentes.","recomendacao":"Tornar transparentes os critérios de promoção, escalas e benefícios e criar formas frequentes de reconhecimento.","cursos":[]},
      {"id":"equilibrio","nome":"Equilíbrio e mudanças","descricao":"Desconexão, desgaste e gestão de mudanças.","recomendacao":"Combinar regras de desconexão fora do horário, comunicar mudanças com antecedência e oferecer apoio psicológico quando houver sinais de esgotamento.","cursos":[]}
    ]$j$,
    $j$[
      {"id":"dem1","dimensao":"demandas","texto":"Consigo concluir o meu trabalho dentro da jornada normal."},
      {"id":"dem2","dimensao":"demandas","texto":"Com frequência preciso trabalhar em ritmo acelerado ou sob pressão excessiva.","invertida":true},
      {"id":"dem3","dimensao":"demandas","texto":"As metas da minha função são possíveis de alcançar."},
      {"id":"aut1","dimensao":"autonomia","texto":"Tenho voz sobre como organizar as minhas tarefas."},
      {"id":"aut2","dimensao":"autonomia","texto":"Posso fazer pausas quando preciso."},
      {"id":"aut3","dimensao":"autonomia","texto":"Sou consultado quando mudanças afetam o meu trabalho."},
      {"id":"apo1","dimensao":"apoio","texto":"Posso contar com o meu gestor quando enfrento dificuldades."},
      {"id":"apo2","dimensao":"apoio","texto":"Recebo retorno sobre o meu trabalho de forma respeitosa."},
      {"id":"apo3","dimensao":"apoio","texto":"Os colegas se ajudam quando alguém está sobrecarregado."},
      {"id":"rlc1","dimensao":"relacoes","texto":"Já presenciei ou sofri humilhações, gritos ou constrangimentos no trabalho.","invertida":true},
      {"id":"rlc2","dimensao":"relacoes","texto":"Sinto segurança para relatar assédio ou conduta inadequada sem sofrer retaliação."},
      {"id":"rlc3","dimensao":"relacoes","texto":"As pessoas são tratadas com respeito, independentemente de cargo, gênero, idade ou origem."},
      {"id":"pap1","dimensao":"papel","texto":"Sei exatamente o que é esperado de mim."},
      {"id":"pap2","dimensao":"papel","texto":"Recebo orientações contraditórias de pessoas diferentes.","invertida":true},
      {"id":"pap3","dimensao":"papel","texto":"Tenho as informações necessárias para fazer o meu trabalho."},
      {"id":"rec1","dimensao":"reconhecimento","texto":"O meu esforço é reconhecido."},
      {"id":"rec2","dimensao":"reconhecimento","texto":"As decisões sobre promoções, escalas e benefícios são justas e transparentes."},
      {"id":"rec3","dimensao":"reconhecimento","texto":"Sinto que o meu trabalho tem valor para a empresa."},
      {"id":"equ1","dimensao":"equilibrio","texto":"Consigo me desconectar do trabalho fora do horário."},
      {"id":"equ2","dimensao":"equilibrio","texto":"As mudanças na empresa são comunicadas com antecedência e clareza."},
      {"id":"equ3","dimensao":"equilibrio","texto":"Termino o dia de trabalho emocionalmente esgotado.","invertida":true}
    ]$j$,
    true
),
(
    'a0000000-0000-4000-8000-000000000003',
    'Cultura de segurança',
    'Mede em que degrau da escada de maturidade de Hudson a cultura de segurança está, da reação a acidentes até a segurança como parte do jeito de trabalhar.',
    'ABNT NBR ISO 45001:2018 (liderança, participação e consulta dos trabalhadores) · escada de maturidade de Hudson · NR-1 e NR-5 (CIPA)',
    'maturidade', '["Patológico","Reativo","Calculista","Proativo","Generativo"]',
    $j$[
      {"id":"compromisso","nome":"Liderança e compromisso","descricao":"A segurança como prioridade real da liderança.","recomendacao":"Incluir a segurança na pauta das reuniões de liderança, fazer caminhadas de segurança (gemba) com os líderes e garantir os recursos antes de cobrar resultados.","cursos":[]},
      {"id":"participacao","nome":"Participação e consulta","descricao":"Os trabalhadores ajudando a decidir.","recomendacao":"Envolver os trabalhadores na revisão de procedimentos, fortalecer a CIPA e formalizar o direito de recusa diante de risco grave.","cursos":[]},
      {"id":"comunicacao","nome":"Reporte e comunicação","descricao":"Relatar sem medo e receber retorno.","recomendacao":"Simplificar o reporte de quase-acidentes, dar retorno a cada relato e comunicar as regras de forma visual e objetiva.","cursos":[]},
      {"id":"aprendizado","nome":"Aprendizado com incidentes","descricao":"Entender causas em vez de punir.","recomendacao":"Adotar análise de causa raiz sem busca de culpados, compartilhar as lições aprendidas entre áreas e acompanhar as ações até o fim.","cursos":[]},
      {"id":"riscos","nome":"Gestão de riscos no dia a dia","descricao":"Conhecer e controlar os riscos da tarefa.","recomendacao":"Revisar a análise de riscos das tarefas críticas, fazer diálogos diários de segurança e manter o 5S nas áreas de trabalho.","cursos":[]}
    ]$j$,
    $j$[
      {"id":"com1","dimensao":"compromisso","texto":"A liderança dá prioridade à segurança mesmo quando há pressão por produção."},
      {"id":"com2","dimensao":"compromisso","texto":"Os líderes participam das inspeções e das conversas de segurança."},
      {"id":"com3","dimensao":"compromisso","texto":"Os recursos para trabalhar com segurança (EPI, ferramentas, tempo) estão disponíveis."},
      {"id":"par1","dimensao":"participacao","texto":"Os trabalhadores são consultados na definição dos procedimentos de segurança."},
      {"id":"par2","dimensao":"participacao","texto":"Posso interromper uma tarefa que considero insegura sem ser punido."},
      {"id":"par3","dimensao":"participacao","texto":"A CIPA (ou equivalente) é atuante e conhecida por todos."},
      {"id":"cmn1","dimensao":"comunicacao","texto":"Quase-acidentes e condições inseguras são relatados com naturalidade."},
      {"id":"cmn2","dimensao":"comunicacao","texto":"Recebo retorno sobre as ocorrências que relato."},
      {"id":"cmn3","dimensao":"comunicacao","texto":"As regras de segurança são explicadas de forma clara."},
      {"id":"apr1","dimensao":"aprendizado","texto":"Depois de um incidente, o foco é entender as causas, e não punir."},
      {"id":"apr2","dimensao":"aprendizado","texto":"As lições dos incidentes são compartilhadas com outras áreas."},
      {"id":"apr3","dimensao":"aprendizado","texto":"Vejo mudanças concretas depois que um problema de segurança é apontado."},
      {"id":"ris1","dimensao":"riscos","texto":"Conheço os riscos das minhas atividades e como me proteger."},
      {"id":"ris2","dimensao":"riscos","texto":"Às vezes é preciso pular etapas de segurança para cumprir o prazo.","invertida":true},
      {"id":"ris3","dimensao":"riscos","texto":"As áreas de trabalho são mantidas organizadas e seguras."}
    ]$j$,
    true
),
(
    'a0000000-0000-4000-8000-000000000004',
    'Cultura Lean e melhoria contínua',
    'Avalia o quanto os comportamentos do dia a dia sustentam a melhoria contínua, a partir dos princípios orientadores do Modelo Shingo.',
    'Modelo Shingo (princípios orientadores) · Lean / Kaizen · ciclo PDCA e melhoria contínua (ABNT NBR ISO 9001:2015, seção 10)',
    'maturidade', '[]',
    $j$[
      {"id":"respeito","nome":"Respeito pelas pessoas","descricao":"Ouvir, desenvolver e não culpar.","recomendacao":"Criar canais para as ideias da equipe, investir no desenvolvimento e tratar os problemas como falhas do sistema, não das pessoas.","cursos":[]},
      {"id":"humildade","nome":"Liderança com humildade","descricao":"Líderes que vão ao gemba e perguntam.","recomendacao":"Instituir caminhadas no gemba com roteiro de perguntas e capacitar os líderes como facilitadores (coaching kata).","cursos":[]},
      {"id":"perfeicao","nome":"Busca da perfeição","descricao":"Melhorar sempre, eliminando desperdícios.","recomendacao":"Lançar um programa de Kaizen com metas de ideias por equipe e treinar a identificação dos 8 desperdícios.","cursos":[]},
      {"id":"cientifico","nome":"Pensamento científico","descricao":"Testar, medir e aprender.","recomendacao":"Padronizar o PDCA/A3 para resolver problemas, testar em pequena escala e medir o efeito de cada melhoria.","cursos":[]},
      {"id":"processo","nome":"Foco no processo e qualidade na fonte","descricao":"Corrigir na origem e manter padrões vivos.","recomendacao":"Implantar trabalho padrão visual, 5S auditado e o hábito de parar para corrigir a causa na origem (jidoka).","cursos":[]},
      {"id":"valor","nome":"Valor para o cliente","descricao":"Fazer só o que o cliente valoriza.","recomendacao":"Mapear o fluxo de valor dos processos principais e eliminar as etapas que não agregam valor ao cliente.","cursos":[]}
    ]$j$,
    $j$[
      {"id":"rsp1","dimensao":"respeito","texto":"As minhas ideias são ouvidas, mesmo quando contrariam a opinião da chefia."},
      {"id":"rsp2","dimensao":"respeito","texto":"A empresa investe no desenvolvimento das pessoas."},
      {"id":"rsp3","dimensao":"respeito","texto":"Os problemas são tratados sem culpar indivíduos."},
      {"id":"hum1","dimensao":"humildade","texto":"Os líderes vão aonde o trabalho acontece para entender os problemas."},
      {"id":"hum2","dimensao":"humildade","texto":"Os líderes admitem quando não sabem algo e pedem ajuda à equipe."},
      {"id":"hum3","dimensao":"humildade","texto":"A liderança pergunta mais do que dá ordens."},
      {"id":"per1","dimensao":"perfeicao","texto":"Mesmo quando as coisas vão bem, buscamos fazer melhor."},
      {"id":"per2","dimensao":"perfeicao","texto":"Pequenas melhorias são feitas toda semana na minha área."},
      {"id":"per3","dimensao":"perfeicao","texto":"Desperdícios (espera, retrabalho, excesso) são identificados e eliminados."},
      {"id":"cie1","dimensao":"cientifico","texto":"Testamos as ideias em pequena escala antes de adotá-las."},
      {"id":"cie2","dimensao":"cientifico","texto":"Usamos métodos como PDCA ou 5 porquês para resolver problemas."},
      {"id":"cie3","dimensao":"cientifico","texto":"Medimos o resultado das melhorias implantadas."},
      {"id":"prc1","dimensao":"processo","texto":"Quando há um defeito, paramos para corrigir a causa na origem."},
      {"id":"prc2","dimensao":"processo","texto":"Os padrões de trabalho estão visíveis e atualizados."},
      {"id":"prc3","dimensao":"processo","texto":"A organização do posto de trabalho (5S) é mantida no dia a dia."},
      {"id":"val1","dimensao":"valor","texto":"Sabemos o que gera valor para o cliente final."},
      {"id":"val2","dimensao":"valor","texto":"Eliminamos etapas que não agregam valor ao cliente."},
      {"id":"val3","dimensao":"valor","texto":"O cliente é considerado nas decisões de melhoria."}
    ]$j$,
    true
)
on conflict (id) do nothing;

-- ----------------------------------------------------------- permissões --

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
    public.eu(), public.meu_papel(), public.minha_empresa(), public.sou_equipe()
to authenticated;

grant execute on function
    public.listar_empresas_publicas(), public.obter_empresa_publica(text), public.obter_convite(text),
    public.enviar_solicitacao(text, text, text, text), public.validar_certificado(text)
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
    public.enviar_avaliacao(uuid, jsonb), public.ranking_empresa(text, uuid),
    public.definir_area_pessoa(uuid, text), public.matricular_lote(uuid, uuid[], date), public.liberar_curso(uuid, uuid),
    public.salvar_modelo_diagnostico(jsonb), public.criar_diagnostico(jsonb), public.encerrar_diagnostico(uuid),
    public.reabrir_diagnostico(uuid, date), public.excluir_diagnostico(uuid), public.responder_diagnostico(uuid, jsonb, int, text),
    public.resultado_diagnostico(uuid), public.listar_diagnosticos(uuid), public.panorama_maturidade(uuid), public.panorama_empresas(),
    public.listar_kaizens(uuid), public.obter_kaizen(uuid), public.colegas(uuid), public.salvar_kaizen(jsonb),
    public.mover_kaizen(uuid, text), public.comentar_kaizen(uuid, text), public.parecer_kaizen(uuid, text, boolean)
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
