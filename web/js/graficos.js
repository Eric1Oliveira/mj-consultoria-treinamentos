// Gráficos leves em HTML/SVG, sem biblioteca. Regras (ver o CSS "gráficos"):
// - uma série = uma cor; magnitude = rampa de um tom só; escala concordo↔discordo =
//   divergente (vermelho ↔ cinza ↔ azul, validada para daltonismo nos dois temas);
// - todo valor também aparece em texto (a dica ao passar o mouse só complementa);
// - larguras e posições entram por CSSOM (data-pct-*), nunca por style="" (CSP).

import { html, icone } from './app.js';
import { t, formatarNumero } from './textos.js';
import { nivelMaturidade, faixaRisco } from './regras.js';

const limitar = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

// --------------------------------------------------------- leitura das notas --

/** Nomes dos 5 níveis: os do modelo (ex.: escada de Hudson) ou os genéricos. */
export function nomesNiveis(d) {
    return Array.isArray(d?.niveis) && d.niveis.length === 5 ? d.niveis : t('cultura.niveis');
}

/** Como ler uma nota: nível de maturidade ou faixa de risco psicossocial. */
export function leitura(nota, d) {
    if (nota === null || nota === undefined) return null;
    if (d?.interpretacao === 'risco') {
        const faixa = faixaRisco(nota);
        return { texto: t(`cultura.riscos.${faixa}`), classe: { alto: 'selo--perigo', moderado: 'selo--aviso-p', baixo: 'selo--sucesso' }[faixa], nivel: null };
    }
    const nivel = nivelMaturidade(nota);
    return { texto: nomesNiveis(d)[nivel], classe: 'selo--nivel', nivel };
}

/** Selo do nível com 5 degraus (o degrau aparece sem depender da cor); risco leva ícone + texto. */
export function seloLeitura(nota, d) {
    const l = leitura(nota, d);
    if (!l) return html`<span class="selo selo--neutro">${t('comum.semValor')}</span>`;
    return html`<span class="selo ${l.classe}">${l.nivel !== null
        ? html`<span class="degraus" aria-hidden="true">${[0, 1, 2, 3, 4].map((i) => html`<span class="${i <= l.nivel ? 'degrau--cheio' : ''}"></span>`)}</span>`
        : icone(l.classe === 'selo--sucesso' ? 'check' : 'alert', 'icone icone--p')}${l.texto}</span>`;
}

/** Barra de nota 0–100 (uma série: a cor da marca). */
export function barraNota(nota, rotulo = '') {
    if (nota === null || nota === undefined) return html`<span class="grafico-vazio">${t('comum.semValor')}</span>`;
    return html`<span class="nota-barra" role="img" aria-label="${rotulo ? `${rotulo}: ` : ''}${formatarNumero(nota)}/100" data-dica="${rotulo ? `${rotulo}: ` : ''}${formatarNumero(nota)}/100">
        <span class="nota-barra-trilho"><span class="nota-barra-valor" data-pct-largura="${limitar(nota)}"></span></span>
        <span class="nota-barra-numero" aria-hidden="true">${formatarNumero(nota)}</span>
    </span>`;
}

/** Classe da célula do mapa de calor (rampa ordinal de 5 passos pelo nível de maturidade). */
export function classeCalor(nota) {
    const nivel = nivelMaturidade(nota);
    return nivel === null ? 'calor calor--vazio' : `calor calor--${nivel}`;
}

/** Legenda da rampa do mapa de calor. */
export function legendaCalor(nomes) {
    return html`<div class="legenda legenda--calor" aria-hidden="true">
        ${nomes.map((nome, i) => html`<span class="legenda-item"><span class="calor-amostra calor--${i}"></span>${nome}</span>`)}
    </div>`;
}

/**
 * Favorabilidade de uma pergunta (barra divergente 100%): desfavorável | neutro | favorável.
 * Só o favorável ganha rótulo direto; os três ficam na dica e no texto para leitor de tela.
 */
export function barraFavorabilidade({ favoravel = 0, neutro = 0, desfavoravel = 0 }) {
    const resumo = `${t('cultura.favoravel')} ${favoravel}% · ${t('cultura.neutro')} ${neutro}% · ${t('cultura.desfavoravel')} ${desfavoravel}%`;
    return html`<span class="favorabilidade" role="img" aria-label="${resumo}" data-dica="${resumo}">
        <span class="favorabilidade-trilho">
            ${desfavoravel ? html`<span class="fav-seg fav-seg--desf" data-pct-largura="${desfavoravel}"></span>` : ''}
            ${neutro ? html`<span class="fav-seg fav-seg--neutro" data-pct-largura="${neutro}"></span>` : ''}
            ${favoravel ? html`<span class="fav-seg fav-seg--fav" data-pct-largura="${favoravel}"></span>` : ''}
        </span>
        <span class="favorabilidade-numero" aria-hidden="true">${favoravel}%</span>
    </span>`;
}

export function legendaFavorabilidade() {
    return html`<div class="legenda" aria-hidden="true">
        <span class="legenda-item"><span class="legenda-amostra fav-seg--desf"></span>${t('cultura.desfavoravel')}</span>
        <span class="legenda-item"><span class="legenda-amostra fav-seg--neutro"></span>${t('cultura.neutro')}</span>
        <span class="legenda-item"><span class="legenda-amostra fav-seg--fav"></span>${t('cultura.favoravel')}</span>
    </div>`;
}

