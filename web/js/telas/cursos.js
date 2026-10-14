// Cursos: catálogo, página do curso, aula (vídeo/texto), avaliação, editor e certificado.
//
// Rotas: #/cursos · #/cursos/novo · #/cursos/:id · #/cursos/:id/editar
//        #/cursos/:id/aula/:aulaId · #/cursos/:id/avaliacao · #/certificado/:id

import * as dados from '../dados.js';
import { ehEquipe } from '../regras.js';
import { t, formatarData } from '../textos.js';
import { html, icone, opcao, anunciar, irPara, mostrarErro, desenharEm, trilhaSvg } from '../app.js';

const filtro = { busca: '' };

function barra(percentual, rotuloId) {
    return html`<div class="barra" role="progressbar" aria-labelledby="${rotuloId}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentual}">
        <span class="barra-preenchida" data-progresso="${percentual}"></span>
    </div>`;
}

/** Desenho da trilha com o progresso real do curso (até 6 marcos; o último é o certificado). */
export function trilhaDoCurso(p) {
    const marcos = Math.min(6, Math.max(2, p.total + 1));
    const feitos = p.concluido ? marcos - 1 : Math.min(marcos - 2, Math.floor((p.feitas / Math.max(1, p.total)) * (marcos - 1)));
    return trilhaSvg(feitos, marcos);
}

function rotuloAcao(p) {
    if (!p?.matriculado || p.feitas === 0) return t('cursos.comecar');
    return p.concluido ? t('cursos.revisar') : t('cursos.continuar');
}

// --------------------------------------------------------------- catálogo --

function cartao(usuario, c, nomesEmpresas) {
    const equipe = ehEquipe(usuario.perfil);
    const p = c.progresso;
    return html`<li class="curso-cartao">
        <div class="curso-cartao-topo">
            <span class="curso-icone" aria-hidden="true">${icone('book')}</span>
            ${!c.ativo ? html`<span class="selo selo--neutro">${t('cursos.inativo')}</span>` : ''}
            ${p?.concluido ? html`<span class="selo selo--sucesso">${icone('check', 'icone icone--p')}${t('painel.concluido')}</span>` : ''}
        </div>
        <h2 class="curso-titulo">${c.titulo}</h2>
        <p class="curso-descricao">${c.descricao}</p>
        <p class="curso-meta">${t('cursos.resumo', { modulos: c.modulos, aulas: c.aulas, horas: c.cargaHoraria })}</p>
        ${equipe ? html`
            <p class="curso-meta">${t('cursos.turma', { matriculados: c.matriculados, concluidos: c.concluidos })}</p>
            <p class="curso-meta">${t('cursos.liberadoPara')}: ${c.empresas.length ? c.empresas.map((id) => nomesEmpresas[id]).filter(Boolean).join(', ') : t('cursos.nenhumaEmpresa')}</p>` : ''}
        ${p?.matriculado ? html`
            <p class="curso-progresso" id="progresso-${c.id}">${t('cursos.progresso', { p: p.percentual })}</p>
            ${barra(p.percentual, `progresso-${c.id}`)}` : ''}
        <div class="acoes acoes--p curso-acoes">
            <a class="botao ${equipe ? 'botao--secundario' : 'botao--primario'} botao--p" href="#/cursos/${c.id}">${equipe ? t('cursos.ver') : rotuloAcao(p)}<span class="sr-only"> – ${c.titulo}</span></a>
            ${equipe ? html`<a class="botao botao--secundario botao--p" href="#/cursos/${c.id}/editar">${t('comum.editar')}<span class="sr-only"> – ${c.titulo}</span></a>` : ''}
        </div>
    </li>`;
}

function listaCursos(usuario, cursos, nomesEmpresas) {
    if (!cursos.length) return html`<p class="vazio">${t('cursos.nenhum')}</p>`;
    return html`<ul class="cursos-grade" role="list">${cursos.map((c) => cartao(usuario, c, nomesEmpresas))}</ul>`;
}

async function catalogo(usuario) {
    const equipe = ehEquipe(usuario.perfil);
    const cursos = await dados.listarCursos(usuario, filtro);
    const nomesEmpresas = equipe ? Object.fromEntries((await dados.listarEmpresas(usuario)).map((e) => [e.id, e.nome])) : {};

    return {
        titulo: t('cursos.titulo'),
        conteudo: html`
            <header class="cabecalho cabecalho--acoes">
                <div>
                    <h1 class="titulo" tabindex="-1">${t('cursos.titulo')}</h1>
                    <p class="subtitulo">${equipe ? t('cursos.subEquipe') : t('cursos.subAluno')}</p>
                </div>
                ${equipe ? html`<a class="botao botao--primario" href="#/cursos/novo">${icone('plus')}${t('cursos.novo')}</a>` : ''}
            </header>
            <form class="filtros filtros--solto" data-form="filtro" role="search">
                <div class="campo campo--cresce">
                    <label for="cursos-busca">${t('cursos.buscaRotulo')}</label>
                    <input id="cursos-busca" name="busca" type="search" value="${filtro.busca}" autocomplete="off">
                </div>
            </form>
            <div data-lista aria-live="polite">${listaCursos(usuario, cursos, nomesEmpresas)}</div>`,
        montar(raiz) {
            const form = raiz.querySelector('[data-form="filtro"]');
            form.addEventListener('submit', (evento) => evento.preventDefault());
            form.addEventListener('input', async () => {
                filtro.busca = form.busca.value;
                desenharEm(raiz.querySelector('[data-lista]'), listaCursos(usuario, await dados.listarCursos(usuario, filtro), nomesEmpresas));
            });
        },
    };
}

