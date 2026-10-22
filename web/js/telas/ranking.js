// Ranking: semana, mês ou geral. Quem é da empresa vê só a própria (e a sua posição,
// mesmo fora do top 10); a consultoria escolhe a empresa ou compara todas.

import * as dados from '../dados.js';
import { ehEquipe, PONTOS, primeiroNome } from '../regras.js';
import { t, tn, formatarNumero } from '../textos.js';
import { html, icone, opcao, avatar } from '../app.js';

const PERIODOS = ['semana', 'mes', 'total'];

function linhaRanking(r, equipe) {
    return html`<li class="ranking-item ${r.voce ? 'ranking-item--voce' : ''}">
        <span class="ranking-posicao">${t('gamificacao.posicao', { n: r.posicao })}</span>
        ${avatar(r.nome)}
        <span class="linha-principal">${r.nome}${r.voce ? html` <span class="selo selo--marca">${t('comum.voce')}</span>` : ''}
            <span class="linha-sub">${[equipe ? r.empresa : '', r.area, r.cursos ? tn('ranking.cursoUm', 'ranking.cursosN', r.cursos) : '', r.kaizens ? tn('ranking.kaizenUm', 'ranking.kaizensN', r.kaizens) : ''].filter(Boolean).join(' · ')}</span>
        </span>
        <span class="ranking-pontos">${t('gamificacao.pontosDe', { n: formatarNumero(r.pontos) })}</span>
    </li>`;
}

function podio(itens) {
    const tres = itens.filter((r) => r.posicao <= 3).slice(0, 3);
    if (tres.length < 2) return '';
    // A ordem de leitura é 1º, 2º, 3º; o CSS mostra 2º · 1º · 3º (pódio).
    return html`<ol class="podio" role="list" aria-label="${t('ranking.podio')}">
        ${tres.map((r, i) => html`<li class="podio-lugar podio-lugar--${i + 1} ${r.voce ? 'podio-lugar--voce' : ''}">
            <span class="podio-avatar">${avatar(r.nome)}${r.posicao === 1 ? html`<span class="podio-coroa" aria-hidden="true">${icone('trofeu', 'icone icone--p')}</span>` : ''}</span>
            <span class="podio-nome">${primeiroNome(r.nome)}${r.voce ? html` <span class="sr-only">(${t('comum.voce')})</span>` : ''}</span>
            <span class="podio-pontos">${formatarNumero(r.pontos)} <small>${t('gamificacao.pontos').toLowerCase()}</small></span>
            <span class="podio-degrau" aria-hidden="true">${r.posicao}</span>
            <span class="sr-only">${t('gamificacao.posicao', { n: r.posicao })}</span>
        </li>`)}
    </ol>`;
}

