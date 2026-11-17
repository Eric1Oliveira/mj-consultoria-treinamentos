// Ranking: semana, mês ou geral. Quem é da empresa vê só a própria (e a sua posição,
// mesmo fora do top 10); a consultoria escolhe a empresa ou compara todas.

import * as dados from '../dados.js';
import { ehEquipe, pode, PONTOS, PONTOS_MAXIMO, pontuacaoDe, primeiroNome } from '../regras.js';
import { t, tn, formatarNumero } from '../textos.js';
import { html, icone, opcao, avatar, anunciar, mostrarErro, limparErros, desenharEm, perguntar } from '../app.js';

const PERIODOS = ['semana', 'mes', 'total'];

/** Cada ação que dá pontos e o texto dela (na ordem em que aparece). */
const ACOES_PONTOS = {
    aula: 'regraAula', avaliacao: 'regraAvaliacao', notaMaxima: 'regraNota', curso: 'regraCurso',
    desafio: 'regraDesafio', kaizenIdeia: 'regraKaizenIdeia', kaizen: 'regraKaizen', diagnostico: 'regraDiagnostico',
};

/** "Como ganhar pontos": os valores que valem para a empresa (os ajustados por ela ou o padrão). */
function listaPontos(pontos, { ajustada = false, podeAjustar = false, todas = false } = {}) {
    return html`<div class="bloco-cabecalho bloco-cabecalho--linha">
            <h2 id="ranking-regras-titulo" class="bloco-titulo">${t('gamificacao.regras')}</h2>
            ${podeAjustar ? html`<button type="button" class="botao botao--secundario botao--p" data-pontuacao="editar">${t('ranking.ajustar')}</button>` : ''}
        </div>
        ${todas ? html`<p class="bloco-nota">${t('ranking.pontuacaoPadraoTodas')}</p>` : ajustada ? html`<p class="bloco-nota">${t('ranking.pontuacaoAjustada')}</p>` : ''}
        <ul class="lista-marcada">
            ${Object.entries(ACOES_PONTOS).map(([chave, texto]) => html`<li>${t(`gamificacao.${texto}`)}: +${pontos[chave]}</li>`)}
        </ul>`;
}

/** Formulário do gestor: um valor por ação, com o padrão de cada uma como dica. */
function formPontuacao(pontos) {
    return html`<form class="formulario formulario--compacto" data-form="pontuacao" novalidate aria-labelledby="ranking-regras-titulo">
        <h2 id="ranking-regras-titulo" class="bloco-titulo">${t('ranking.ajustarTitulo')}</h2>
        <p class="bloco-nota">${t('ranking.ajustarNota')}</p>
        <div class="pontuacao-campos">
            ${Object.entries(ACOES_PONTOS).map(([chave, texto]) => html`<div class="campo pontuacao-campo">
                <label for="pt-${chave}">${t(`gamificacao.${texto}`)}</label>
                <input id="pt-${chave}" name="${chave}" type="number" min="0" max="${PONTOS_MAXIMO}" step="1" inputmode="numeric" value="${pontos[chave]}" required aria-describedby="pt-${chave}-dica">
                <p id="pt-${chave}-dica" class="campo-dica">${t('ranking.padrao', { n: PONTOS[chave] })}</p>
            </div>`)}
        </div>
        <p class="campo-erro" data-resumo-erro role="alert" hidden></p>
        <div class="acoes acoes--p">
            <button type="submit" class="botao botao--primario botao--p">${t('ranking.salvarPontuacao')}</button>
            <button type="button" class="botao botao--secundario botao--p" data-pontuacao="cancelar">${t('comum.cancelar')}</button>
            <button type="button" class="botao botao--fantasma botao--p" data-pontuacao="padrao">${t('ranking.voltarPadrao')}</button>
        </div>
    </form>`;
}

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

