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
4. **Recuperação de senha**: *Authentication → URL Configuration* → pôr o endereço
   do site em *Site URL* e em *Redirect URLs*. Para e-mails em volume, configurar um
   SMTP próprio (*Authentication → Emails → SMTP*); o envio padrão do Supabase é limitado.
5. URL e chave `anon` ficam em `web/js/supabase.js`. A chave `anon` é pública;
   **nunca** coloque a `service_role` no site.

### Atualizar

O `schema.sql` pode ser rodado de novo a qualquer momento: cria o que falta, recria
funções e políticas e não apaga dados (os modelos de diagnóstico padrão só entram se
ainda não existirem, preservando as edições da consultoria). **Rode o SQL antes de
publicar uma versão nova do site**: o site novo usa funções que só existem depois dele.

## Módulos

- **Cursos**: catálogo, aulas (vídeo/texto), avaliação corrigida no servidor, certificado
  com código verificável publicamente em `#/validar`. Atribuição em lote com prazo; prazo
  vencido conta como atraso nos relatórios. Cursos podem ser duplicados e reordenados.
- **Cultura e maturidade** (`#/cultura`): diagnósticos anônimos a partir de modelos
  baseados em normas — maturidade da gestão (ISO 9001/9004), riscos psicossociais
  (NR-1/ISO 45003), cultura de segurança (ISO 45001/escada de Hudson) e cultura Lean
  (Modelo Shingo). A consultoria edita e cria modelos; a empresa pode acrescentar
  perguntas próprias. Resultado com nível por dimensão, visão liderança × equipe
  (pontos cegos), favorabilidade por pergunta, eNPS, áreas, comentários, evolução e
  plano de ação com cursos recomendados. A consultoria tem o panorama da carteira
  (mapa de maturidade) e libera o curso indicado para a empresa num clique.
  O levantamento psicossocial apoia o GRO/PGR, mas não substitui a análise técnica.
- **Kaizen** (`#/kaizen`): melhorias no formato A3/PDCA, com quadro de arrastar,
  5 porquês, ganhos em R$ e horas, histórico, parecer da consultoria e boas práticas.
  Padronizar (concluir) exige o resultado registrado e a aprovação do gestor.
- **Ranking** (`#/ranking`): semana, mês ou geral, pódio, a posição de cada um e a
  média por área. Pontos também por kaizen e por responder diagnósticos.
- **Busca rápida**: `Ctrl/⌘ + K` em qualquer tela.

### Anonimato dos diagnósticos

A participação (quem respondeu) e as respostas ficam em tabelas separadas, sem ligação:
a resposta não guarda usuário nem horário, só o dia. Ninguém lê as respostas pela API;
os resultados saem agregados por `resultado_diagnostico`, que esconde tudo abaixo do
mínimo de respostas definido no lançamento (3 por padrão), aplica o mesmo mínimo às
áreas e evita que um grupo pequeno seja revelado por subtração. A "visão da liderança"
é avisada no questionário dos gestores.

Contas novas entram só por convite: a pessoa abre o link, informa nome e cria a senha.

## Perfis

- **Administrador geral** e **consultora**: equipe da consultoria; cadastram empresas e cursos,
  mantêm os modelos de diagnóstico, acompanham o panorama de maturidade e a saúde de cada
  cliente, dão parecer nos kaizens e liberam cursos conforme o diagnóstico.
- **Gerente da empresa**: atribui cursos (com prazo), lança diagnósticos de cultura, lê o
  resultado da empresa, aprova a padronização dos kaizens e personaliza a marca.
- **Funcionário**: faz os cursos e avaliações, responde os diagnósticos de forma anônima,
  propõe e conduz kaizens e ganha certificados, pontos e posição no ranking.

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
  js/regras.js      permissões, validações, notas, níveis de maturidade e pontos
  js/graficos.js    gráficos em HTML/SVG (barras, mapa de calor, favorabilidade, evolução)
  js/textos.js      textos em pt-BR, en e es
  js/telas/*.js     uma tela por arquivo (marca.js = estúdio de marca;
                    cultura.js e cultura-modelos.js = cultura e maturidade)
```