// --------------------------------------------------------- página do curso --

function listaAulas(curso, aulaAtualId = null) {
    let numero = 0;
    return html`<ol class="modulos" role="list">
        ${curso.modulos.map((m) => html`<li class="modulo">
            <h3 class="modulo-titulo">${m.titulo}</h3>
            <ol class="aulas" role="list">
                ${m.aulas.map((a) => {
                    numero += 1;
                    const feita = curso.aulasConcluidas.includes(a.id);
                    return html`<li>
                        <a class="aula-item ${feita ? 'aula-item--feita' : ''}" href="#/cursos/${curso.id}/aula/${a.id}" ${a.id === aulaAtualId ? html`aria-current="page"` : ''}>
                            <span class="aula-marca" aria-hidden="true">${feita ? icone('check', 'icone icone--p') : numero}</span>
                            <span class="aula-nome">${a.titulo}
                                <span class="aula-sub">${a.tipo === 'video' ? t('cursos.tipoVideo') : t('cursos.tipoTexto')} · ${t('comum.minutos', { n: a.minutos })}${podeEstudarCurso(curso) ? ` · ${feita ? t('cursos.aulaConcluida') : t('cursos.aulaPendente')}` : ''}</span>
                            </span>
                        </a>
                    </li>`;
                })}
            </ol>
        </li>`)}
    </ol>`;
}

const podeEstudarCurso = (curso) => Boolean(curso.progresso?.matriculado);

function blocoAvaliacao(curso) {
    const p = curso.progresso;
    const questoes = curso.avaliacao.questoes;
    if (!questoes.length) return html`<p class="bloco-nota">${t('cursos.semAvaliacao')}</p>`;
    const regras = html`<p class="bloco-nota">${t('cursos.avaliacaoRegras', { nota: curso.notaMinima, tentativas: curso.tentativas })}</p>`;
    if (!p?.matriculado) return regras;
    const historico = html`
        ${p.melhorNota !== null ? html`<p class="avaliacao-linha">${t('cursos.melhorNota', { nota: p.melhorNota })}${p.aprovado ? html` <span class="selo selo--sucesso">${t('cursos.aprovado')}</span>` : ''}</p>` : ''}
        ${!p.aprovado ? html`<p class="avaliacao-linha">${t('cursos.tentativasRestantes', { n: p.tentativasRestantes })}</p>` : ''}`;
    let acao = '';
    if (!p.aprovado && p.feitas < p.total) acao = html`<p class="nota">${icone('lock', 'icone icone--p')}${t('cursos.avaliacaoBloqueada')}</p>`;
    else if (!p.aprovado && p.tentativasRestantes === 0) acao = html`<p class="nota nota--aviso">${t('cursos.semTentativas')}</p>`;
    else if (!p.aprovado) acao = html`<a class="botao botao--primario" href="#/cursos/${curso.id}/avaliacao">${t('cursos.fazerAvaliacao')}</a>`;
    return html`${regras}${historico}${acao}`;
}

/** Equipe vê as questões com a resposta certa marcada (só leitura). */
function gabaritoEquipe(curso) {
    const questoes = curso.avaliacao.questoes;
    if (!questoes.length) return html`<p class="bloco-nota">${t('cursos.semAvaliacao')}</p>`;
    return html`<p class="bloco-nota">${t('cursos.avaliacaoRegras', { nota: curso.notaMinima, tentativas: curso.tentativas })}</p>
        <ol class="gabarito">${questoes.map((q) => html`<li>
            <p class="gabarito-enunciado">${q.enunciado}</p>
            <ul class="gabarito-alternativas">${q.alternativas.map((alt, i) => html`<li class="${i === q.correta ? 'gabarito-certa' : ''}">${alt}${i === q.correta ? html` <span class="selo selo--sucesso">${t('editor.correta')}</span>` : ''}</li>`)}</ul>
        </li>`)}</ol>`;
}

async function blocoMatricular(usuario, curso) {
    if (!(ehEquipe(usuario.perfil) || usuario.perfil === 'company_admin') || !curso.ativo) return '';
    const pessoas = await dados.pessoasParaMatricular(usuario, curso.id);
    return html`<section class="painel-bloco" aria-labelledby="matricular-titulo">
        <h2 id="matricular-titulo" class="bloco-titulo">${t('cursos.matricularPessoas')}</h2>
        ${pessoas.length ? html`<form class="formulario formulario--compacto" data-form="matricular">
            <div class="campo">
                <label for="matricular-pessoa">${t('relatorios.pessoa')}</label>
                <select id="matricular-pessoa" name="pessoa">${pessoas.map((p) => opcao(p.id, ehEquipe(usuario.perfil) ? `${p.nome} — ${p.empresaNome}` : p.nome))}</select>
            </div>
            <button type="submit" class="botao botao--secundario">${t('cursos.matricularBotao')}</button>
        </form>` : html`<p class="vazio">${t('cursos.ninguem')}</p>`}
    </section>`;
}

