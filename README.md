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

### Limite do plano

O plano contratado permite até **3 empresas ativas** (usuários ilimitados). O banco
recusa cadastrar ou reativar uma empresa além do limite; empresas inativas não contam.
A tela de Empresas mostra o uso do plano e, no limite, o contato no WhatsApp para
atualizar. Para mudar o limite, no SQL Editor:
`update public.plano set limite_empresas = 5;`

## Módulos

- **Cursos**: catálogo, aulas (vídeo/texto), avaliação corrigida no servidor, certificado
  com código verificável publicamente em `#/validar`. Atribuição em lote com prazo; prazo
  vencido conta como atraso nos relatórios. Cursos podem ser duplicados e reordenados.
- **Cursos**: certificado com o logotipo da empresa contratante (ou o da MJ Alimentos Seguros,
  escolhido no editor do curso). Cursos marcados como **DMQSA** (Diálogo Mensal de Qualidade e
  Segurança de Alimentos) valem o desafio do mês.
- **Cultura de Qualidade e Segurança de Alimentos** (`#/cultura`): um único modelo padrão (5 dimensões
  da GFSI); a consultoria pode criar outros (ex.: clima organizacional) em *Modelos*. A coleta fica
  aberta por no máximo **30 dias**. Depois de encerrada, o resultado fica só com o administrador, que
  escreve o parecer e **libera** para o gestor; só então o gestor vê o relatório completo e o
  **plano de ações** (ação, dimensão, aplicação por função, responsável, prazo e status, com
  concluídas/em andamento/atrasadas). Reabrir a coleta é só da equipe e volta a esconder o resultado.
  Nota de 0 a 100 = (média das respostas − 1) × 25, com as perguntas invertidas viradas; cada faixa
  de 20 pontos é um nível: Inicial, Em desenvolvimento, Estruturado, Gerenciado e Referência.
- **Kaizen** (`#/kaizen`): o colaborador registra a ideia e pede o avanço; só o gestor (ou a
  consultoria) muda a etapa do PDCA, e recebe o aviso no menu a cada ideia nova ou pedido. A ideia
  ganha pontos quando o gestor aprova; a premiação do kaizen padronizado vale uma vez por ano para
  cada pessoa. A "dimensão da cultura" usa as 5 dimensões do diagnóstico.
- **Ranking** (`#/ranking`): semana, mês ou geral, com o **desafio do mês** (ler/assistir o DMQSA mais
  recente = 50 pontos).
- **Divulgação**: `web/divulgacao.html` é a página para novos clientes, e `web/email-divulgacao.html`
  o modelo de e-mail que aponta para ela.
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

- **Administrador geral**: equipe da consultoria (o perfil de consultora não recebe mais convites; as contas antigas continuam funcionando); cadastram empresas e cursos,
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