/**
 * Halteres (dumbbell): visão da liderança × visão da equipe numa escala 0–100.
 * Liderança = anel vazado, equipe = ponto cheio (a forma diferencia, não só a cor).
 */
export function halteres(lideranca, equipe) {
    if (lideranca === null || lideranca === undefined || equipe === null || equipe === undefined) {
        return html`<span class="grafico-vazio">${t('comum.semValor')}</span>`;
    }
    const a = limitar(Math.min(lideranca, equipe));
    const b = limitar(Math.max(lideranca, equipe));
    const resumo = `${t('cultura.lideranca')} ${lideranca} · ${t('cultura.equipe')} ${equipe}`;
    return html`<span class="halteres" role="img" aria-label="${resumo}" data-dica="${resumo}">
        <span class="halteres-trilho">
            <span class="halteres-ligacao" data-pct-a="${a}" data-pct-b="${b}"></span>
            <span class="halteres-ponto halteres-ponto--lideranca" data-pct-x="${limitar(lideranca)}"></span>
            <span class="halteres-ponto halteres-ponto--equipe" data-pct-x="${limitar(equipe)}"></span>
        </span>
    </span>`;
}

export function legendaHalteres() {
    return html`<div class="legenda" aria-hidden="true">
        <span class="legenda-item"><span class="halteres-ponto halteres-ponto--lideranca halteres-ponto--legenda"></span>${t('cultura.lideranca')}</span>
        <span class="legenda-item"><span class="halteres-ponto halteres-ponto--equipe halteres-ponto--legenda"></span>${t('cultura.equipe')}</span>
    </div>`;
}

/** eNPS: detratores | neutros | promotores (mesma escala divergente da favorabilidade). */
export function barraEnps({ promotores = 0, neutros = 0, detratores = 0 }) {
    const total = promotores + neutros + detratores || 1;
    const pct = (n) => Math.round((n / total) * 100);
    const resumo = `${t('cultura.detratores')} ${pct(detratores)}% · ${t('cultura.neutros')} ${pct(neutros)}% · ${t('cultura.promotores')} ${pct(promotores)}%`;
    return html`<span class="favorabilidade favorabilidade--enps" role="img" aria-label="${resumo}" data-dica="${resumo}">
        <span class="favorabilidade-trilho">
            ${detratores ? html`<span class="fav-seg fav-seg--desf" data-pct-largura="${pct(detratores)}"></span>` : ''}
            ${neutros ? html`<span class="fav-seg fav-seg--neutro" data-pct-largura="${pct(neutros)}"></span>` : ''}
            ${promotores ? html`<span class="fav-seg fav-seg--fav" data-pct-largura="${pct(promotores)}"></span>` : ''}
        </span>
    </span>`;
}

/**
 * Linha de evolução da nota geral (uma série). Pontos ≥ 8px, rótulo só no último
 * valor; os demais aparecem na dica e na lista que acompanha o gráfico.
 */
export function linhaEvolucao(pontos, { largura = 320, altura = 96 } = {}) {
    const validos = pontos.filter((p) => p.valor !== null && p.valor !== undefined);
    if (validos.length < 2) return '';
    const margem = { x: 14, topo: 18, base: 10 };
    const x = (i) => margem.x + (i * (largura - margem.x * 2)) / (validos.length - 1);
    const y = (v) => margem.topo + ((100 - v) * (altura - margem.topo - margem.base)) / 100;
    const caminho = validos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`).join(' ');
    const ultimo = validos[validos.length - 1];
    return html`<svg class="evolucao" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="${t('cultura.evolucao')}: ${validos.map((p) => `${p.rotulo} ${p.valor}`).join(', ')}">
        <line class="evolucao-base" x1="${margem.x}" x2="${largura - margem.x}" y1="${y(0)}" y2="${y(0)}"></line>
        <line class="evolucao-guia" x1="${margem.x}" x2="${largura - margem.x}" y1="${y(50)}" y2="${y(50)}"></line>
        <path class="evolucao-linha" d="${caminho}"></path>
        ${validos.map((p, i) => html`<circle class="evolucao-ponto" cx="${x(i).toFixed(1)}" cy="${y(p.valor).toFixed(1)}" r="4.5" data-dica="${p.rotulo}: ${p.valor}"><title>${p.rotulo}: ${p.valor}</title></circle>`)}
        <text class="evolucao-rotulo" x="${x(validos.length - 1).toFixed(1)}" y="${(y(ultimo.valor) - 9).toFixed(1)}" text-anchor="end">${ultimo.valor}</text>
    </svg>`;
}

/** Variação em relação ao diagnóstico anterior (▲ +6 / ▼ -3), em texto. */
export function variacao(atual, anterior) {
    if (atual === null || atual === undefined || anterior === null || anterior === undefined) return '';
    const diferenca = Math.round(atual - anterior);
    if (diferenca === 0) return html`<span class="variacao variacao--igual">${t('cultura.semVariacao')}</span>`;
    const sobe = diferenca > 0;
    return html`<span class="variacao ${sobe ? 'variacao--sobe' : 'variacao--desce'}"><span aria-hidden="true">${sobe ? '▲' : '▼'}</span>${sobe ? '+' : ''}${diferenca}<span class="sr-only"> ${t('cultura.vsAnterior')}</span></span>`;
}
