# MJ Consultoria — Plataforma de Treinamentos

Plataforma de treinamentos corporativos: a consultoria oferece cursos para
empresas, as empresas capacitam seus funcionários e os alunos acompanham
aulas, avaliações, certificados e desafios.

Feita em HTML, CSS e JavaScript puros, sem build e sem dependências. Tudo fica
na pasta `web/`.

## Estado

Versão **demonstrativa** completa: dados fictícios salvos só no navegador
(localStorage). As permissões são apenas demonstrativas. O backend (Supabase)
entra numa etapa futura, substituindo apenas `web/js/dados.js`.

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
web/
  index.html
  css/style.css
  fonts/            fontes locais (Bricolage Grotesque, Instrument Sans)
  img/
  js/app.js         rotas, menu, tema, idioma
  js/dados.js       único ponto de leitura/gravação (trocar pelo Supabase aqui)
  js/regras.js      permissões, validações, notas e pontos
  js/textos.js      textos em pt-BR, en e es
  js/telas/*.js     uma tela por arquivo
```