function blocoProgresso(curso) {
    const p = curso.progresso;
    if (!p) return '';
    if (!p.matriculado) {
        return html`<section class="painel-bloco" aria-labelledby="progresso-titulo">
            <h2 id="progresso-titulo" class="bloco-titulo">${t('cursos.naoMatriculado')}</h2>
            <button type="button" class="botao botao--primario botao--largo" data-matricular-me>${t('cursos.matricularMe')}</button>
        </section>`;
    }
    let acao;
    if (p.concluido && p.certificadoId) acao = html`<a class="botao botao--primario botao--largo" href="#/certificado/${p.certificadoId}">${icone('award')}${t('cursos.verCertificado')}</a>`;
    else if (p.proximaAulaId) acao = html`<a class="botao botao--primario botao--largo" href="#/cursos/${curso.id}/aula/${p.proximaAulaId}">${rotuloAcao(p)}</a>`;
    else if (!p.aprovado && p.tentativasRestantes > 0) acao = html`<a class="botao botao--primario botao--largo" href="#/cursos/${curso.id}/avaliacao">${t('cursos.fazerAvaliacao')}</a>`;
    return html`<section class="painel-bloco trilha-bloco" aria-labelledby="progresso-titulo">
        <h2 id="progresso-titulo" class="bloco-titulo">${p.concluido ? t('cursos.concluidoEm', { data: formatarData(p.concluidoEm, { dateStyle: 'medium' }) }) : t('painel.progressoAulas', { feitas: p.feitas, total: p.total })}</h2>
        <div class="trilha-visual">${trilhaDoCurso(p)}</div>
        <p class="trilha-progresso" id="curso-progresso">${t('cursos.progresso', { p: p.percentual })}</p>
        ${barra(p.percentual, 'curso-progresso')}
        ${acao ?? ''}
    </section>`;
}

async function detalhe(usuario, id, recarregar) {
    const curso = await dados.obterCurso(usuario, id);
    const equipe = ehEquipe(usuario.perfil);
    const nomesEmpresas = equipe ? Object.fromEntries((await dados.listarEmpresas(usuario)).map((e) => [e.id, e.nome])) : {};
    const matricular = await blocoMatricular(usuario, curso);

    return {
        titulo: curso.titulo,
        conteudo: html`
            <a class="voltar" href="#/cursos">${icone('back', 'icone icone--p')}${t('cursos.voltar')}</a>
            <header class="cabecalho cabecalho--acoes">
                <div>
                    <h1 class="titulo" tabindex="-1">${curso.titulo}</h1>
                    <p class="subtitulo">${curso.descricao}</p>
                    <p class="curso-meta">${t('cursos.resumo', { modulos: curso.modulos.length, aulas: curso.modulos.reduce((s, m) => s + m.aulas.length, 0), horas: curso.cargaHoraria })}${!curso.ativo ? html` · <span class="selo selo--neutro">${t('cursos.inativo')}</span>` : ''}</p>
                </div>
                ${equipe ? html`<a class="botao botao--secundario" href="#/cursos/${curso.id}/editar">${t('cursos.editar')}</a>` : ''}
            </header>
            ${equipe ? html`<p class="nota">${t('cursos.previaEquipe')} ${t('cursos.liberadoPara')}: ${curso.empresas.length ? curso.empresas.map((e) => nomesEmpresas[e]).filter(Boolean).join(', ') : t('cursos.nenhumaEmpresa')}.</p>` : ''}
            <div class="painel-grade">
                <div class="painel-coluna">
                    <section class="painel-bloco" aria-labelledby="conteudo-titulo">
                        <h2 id="conteudo-titulo" class="bloco-titulo">${t('cursos.conteudo')}</h2>
                        ${listaAulas(curso)}
                    </section>
                    <section class="painel-bloco" aria-labelledby="avaliacao-titulo">
                        <h2 id="avaliacao-titulo" class="bloco-titulo">${t('cursos.avaliacao')}</h2>
                        ${equipe ? gabaritoEquipe(curso) : blocoAvaliacao(curso)}
                    </section>
                </div>
                <div class="painel-coluna painel-coluna--lateral">
                    ${blocoProgresso(curso)}
                    ${matricular}
                </div>
            </div>`,
        montar(raiz) {
            raiz.querySelector('[data-matricular-me]')?.addEventListener('click', async () => {
                try {
                    await dados.matricular(usuario, curso.id);
                    anunciar(t('cursos.matriculado'));
                    await recarregar();
                } catch (erro) {
                    mostrarErro(erro);
                }
            });
            const form = raiz.querySelector('[data-form="matricular"]');
            form?.addEventListener('submit', async (evento) => {
                evento.preventDefault();
                const nome = form.pessoa.selectedOptions[0]?.textContent ?? '';
                try {
                    await dados.matricular(usuario, curso.id, form.pessoa.value);
                    anunciar(t('cursos.matriculaFeita', { nome }));
                    await recarregar();
                } catch (erro) {
                    mostrarErro(erro);
                }
            });
        },
    };
}

// ------------------------------------------------------------------- aula --