export async function tela({ usuario, empresa, consulta, recarregar }) {
    const equipe = ehEquipe(usuario.perfil);
    const periodo = PERIODOS.includes(consulta.get('periodo')) ? consulta.get('periodo') : 'mes';
    const empresaId = equipe ? consulta.get('empresa') ?? '' : '';
    const [r, empresas, desafio, escolhida] = await Promise.all([
        dados.rankingEmpresa({ periodo, empresaId }),
        equipe ? dados.listarEmpresas(usuario, { situacao: 'ativas' }) : [],
        equipe ? null : dados.perfilGamificacao().then((g) => g.desafio).catch(() => null),
        equipe && empresaId ? dados.obterEmpresa(empresaId).catch(() => null) : empresa,
    ]);
    // Pontuação que vale: a da empresa (a equipe vê a da empresa escolhida; em "todas", o padrão).
    const pontos = pontuacaoDe(escolhida);
    const ajustada = Object.keys(escolhida?.pontuacao ?? {}).length > 0;
    const podeAjustar = Boolean(escolhida) && pode(usuario, 'ajustar-pontuacao', { empresaId: escolhida.id });
    const opcoesLista = { ajustada, podeAjustar, todas: equipe && !empresaId };
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
                    ${equipe ? '' : html`<section class="painel-bloco desafio-mes" aria-labelledby="desafio-mes-titulo">
                        <h2 id="desafio-mes-titulo" class="bloco-titulo">${icone('target', 'icone icone--p')}${t('gamificacao.desafio')}</h2>
                        <p class="bloco-nota">${t('gamificacao.desafioTexto', { pontos: pontos.desafio })}</p>
                        ${desafio ? html`
                            <p class="desafio-mes-curso">${desafio.curso.titulo}</p>
                            ${desafio.cumprido
                                ? html`<p class="selo selo--sucesso">${icone('check', 'icone icone--p')}${t('gamificacao.desafioCumprido')}</p>`
                                : html`<p class="bloco-nota">${t('gamificacao.desafioProgresso', { feito: desafio.feito, meta: desafio.meta })}</p>
                                    <a class="botao botao--primario botao--p" href="#/cursos/${desafio.curso.id}">${t('gamificacao.desafioAbrir')}${icone('arrow', 'icone icone--p')}</a>`}`
                            : html`<p class="nota">${t('gamificacao.desafioSem')}</p>`}
                    </section>`}
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
                    <section class="painel-bloco painel-bloco--sutil" aria-labelledby="ranking-regras-titulo" data-pontos>${listaPontos(pontos, opcoesLista)}</section>
                </div>
            </div>`,
        montar(raiz) {
            const form = raiz.querySelector('[data-form="empresa"]');
            form?.addEventListener('change', () => {
                window.location.hash = `#/ranking?periodo=${periodo}${form.empresa.value ? `&empresa=${form.empresa.value}` : ''}`;
            });
            form?.addEventListener('submit', (evento) => evento.preventDefault());
            if (podeAjustar) ligarPontuacao(raiz.querySelector('[data-pontos]'), { empresaId: escolhida.id, pontos, opcoesLista, recarregar });
        },
    };
}

/** Ajuste da pontuação pelo gestor (ou pela equipe, na empresa escolhida). */
function ligarPontuacao(bloco, { empresaId, pontos, opcoesLista, recarregar }) {
    const salvar = async (valores, mensagem, form = null) => {
        try {
            await dados.salvarPontuacao(empresaId, valores);
            anunciar(mensagem);
            await recarregar();
        } catch (erro) {
            mostrarErro(erro, form);
        }
    };
    bloco.addEventListener('click', async (evento) => {
        const botao = evento.target.closest('[data-pontuacao]');
        if (!botao) return;
        if (botao.dataset.pontuacao === 'editar') {
            desenharEm(bloco, formPontuacao(pontos));
            bloco.querySelector('input')?.focus();
        } else if (botao.dataset.pontuacao === 'cancelar') {
            desenharEm(bloco, listaPontos(pontos, opcoesLista));
            bloco.querySelector('[data-pontuacao="editar"]')?.focus();
        } else if (botao.dataset.pontuacao === 'padrao') {
            const ok = await perguntar({ titulo: t('ranking.voltarPadraoTitulo'), texto: t('ranking.ajustarNota'), confirmar: t('ranking.voltarPadrao') });
            if (ok) await salvar({}, t('ranking.pontuacaoPadraoSalva'));
        }
    });
    bloco.addEventListener('submit', async (evento) => {
        const form = evento.target.closest('[data-form="pontuacao"]');
        if (!form) return;
        evento.preventDefault();
        limparErros(form);
        const valores = Object.fromEntries(Object.keys(ACOES_PONTOS).map((chave) => [chave, form.elements[chave].value]));
        await salvar(valores, t('ranking.pontuacaoSalva'), form);
    });
}