export async function tela({ usuario, consulta }) {
    const equipe = ehEquipe(usuario.perfil);
    const periodo = PERIODOS.includes(consulta.get('periodo')) ? consulta.get('periodo') : 'mes';
    const empresaId = equipe ? consulta.get('empresa') ?? '' : '';
    const [r, empresas] = await Promise.all([
        dados.rankingEmpresa({ periodo, empresaId }),
        equipe ? dados.listarEmpresas(usuario, { situacao: 'ativas' }) : [],
    ]);
    const alguemPontuou = r.itens.some((x) => x.pontos > 0);
    const foraDoTop = r.voce && !r.itens.some((x) => x.voce) ? r.voce : null;
    const maiorArea = Math.max(1, ...r.areas.map((a) => a.media));
    const link = (p) => `#/ranking?periodo=${p}${empresaId ? `&empresa=${empresaId}` : ''}`;

    return {
        titulo: t('ranking.titulo'),
        conteudo: html`
            <header class="cabecalho cabecalho--acoes">
                <div>
                    <h1 class="titulo" tabindex="-1">${t('ranking.titulo')}</h1>
                    <p class="subtitulo">${equipe ? t('ranking.subEquipe') : t('ranking.sub')}</p>
                </div>
                ${equipe ? html`<form class="filtros filtros--compacto" data-form="empresa">
                    <div class="campo">
                        <label for="ranking-empresa">${t('comum.empresa')}</label>
                        <select id="ranking-empresa" name="empresa">
                            ${opcao('', t('ranking.todasEmpresas'), !empresaId)}
                            ${empresas.map((e) => opcao(e.id, e.nome, e.id === empresaId))}
                        </select>
                    </div>
                </form>` : ''}
            </header>
            <nav class="segmentos" aria-label="${t('ranking.periodo')}">
                ${PERIODOS.map((p) => html`<a class="segmento" href="${link(p)}" ${p === periodo ? html`aria-current="page"` : ''}>${t(`ranking.periodos.${p}`)}</a>`)}
            </nav>

            <div class="painel-grade">
                <div class="painel-coluna">
                    <section class="painel-bloco" aria-labelledby="ranking-lista-titulo">
                        <div class="bloco-cabecalho bloco-cabecalho--linha">
                            <h2 id="ranking-lista-titulo" class="bloco-titulo">${t(`ranking.titulos.${periodo}`)}</h2>
                            <span class="bloco-nota">${t('ranking.participantes', { n: formatarNumero(r.participantes) })}</span>
                        </div>
                        ${alguemPontuou ? html`
                            ${podio(r.itens)}
                            <ol class="ranking" role="list">${r.itens.map((x) => linhaRanking(x, equipe))}</ol>
                            ${foraDoTop ? html`<p class="ranking-separador" aria-hidden="true">···</p><ol class="ranking" role="list">${linhaRanking(foraDoTop, equipe)}</ol>` : ''}`
                            : html`<p class="vazio">${t('ranking.vazio')}</p>`}
                    </section>
                </div>
                <div class="painel-coluna painel-coluna--lateral">
                    ${r.voce ? html`<section class="painel-bloco ranking-voce" aria-labelledby="ranking-voce-titulo">
                        <h2 id="ranking-voce-titulo" class="bloco-titulo">${t('ranking.suaPosicao')}</h2>
                        <p class="ranking-voce-numero">${r.voce.pontos > 0 ? t('gamificacao.posicao', { n: r.voce.posicao }) : '—'}<span>${t('ranking.deN', { n: formatarNumero(r.participantes) })}</span></p>
                        <p class="bloco-nota">${t('ranking.seusPontos', { n: formatarNumero(r.voce.pontos) })}</p>
                    </section>` : ''}
                    ${r.areas.length ? html`<section class="painel-bloco" aria-labelledby="ranking-areas-titulo">
                        <h2 id="ranking-areas-titulo" class="bloco-titulo">${t('ranking.areasTitulo')}</h2>
                        <p class="bloco-nota">${t('ranking.areasNota')}</p>
                        <ol class="barras-lista" role="list">${r.areas.map((a, i) => html`<li>
                            <span class="barras-rotulo">${i + 1}. ${a.area}<span class="linha-sub">${tn('ranking.pessoaUm', 'ranking.pessoasN', a.pessoas)}</span></span>
                            <span class="nota-barra" role="img" aria-label="${t('ranking.mediaPontos', { n: a.media })}">
                                <span class="nota-barra-trilho"><span class="nota-barra-valor" data-pct-largura="${Math.round((a.media / maiorArea) * 100)}"></span></span>
                                <span class="nota-barra-numero" aria-hidden="true">${formatarNumero(a.media)}</span>
                            </span>
                        </li>`)}</ol>
                    </section>` : ''}
                    <section class="painel-bloco painel-bloco--sutil" aria-labelledby="ranking-regras-titulo">
                        <h2 id="ranking-regras-titulo" class="bloco-titulo">${t('gamificacao.regras')}</h2>
                        <ul class="lista-marcada">
                            <li>${t('gamificacao.regraAula')}: +${PONTOS.aula}</li>
                            <li>${t('gamificacao.regraAvaliacao')}: +${PONTOS.avaliacao}</li>
                            <li>${t('gamificacao.regraNota')}: +${PONTOS.notaMaxima}</li>
                            <li>${t('gamificacao.regraCurso')}: +${PONTOS.curso}</li>
                            <li>${t('gamificacao.regraDesafio')}: +${PONTOS.desafio}</li>
                            <li>${t('gamificacao.regraKaizenIdeia')}: +${PONTOS.kaizenIdeia}</li>
                            <li>${t('gamificacao.regraKaizen')}: +${PONTOS.kaizen}</li>
                            <li>${t('gamificacao.regraDiagnostico')}: +${PONTOS.diagnostico}</li>
                        </ul>
                    </section>
                </div>
            </div>`,
        montar(raiz) {
            const form = raiz.querySelector('[data-form="empresa"]');
            form?.addEventListener('change', () => {
                window.location.hash = `#/ranking?periodo=${periodo}${form.empresa.value ? `&empresa=${form.empresa.value}` : ''}`;
            });
            form?.addEventListener('submit', (evento) => evento.preventDefault());
        },
    };
}