async function telaAula(usuario, cursoId, aulaId, recarregar) {
    const curso = await dados.obterCurso(usuario, cursoId);
    const aulas = curso.modulos.flatMap((m) => m.aulas.map((a) => ({ ...a, modulo: m.titulo })));
    const indice = aulas.findIndex((a) => a.id === aulaId);
    if (indice < 0) throw new dados.ErroDados('nao-encontrado');
    const aula = aulas[indice];
    const anterior = aulas[indice - 1];
    const proxima = aulas[indice + 1];
    const p = curso.progresso;
    const feita = curso.aulasConcluidas.includes(aula.id);

    let acao;
    if (!p) acao = html`<p class="nota">${t('cursos.previaEquipe')}</p>`;
    else if (!p.matriculado) {
        acao = html`<div class="nota">${t('aula.precisaMatricula')}
            <button type="button" class="botao botao--primario botao--p" data-matricular-me>${t('cursos.matricularMe')}</button></div>`;
    } else if (feita) acao = html`<p class="nota-sucesso">${icone('check', 'icone icone--p')}${t('aula.concluida')}</p>`;
    else acao = html`<button type="button" class="botao botao--primario" data-concluir>${icone('check')}${t('aula.concluir')}</button>`;

    const irAvaliacao = p?.matriculado && !proxima && curso.avaliacao.questoes.length && !p.aprovado && p.feitas === p.total && p.tentativasRestantes > 0;

    return {
        titulo: aula.titulo,
        conteudo: html`
            <a class="voltar" href="#/cursos/${curso.id}">${icone('back', 'icone icone--p')}${curso.titulo}</a>
            <header class="cabecalho">
                <p class="sobretitulo">${t('aula.posicao', { n: indice + 1, total: aulas.length })} · ${aula.modulo}</p>
                <h1 class="titulo" tabindex="-1">${aula.titulo}</h1>
            </header>
            <div class="aula-grade">
                <article class="aula-corpo">
                    ${aula.tipo === 'video' && aula.videoId ? html`
                        <div class="video">
                            <iframe src="https://www.youtube-nocookie.com/embed/${aula.videoId}?rel=0" title="${t('aula.videoTitulo', { titulo: aula.titulo })}"
                                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" loading="lazy"></iframe>
                        </div>
                        <p class="campo-dica">${t('aula.videoAviso')}</p>` : ''}
                    ${aula.conteudo ? html`<div class="aula-texto">${aula.conteudo.split(/\n{2,}/).map((paragrafo) => html`<p>${paragrafo}</p>`)}</div>` : ''}
                    <div class="aula-acao" data-acao-aula>${acao}</div>
                    <nav class="aula-navegacao" aria-label="${t('cursos.conteudo')}">
                        ${anterior ? html`<a class="botao botao--secundario" href="#/cursos/${curso.id}/aula/${anterior.id}">${icone('back', 'icone icone--p')}${t('aula.anterior')}</a>` : html`<span></span>`}
                        ${proxima ? html`<a class="botao botao--secundario" href="#/cursos/${curso.id}/aula/${proxima.id}">${t('aula.proxima')}${icone('arrow', 'icone icone--p')}</a>` : ''}
                        ${irAvaliacao ? html`<a class="botao botao--primario" href="#/cursos/${curso.id}/avaliacao">${t('aula.irAvaliacao')}</a>` : ''}
                    </nav>
                </article>
                <aside class="painel-bloco aula-indice" aria-labelledby="indice-titulo">
                    <h2 id="indice-titulo" class="bloco-titulo">${t('cursos.conteudo')}</h2>
                    ${p?.matriculado ? html`<p class="trilha-progresso" id="aula-progresso">${t('cursos.progresso', { p: p.percentual })}</p>${barra(p.percentual, 'aula-progresso')}` : ''}
                    ${listaAulas(curso, aula.id)}
                </aside>
            </div>`,
        montar(raiz) {
            raiz.querySelector('[data-matricular-me]')?.addEventListener('click', async () => {
                try {
                    await dados.matricular(usuario, curso.id);
                    anunciar(t('cursos.matriculado'));
                    await recarregar();
                } catch (erro) {
                    mostrarErro(erro);
                }
            });
            raiz.querySelector('[data-concluir]')?.addEventListener('click', async (evento) => {
                evento.currentTarget.disabled = true;
                try {
                    const resultado = await dados.concluirAula(usuario, curso.id, aula.id);
                    const mensagens = [resultado.pontosGanhos ? t('aula.registrada', { pontos: resultado.pontosGanhos }) : t('aula.registradaSemPontos')];
                    if (resultado.concluido) mensagens.push(t('aula.cursoConcluido'));
                    anunciar(mensagens.join(' '));
                    if (curso.avancoAutomatico && proxima) window.location.hash = `#/cursos/${curso.id}/aula/${proxima.id}`;
                    else await recarregar();
                } catch (erro) {
                    evento.currentTarget.disabled = false;
                    mostrarErro(erro);
                }
            });
        },
    };
}

// -------------------------------------------------------------- avaliação --

function telaSimples(titulo, texto, voltarPara) {
    return {
        titulo,
        conteudo: html`<header class="cabecalho">
                <h1 class="titulo" tabindex="-1">${titulo}</h1>
                ${texto ? html`<p class="subtitulo">${texto}</p>` : ''}
            </header>
            <a class="botao botao--secundario" href="${voltarPara}">${t('aula.voltarCurso')}</a>`,
    };
}

