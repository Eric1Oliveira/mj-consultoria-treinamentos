# MJ Consultoria — Plataforma de Treinamentos

Plataforma de treinamentos corporativos: a consultoria oferece cursos para
empresas, as empresas capacitam seus funcionários e os alunos acompanham
aulas, avaliações, certificados e desafios.

Feita em HTML, CSS e JavaScript puros, sem build e sem dependências. Tudo fica
na pasta `web/`.

## Estado

Dados no **Supabase** (PostgreSQL + Auth). A estrutura completa do banco está em
`supabase/schema.sql`: tabelas, políticas de acesso (RLS) por perfil e funções do
servidor. O navegador só lê o que o perfil pode ver; toda gravação passa por funções
do banco que conferem a permissão, corrigem as avaliações e registram a auditoria.

### Configurar o Supabase (uma vez)

1. **SQL Editor** → colar `supabase/schema.sql` inteiro → *Run*.
2. **Authentication → Sign In / Providers → Email**: desligar *Confirm email*
   (o convite já é o que libera a conta).
3. **Primeiro administrador**: *Authentication → Users → Add user* (e-mail, senha,
   *Auto Confirm*) e depois rodar o `insert` comentado no fim do `schema.sql`.
4. URL e chave `anon` ficam em `web/js/supabase.js`. A chave `anon` é pública;
   **nunca** coloque a `service_role` no site.

Contas novas entram só por convite: a pessoa abre o link, informa nome e cria a senha.

## Perfis

- **Administrador geral** e **consultora**: equipe da consultoria; cadastram empresas e cursos.
- **Gerente da empresa**: atribui cursos à equipe, acompanha o progresso e personaliza a marca.
- **Funcionário**: faz os cursos, avaliações e ganha certificados e pontos.

## Marca de cada empresa

No **Estúdio de marca** (menu *Personalizar* do gerente, ou *Empresas → Marca* para a
consultoria) a empresa define logotipo, nome da academia, cor principal e secundária,
estilo do menu, cantos, fonte dos títulos e capas dos cursos, com prévia ao vivo.
Qualquer cor é aceita: `regras.paletaMarca` deriva tons legíveis para botões e textos,
e `app.pintarMarca` aplica tudo como variáveis CSS.

## Como abrir

Os módulos JavaScript não funcionam abrindo o `index.html` com dois cliques, então
é preciso servir a pasta:

```
cd web
python -m http.server 8000
```

Depois acesse http://localhost:8000. Outra opção é o Live Server do VS Code.

Para publicar, envie o conteúdo de `web/` para a hospedagem (ex.: pelo cPanel).

## Estrutura

```
supabase/schema.sql  estrutura do banco
web/
  index.html
  css/style.css
  fonts/            fontes locais (Bricolage Grotesque, Instrument Sans)
  img/
  js/app.js         rotas, menu, tema, idioma
  js/dados.js       único ponto de leitura/gravação (Supabase)
  js/supabase.js    cliente mínimo do Supabase (Auth, REST, RPC) com fetch
  js/regras.js      permissões, validações, notas e pontos
  js/textos.js      textos em pt-BR, en e es
  js/telas/*.js     uma tela por arquivo (marca.js = estúdio de marca)
```