function resultadoAvaliacao(curso, r) {
    return html`<section class="painel-bloco resultado ${r.aprovado ? 'resultado--aprovado' : 'resultado--reprovado'}" aria-labelledby="resultado-titulo">
        <h2 id="resultado-titulo" class="bloco-titulo" tabindex="-1">${t('avaliacao.resultado')}</h2>
        <p class="resultado-nota">${t('avaliacao.nota', { nota: r.nota })}</p>
        <p class="resultado-texto">${r.aprovado ? t('avaliacao.aprovado', { min: r.notaMinima }) : t('avaliacao.reprovado', { min: r.notaMinima })}${r.pontosGanhos ? ` ${t('avaliacao.pontos', { pontos: r.pontosGanhos })}` : ''}</p>
        <ol class="correcao" role="list">${r.correcao.map((c, i) => html`<li class="${c.acertou ? 'correcao--certa' : 'correcao--errada'}">
            ${icone(c.acertou ? 'check' : 'close', 'icone icone--p')}${t('avaliacao.questao', { n: i + 1 })}: ${c.acertou ? t('avaliacao.acertou') : t('avaliacao.errou')}
        </li>`)}</ol>
        <p class="bloco-nota">${t('avaliacao.gabaritoOculto')}</p>
        ${!r.aprovado ? html`<p class="bloco-nota">${t('cursos.tentativasRestantes', { n: r.progresso.tentativasRestantes })}</p>` : ''}
        <div class="acoes">
            ${r.progresso.certificadoId ? html`<a class="botao botao--primario" href="#/certificado/${r.progresso.certificadoId}">${icone('award')}${t('cursos.verCertificado')}</a>` : ''}
            ${!r.aprovado && r.progresso.tentativasRestantes > 0 ? html`<button type="button" class="botao botao--primario" data-tentar>${t('avaliacao.tentarDeNovo')}</button>` : ''}
            <a class="botao botao--secundario" href="#/cursos/${curso.id}">${t('aula.voltarCurso')}</a>
        </div>
    </section>`;
}

async function telaAvaliacao(usuario, cursoId, recarregar) {
    const curso = await dados.obterCurso(usuario, cursoId);
    const p = curso.progresso;
    const voltar = `#/cursos/${curso.id}`;
    const titulo = t('avaliacao.titulo', { curso: curso.titulo });
    if (!p?.matriculado || !curso.avaliacao.questoes.length) return telaSimples(t('avaliacao.indisponivel'), p ? t('aula.precisaMatricula') : t('cursos.previaEquipe'), voltar);
    if (p.aprovado) return telaSimples(titulo, t('erros.campos.jaAprovado'), voltar);
    if (p.feitas < p.total) return telaSimples(titulo, t('cursos.avaliacaoBloqueada'), voltar);
    if (p.tentativasRestantes === 0) return telaSimples(titulo, t('cursos.semTentativas'), voltar);

    return {
        titulo,
        conteudo: html`
            <a class="voltar" href="${voltar}">${icone('back', 'icone icone--p')}${curso.titulo}</a>
            <header class="cabecalho">
                <h1 class="titulo" tabindex="-1">${titulo}</h1>
                <p class="subtitulo">${t('avaliacao.instrucoes', { nota: curso.notaMinima, atual: p.tentativasFeitas + 1, max: curso.tentativas })}</p>
            </header>
            <div data-avaliacao>
                <form class="questoes" data-form="avaliacao" novalidate>
                    ${curso.avaliacao.questoes.map((q, i) => html`<fieldset class="questao painel-bloco">
                        <legend class="questao-enunciado"><span class="questao-numero">${t('avaliacao.questao', { n: i + 1 })}</span> ${q.enunciado}</legend>
                        <div class="alternativas">${q.alternativas.map((alt, j) => html`
                            <label class="alternativa"><input type="radio" name="${q.id}" value="${j}" required><span>${alt}</span></label>`)}
                        </div>
                    </fieldset>`)}
                    <p class="campo-erro" data-resumo-erro role="alert" hidden></p>
                    <button type="submit" class="botao botao--primario">${t('avaliacao.enviar')}</button>
                </form>
            </div>`,
        montar(raiz) {
            const alvo = raiz.querySelector('[data-avaliacao]');
            const form = raiz.querySelector('[data-form="avaliacao"]');
            form.addEventListener('submit', async (evento) => {
                evento.preventDefault();
                const respostas = Object.fromEntries(new FormData(form));
                try {
                    const resultado = await dados.enviarAvaliacao(usuario, curso.id, respostas);
                    desenharEm(alvo, resultadoAvaliacao(curso, resultado));
                    anunciar(`${t('avaliacao.nota', { nota: resultado.nota })}. ${resultado.aprovado ? t('avaliacao.aprovado', { min: resultado.notaMinima }) : t('avaliacao.reprovado', { min: resultado.notaMinima })}`, resultado.aprovado ? 'sucesso' : 'erro');
                    alvo.querySelector('#resultado-titulo').focus();
                    alvo.querySelector('[data-tentar]')?.addEventListener('click', () => recarregar());
                } catch (erro) {
                    mostrarErro(erro, form);
                }
            });
        },
    };
}

// ----------------------------------------------------------------- editor --

const novaAula = () => ({ titulo: '', tipo: 'texto', minutos: 10, conteudo: '', video: '' });
const novaQuestao = () => ({ enunciado: '', alternativas: ['', ''], correta: 0 });

function definir(objeto, caminho, valor) {
    const partes = caminho.split('.');
    const ultima = partes.pop();
    partes.reduce((no, parte) => no[parte], objeto)[ultima] = valor;
}

function estrutura(estado) {
    const { modulos, avaliacao } = estado;
    return html`
        <fieldset class="secao-form">
            <legend class="bloco-titulo">${t('editor.modulos')}</legend>
            <ol class="editor-lista" role="list">
                ${modulos.map((m, mi) => html`<li class="editor-modulo">
                    <div class="editor-cabeca">
                        <h3 class="subbloco-titulo">${t('editor.modulo', { n: mi + 1 })}</h3>
                        ${modulos.length > 1 ? html`<button type="button" class="botao botao--fantasma botao--p" data-editor="rm-modulo" data-m="${mi}">${t('editor.removerModulo', { n: mi + 1 })}</button>` : ''}
                    </div>
                    <div class="campo">
                        <label for="ed-m${mi}">${t('editor.tituloModulo')}</label>
                        <input id="ed-m${mi}" data-campo="modulos.${mi}.titulo" value="${m.titulo}" maxlength="120">
                    </div>
                    ${m.aulas.length ? html`<ol class="editor-lista" role="list">${m.aulas.map((a, ai) => html`<li class="editor-aula">
                        <div class="editor-cabeca">
                            <h4 class="editor-aula-titulo">${t('editor.aula', { n: ai + 1 })}</h4>
                            <button type="button" class="botao botao--fantasma botao--p" data-editor="rm-aula" data-m="${mi}" data-a="${ai}">${t('editor.removerAula', { n: ai + 1 })}<span class="sr-only"> – ${t('editor.modulo', { n: mi + 1 })}</span></button>
                        </div>
                        <div class="grade-aula">
                            <div class="campo">
                                <label for="ed-m${mi}-a${ai}">${t('editor.tituloAula')}</label>
                                <input id="ed-m${mi}-a${ai}" data-campo="modulos.${mi}.aulas.${ai}.titulo" value="${a.titulo}" maxlength="150">
                            </div>
                            <div class="campo">
                                <label for="ed-m${mi}-a${ai}-tipo">${t('editor.tipo')}</label>
                                <select id="ed-m${mi}-a${ai}-tipo" data-campo="modulos.${mi}.aulas.${ai}.tipo" data-estrutural>
                                    ${opcao('texto', t('cursos.tipoTexto'), a.tipo === 'texto')}
                                    ${opcao('video', t('cursos.tipoVideo'), a.tipo === 'video')}
                                </select>
                            </div>
                            <div class="campo">
                                <label for="ed-m${mi}-a${ai}-min">${t('editor.minutos')}</label>
                                <input id="ed-m${mi}-a${ai}-min" type="number" min="0" max="600" inputmode="numeric" data-campo="modulos.${mi}.aulas.${ai}.minutos" value="${a.minutos}">
                            </div>
                        </div>
                        ${a.tipo === 'video' ? html`<div class="campo">
                            <label for="ed-m${mi}-a${ai}-video">${t('editor.video')}</label>
                            <input id="ed-m${mi}-a${ai}-video" data-campo="modulos.${mi}.aulas.${ai}.video" value="${a.video}" spellcheck="false" aria-describedby="ed-video-dica-${mi}-${ai}">
                            <p id="ed-video-dica-${mi}-${ai}" class="campo-dica">${t('editor.videoDica')}</p>
                        </div>` : ''}
                        <div class="campo">
                            <label for="ed-m${mi}-a${ai}-texto">${t('editor.conteudo')}</label>
                            <textarea id="ed-m${mi}-a${ai}-texto" rows="3" maxlength="4000" data-campo="modulos.${mi}.aulas.${ai}.conteudo">${a.conteudo}</textarea>
                        </div>
                    </li>`)}</ol>` : html`<p class="vazio">${t('editor.semAulas')}</p>`}
                    <button type="button" class="botao botao--secundario botao--p" data-editor="add-aula" data-m="${mi}">${icone('plus', 'icone icone--p')}${t('editor.addAula')}<span class="sr-only"> – ${t('editor.modulo', { n: mi + 1 })}</span></button>
                </li>`)}
            </ol>
            <button type="button" class="botao botao--secundario" data-editor="add-modulo">${icone('plus', 'icone icone--p')}${t('editor.addModulo')}</button>
        </fieldset>

        <fieldset class="secao-form">
            <legend class="bloco-titulo">${t('editor.avaliacao')}</legend>
            <p class="campo-dica">${t('editor.avaliacaoDica')}</p>
            ${avaliacao.questoes.map((q, qi) => html`<fieldset class="editor-questao">
                <legend class="subbloco-titulo">${t('editor.questao', { n: qi + 1 })}</legend>
                <div class="campo">
                    <label for="ed-q${qi}">${t('editor.enunciado')}</label>
                    <textarea id="ed-q${qi}" rows="2" maxlength="400" data-campo="avaliacao.questoes.${qi}.enunciado">${q.enunciado}</textarea>
                </div>
                <ol class="editor-alternativas" role="list">${q.alternativas.map((alt, ai) => html`<li class="editor-alternativa">
                    <div class="campo campo--cresce">
                        <label for="ed-q${qi}-alt${ai}">${t('editor.alternativa', { n: ai + 1 })}</label>
                        <input id="ed-q${qi}-alt${ai}" data-campo="avaliacao.questoes.${qi}.alternativas.${ai}" value="${alt}" maxlength="200">
                    </div>
                    <label class="campo-check campo-check--alinhado">
                        <input type="radio" name="correta-${qi}" value="${ai}" data-campo="avaliacao.questoes.${qi}.correta" ${q.correta === ai ? html`checked` : ''}>
                        <span>${t('editor.correta')}<span class="sr-only"> – ${t('editor.alternativa', { n: ai + 1 })}</span></span>
                    </label>
                </li>`)}</ol>
                <div class="acoes acoes--p">
                    ${q.alternativas.length < 6 ? html`<button type="button" class="botao botao--secundario botao--p" data-editor="add-alt" data-q="${qi}">${t('editor.addAlternativa')}<span class="sr-only"> – ${t('editor.questao', { n: qi + 1 })}</span></button>` : ''}
                    <button type="button" class="botao botao--fantasma botao--p" data-editor="rm-questao" data-q="${qi}">${t('editor.removerQuestao', { n: qi + 1 })}</button>
                </div>
            </fieldset>`)}
            <button type="button" class="botao botao--secundario" data-editor="add-questao">${icone('plus', 'icone icone--p')}${t('editor.addQuestao')}</button>
        </fieldset>`;
}

async function editor(usuario, id) {
    if (!ehEquipe(usuario.perfil)) throw new dados.ErroDados('proibido');
    const empresas = await dados.listarEmpresas(usuario);
    const existente = id ? await dados.obterCurso(usuario, id) : null;
    const estado = existente ? {
        id: existente.id, titulo: existente.titulo, descricao: existente.descricao, cargaHoraria: existente.cargaHoraria,
        notaMinima: existente.notaMinima, tentativas: existente.tentativas, ativo: existente.ativo, avancoAutomatico: existente.avancoAutomatico,
        empresas: [...existente.empresas],
        modulos: existente.modulos.map((m) => ({ id: m.id, titulo: m.titulo, aulas: m.aulas.map((a) => ({ ...a, video: a.videoId ?? '' })) })),
        avaliacao: { questoes: existente.avaliacao.questoes.map((q) => ({ ...q, alternativas: [...q.alternativas] })) },
    } : {
        titulo: '', descricao: '', cargaHoraria: 1, notaMinima: 70, tentativas: 3, ativo: false, avancoAutomatico: true,
        empresas: [], modulos: [{ titulo: '', aulas: [novaAula()] }], avaliacao: { questoes: [] },
    };
    const titulo = existente ? t('editor.editar') : t('editor.novo');

    return {
        titulo,
        conteudo: html`
            <a class="voltar" href="${existente ? `#/cursos/${existente.id}` : '#/cursos'}">${icone('back', 'icone icone--p')}${existente ? existente.titulo : t('cursos.voltar')}</a>
            <header class="cabecalho">
                <h1 class="titulo" tabindex="-1">${existente ? existente.titulo : t('editor.novo')}</h1>
                ${existente ? html`<p class="subtitulo">${t('editor.editar')}</p>` : ''}
            </header>
            <form class="formulario" data-form="curso" novalidate>
                <fieldset class="secao-form">
                    <legend class="bloco-titulo">${t('editor.dados')}</legend>
                    <div class="campo">
                        <label for="ed-titulo">${t('editor.titulo')}</label>
                        <input id="ed-titulo" name="titulo" data-campo="titulo" value="${estado.titulo}" maxlength="150" required>
                    </div>
                    <div class="campo">
                        <label for="ed-descricao">${t('editor.descricao')}</label>
                        <textarea id="ed-descricao" rows="2" maxlength="600" data-campo="descricao">${estado.descricao}</textarea>
                    </div>
                    <div class="grade-3">
                        <div class="campo"><label for="ed-carga">${t('editor.cargaHoraria')}</label><input id="ed-carga" type="number" min="1" max="400" inputmode="numeric" data-campo="cargaHoraria" value="${estado.cargaHoraria}"></div>
                        <div class="campo"><label for="ed-nota">${t('editor.notaMinima')}</label><input id="ed-nota" type="number" min="0" max="100" inputmode="numeric" data-campo="notaMinima" value="${estado.notaMinima}"></div>
                        <div class="campo"><label for="ed-tentativas">${t('editor.tentativas')}</label><input id="ed-tentativas" type="number" min="1" max="10" inputmode="numeric" data-campo="tentativas" value="${estado.tentativas}"></div>
                    </div>
                    <label class="campo-check"><input type="checkbox" data-campo="ativo" ${estado.ativo ? html`checked` : ''}><span>${t('editor.ativo')}</span></label>
                    <label class="campo-check"><input type="checkbox" data-campo="avancoAutomatico" ${estado.avancoAutomatico ? html`checked` : ''}><span>${t('editor.avancoAutomatico')}</span></label>
                    <fieldset class="grupo-checks">
                        <legend>${t('editor.empresas')}</legend>
                        ${empresas.map((e) => html`<label class="campo-check"><input type="checkbox" data-empresa="${e.id}" ${estado.empresas.includes(e.id) ? html`checked` : ''}><span>${e.nome}${e.ativa ? '' : ` (${t('empresas.inativa')})`}</span></label>`)}
                    </fieldset>
                </fieldset>
                <div data-estrutura>${estrutura(estado)}</div>
                <p class="campo-erro" data-resumo-erro role="alert" hidden></p>
                <div class="acoes">
                    <button type="submit" class="botao botao--primario">${t('editor.salvar')}</button>
                    <a class="botao botao--secundario" href="${existente ? `#/cursos/${existente.id}` : '#/cursos'}">${t('comum.cancelar')}</a>
                </div>
            </form>`,

        montar(raiz) {
            const form = raiz.querySelector('[data-form="curso"]');
            const regiao = raiz.querySelector('[data-estrutura]');
            const redesenhar = (focoId) => {
                desenharEm(regiao, estrutura(estado));
                (focoId && raiz.querySelector(`#${focoId}`))?.focus();
            };

            const guardar = (campo) => {
                if (campo.dataset.empresa) {
                    estado.empresas = [...form.querySelectorAll('[data-empresa]:checked')].map((c) => c.dataset.empresa);
                    return;
                }
                if (!campo.dataset.campo) return;
                let valor = campo.value;
                if (campo.type === 'checkbox') valor = campo.checked;
                if (campo.type === 'radio') valor = Number(campo.value);
                definir(estado, campo.dataset.campo, valor);
                if (campo.dataset.estrutural !== undefined) redesenhar(campo.id);
            };
            form.addEventListener('input', (evento) => guardar(evento.target));
            form.addEventListener('change', (evento) => {
                if (['checkbox', 'radio', 'select-one'].includes(evento.target.type)) guardar(evento.target);
            });

            form.addEventListener('click', (evento) => {
                const botao = evento.target.closest('[data-editor]');
                if (!botao) return;
                const m = Number(botao.dataset.m);
                const a = Number(botao.dataset.a);
                const q = Number(botao.dataset.q);
                switch (botao.dataset.editor) {
                    case 'add-modulo':
                        estado.modulos.push({ titulo: '', aulas: [novaAula()] });
                        return redesenhar(`ed-m${estado.modulos.length - 1}`);
                    case 'rm-modulo':
                        estado.modulos.splice(m, 1);
                        return redesenhar(`ed-m${Math.max(0, m - 1)}`);
                    case 'add-aula':
                        estado.modulos[m].aulas.push(novaAula());
                        return redesenhar(`ed-m${m}-a${estado.modulos[m].aulas.length - 1}`);
                    case 'rm-aula':
                        estado.modulos[m].aulas.splice(a, 1);
                        return redesenhar(`ed-m${m}`);
                    case 'add-questao':
                        estado.avaliacao.questoes.push(novaQuestao());
                        return redesenhar(`ed-q${estado.avaliacao.questoes.length - 1}`);
                    case 'rm-questao':
                        estado.avaliacao.questoes.splice(q, 1);
                        return redesenhar(estado.avaliacao.questoes.length ? `ed-q${Math.max(0, q - 1)}` : null);
                    case 'add-alt':
                        estado.avaliacao.questoes[q].alternativas.push('');
                        return redesenhar(`ed-q${q}-alt${estado.avaliacao.questoes[q].alternativas.length - 1}`);
                    default:
                        return undefined;
                }
            });

            form.addEventListener('submit', async (evento) => {
                evento.preventDefault();
                const botao = form.querySelector('[type="submit"]');
                botao.disabled = true;
                try {
                    const salvo = await dados.salvarCurso(usuario, estado);
                    anunciar(t(existente ? 'editor.salvo' : 'editor.criado', { titulo: salvo.titulo }));
                    window.location.hash = `#/cursos/${salvo.id}`;
                } catch (erro) {
                    mostrarErro(erro, form);
                } finally {
                    botao.disabled = false;
                }
            });
        },
    };
}

// ------------------------------------------------------------------ rotas --

export async function tela({ usuario, parametros, recarregar }) {
    const [id, parte, extra] = parametros;
    if (!id) return catalogo(usuario);
    if (id === 'novo') return editor(usuario, null);
    if (parte === 'editar') return editor(usuario, id);
    if (parte === 'aula') return telaAula(usuario, id, extra, recarregar);
    if (parte === 'avaliacao') return telaAvaliacao(usuario, id, recarregar);
    return detalhe(usuario, id, recarregar);
}

// ------------------------------------------------------------ certificado --

export async function telaCertificado({ usuario, parametros }) {
    const c = await dados.obterCertificado(usuario, parametros[0] ?? '');
    return {
        titulo: `${t('certificado.titulo')} · ${c.curso}`,
        conteudo: html`
            <div class="sem-impressao">
                <a class="voltar" href="#/cursos">${icone('back', 'icone icone--p')}${t('cursos.voltar')}</a>
                <header class="cabecalho cabecalho--acoes">
                    <h1 class="titulo" tabindex="-1">${t('certificado.titulo')}</h1>
                    <button type="button" class="botao botao--primario" data-imprimir>${icone('print')}${t('certificado.imprimir')}</button>
                </header>
            </div>
            <article class="certificado" aria-label="${t('certificado.titulo')}">
                <div class="certificado-moldura">
                    <p class="certificado-marca"><span class="logo-selo" aria-hidden="true">MJ</span> MJ Consultoria</p>
                    <p class="certificado-rotulo">${t('certificado.titulo')}</p>
                    <p class="certificado-texto">${t('certificado.certificamos')}</p>
                    <p class="certificado-nome">${c.nome}</p>
                    <p class="certificado-texto">${t('certificado.concluiu')}</p>
                    <p class="certificado-curso">${c.curso}</p>
                    <p class="certificado-texto">${t('certificado.detalhes', { horas: c.cargaHoraria, data: formatarData(c.emitidoEm) })}</p>
                    ${c.empresa ? html`<p class="certificado-texto">${c.empresa}</p>` : ''}
                    <div class="certificado-rodape">
                        <p class="certificado-assinatura">${t('certificado.assinatura')}</p>
                        <p class="certificado-codigo">${t('certificado.codigo', { codigo: c.codigo })}</p>
                    </div>
                    <p class="certificado-demo">${t('certificado.demo')}</p>
                </div>
            </article>`,
        montar(raiz) {
            raiz.querySelector('[data-imprimir]').addEventListener('click', () => window.print());
        },
    };
}

// O painel reaproveita estes pedaços.
export { barra, rotuloAcao };
