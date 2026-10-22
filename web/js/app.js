// Liga tudo: navegação entre telas (#/rota), menu, tema e idioma. As telas ficam em js/telas/ e só falam com os dados por dados.js.

import * as dados from './dados.js';
import { pode, corSegura, iniciais, ehEquipe, paletaMarca, marcaDe } from './regras.js';
import { t, IDIOMAS, IDIOMA_PADRAO, definirIdioma, idiomaAtual, idiomaValido } from './textos.js';

export const MARCA = 'MJ Consultoria';

// -------------------------------------------------------- HTML seguro --
// Todo valor interpolado em html`` é escapado. Só passa sem escapar o que já
// for Seguro (resultado de outro html``). Assim nenhum dado vira código.

class Seguro {
    constructor(texto) {
        this.texto = texto;
    }

    toString() {
        return this.texto;
    }
}

export function esc(valor) {
    return String(valor).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function converter(valor) {
    if (valor === null || valor === undefined || valor === false) return '';
    if (Array.isArray(valor)) return valor.map(converter).join('');
    if (valor instanceof Seguro) return valor.texto;
    return esc(valor);
}

export function html(partes, ...valores) {
    return new Seguro(partes.reduce((acc, parte, i) => acc + parte + (i < valores.length ? converter(valores[i]) : ''), ''));
}

// ------------------------------------------------------------- ícones --

const ICONES = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    building: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M16 9h2a2 2 0 0 1 2 2v10M3 21h18M8 7h4M8 11h4M8 15h4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    team: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    logout: '<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><path d="m14 17 5-5-5-5M19 12H9"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    restore: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    print: '<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2"/><path d="M7 14h10v6H7z"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.5 3.5z"/>',
    tocar: '<path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 7 4.8z" fill="currentColor" stroke="none"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    text: '<path d="M6 4h9l4 4v12H6z"/><path d="M14 4v5h5M9 13h7M9 17h5"/>',
    award: '<circle cx="12" cy="9" r="5.5"/><path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7"/>',
    flame: '<path d="M12 21c4 0 7-2.8 7-6.8 0-4.6-4.3-6.7-5.2-11.2-2 1.7-3.3 4-3.3 6.3-1.2-.6-2-1.8-2.3-3C6 8.5 5 10.8 5 14.2 5 18.2 8 21 12 21z"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".75"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10" cy="7" r="1.1"/><circle cx="15" cy="7" r="1.1"/>',
    send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    trofeu: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>',
    ciclo: '<path d="M20 12a8 8 0 0 1-13.7 5.6M4 12a8 8 0 0 1 13.7-5.6"/><path d="M18 3v3.6h-3.6M6 21v-3.6h3.6"/>',
    bussola: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    busca: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    lampada: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5c0-.9.5-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>',
    conversa: '<path d="M4 5h16v11H9l-5 4z"/>',
    moeda: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2c-.5-.8-1.5-1.2-2.8-1.2-1.7 0-2.8.8-2.8 2 0 2.8 5.6 1.4 5.6 4.1 0 1.2-1.2 2-2.8 2-1.4 0-2.4-.5-2.9-1.4M12 6v2M12 16v2"/>',
    escudo: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
    subir: '<path d="m6 15 6-6 6 6"/>',
    descer: '<path d="m6 9 6 6 6-6"/>',
    lixo: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
};

export function icone(nome, classe = 'icone') {
    return new Seguro(`<svg class="${esc(classe)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONES[nome] ?? ''}</svg>`);
}

// -------------------------------------------------------------- capas --
// Cada curso tem uma capa própria: um mapa de relevo com a trilha do curso.
// O desenho sai do id (o mesmo curso sempre tem a mesma capa) e o trecho
// percorrido da trilha mostra o progresso real de quem está estudando.

const PALETAS_CAPA = 6;

function sorteador(texto) {
    let h = 2166136261;
    for (const c of String(texto)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
    return () => {
        h = (h + 0x6d2b79f5) | 0;
        let x = Math.imul(h ^ (h >>> 15), 1 | h);
        x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

const ponto = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;

/** Curva suave passando pelos pontos (Catmull-Rom convertida em Bézier). */
function curva(pontos, fechada = false) {
    const n = pontos.length;
    const p = (i) => (fechada ? pontos[(i + n) % n] : pontos[Math.max(0, Math.min(n - 1, i))]);
    let d = `M${ponto(p(0))}`;
    for (let i = 0; i < (fechada ? n : n - 1); i += 1) {
        const [a, b, c, e] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
        d += `C${ponto([b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6])} ${ponto([c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6])} ${ponto(c)}`;
    }
    return fechada ? `${d}Z` : d;
}

/**
 * Mapa de relevo com a trilha. `marcos` é o número de paradas (a última é o
 * certificado) e `feitos` quantas já foram percorridas; -1 desenha a trilha sem progresso.
 * `trilha` = [x0, x1, y0, y1]: a faixa (em frações) por onde a trilha passa, para não
 * cruzar o texto que fica por cima.
 */
export function mapaSvg(semente, { largura = 320, altura = 180, marcos = 6, feitos = -1, trilha = [0.11, 0.89, 0.3, 0.72] } = {}) {
    const sortear = sorteador(semente);
    const escala = Math.min(largura, altura) / 180;
    const relevo = [];
    // Dois morros, cada um com anéis concêntricos irregulares (as curvas de nível).
    for (const [x0, x1, y0, y1] of [[0.08, 0.42, 0.12, 0.45], [0.58, 0.95, 0.55, 0.92]]) {
        const cx = largura * (x0 + sortear() * (x1 - x0));
        const cy = altura * (y0 + sortear() * (y1 - y0));
        const ruido = Array.from({ length: 9 }, () => 0.72 + sortear() * 0.56);
        const achatar = 1.25 + sortear() * 0.6;
        for (let anel = 1; anel <= 7; anel += 1) {
            const raio = anel * 15 * escala;
            const pontos = ruido.map((r, i) => {
                const angulo = (i / ruido.length) * Math.PI * 2;
                const desvio = r + (sortear() - 0.5) * 0.08 * anel;
                return [cx + Math.cos(angulo) * raio * desvio * achatar, cy + Math.sin(angulo) * raio * desvio];
            });
            relevo.push(`<path d="${curva(pontos, true)}" class="mapa-nivel${anel === 1 ? ' mapa-nivel--topo' : ''}"/>`);
        }
    }

    const n = Math.max(2, Math.min(7, marcos));
    const [x0, x1, y0, y1] = trilha;
    const paradas = Array.from({ length: n }, (_, i) => [
        largura * (x0 + ((x1 - x0) * i) / (n - 1)),
        altura * (y0 + sortear() * (y1 - y0)),
    ]);
    const atual = feitos < 0 ? -1 : Math.min(feitos, n - 1);
    const tamanho = Math.min(escala, 1.8);
    const r = (valor) => (valor * tamanho).toFixed(1);
    const pontosTrilha = paradas.map(([x, y], i) => {
        if (i === n - 1) {
            return `<g class="mapa-chegada${atual === n - 1 ? ' mapa-chegada--feita' : ''}"><circle cx="${x}" cy="${y}" r="${r(9)}"/><path d="M${x - 3.6 * tamanho} ${y + 0.4 * tamanho}l${2.6 * tamanho} ${2.6 * tamanho} ${5 * tamanho} -${5.4 * tamanho}"/></g>`;
        }
        if (i < atual) return `<circle cx="${x}" cy="${y}" r="${r(3.4)}" class="mapa-feito"/>`;
        if (i === atual) return `<circle cx="${x}" cy="${y}" r="${r(10)}" class="mapa-aqui-halo"/><circle cx="${x}" cy="${y}" r="${r(5)}" class="mapa-aqui"/>`;
        return `<circle cx="${x}" cy="${y}" r="${r(3.2)}" class="mapa-pendente"/>`;
    }).join('');
    const percorrida = atual > 0 ? `<path d="${curva(paradas.slice(0, atual + 1))}" class="mapa-trilha-feita"/>` : '';

    return new Seguro(`<svg class="mapa" viewBox="0 0 ${largura} ${altura}" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true" focusable="false">
        <g class="mapa-relevo">${relevo.join('')}</g>
        <path d="${curva(paradas)}" class="mapa-trilha"/>${percorrida}${pontosTrilha}</svg>`);
}

/** Capa de um curso (decorativa). `p` é o progresso do aluno, quando houver. */
export function capa(curso, p = null, { classe = '', largura, altura, trilha } = {}) {
    const paleta = Math.floor(sorteador(`paleta:${curso.id}`)() * PALETAS_CAPA) + 1;
    const total = p?.total ?? (Array.isArray(curso.modulos) ? curso.modulos.reduce((s, m) => s + m.aulas.length, 0) : curso.aulas) ?? 5;
    const marcos = Math.min(7, Math.max(2, total + 1));
    let feitos = -1;
    if (p?.matriculado) {
        feitos = p.concluido ? marcos - 1 : Math.min(marcos - 2, Math.floor((p.feitas / Math.max(1, p.total)) * (marcos - 1)));
    }
    return html`<span class="capa capa--${paleta} ${classe}" aria-hidden="true">${mapaSvg(curso.id, { largura, altura, marcos, feitos, trilha })}</span>`;
}

// ------------------------------------------------------ pequenos blocos --

export function logo({ inverso = false } = {}) {
    return html`<span class="logo ${inverso ? 'logo--inverso' : ''}">
        <span class="logo-selo" aria-hidden="true">MJ</span>
        <span class="logo-nome"><span class="sr-only">MJ </span>Consultoria</span>
    </span>`;
}

/** Logotipo da empresa num quadrinho claro (funciona sobre qualquer fundo) ou as iniciais. */
export function seloEmpresa(empresa, classe = '') {
    const marca = marcaDe(empresa);
    return marca.logo
        ? html`<span class="selo-empresa selo-empresa--logo ${classe}"><img src="${marca.logo}" alt=""></span>`
        : html`<span class="selo-empresa ${classe}" data-cor="${marca.cor ?? ''}" aria-hidden="true">${iniciais(empresa?.nome ?? '')}</span>`;
}

/** Cabeçalho de marca: a academia da empresa (com o logo dela) ou a marca da consultoria. */
export function marcaTopo(empresa, { inverso = false } = {}) {
    if (!empresa) return logo({ inverso });
    const { academia } = marcaDe(empresa);
    return html`<span class="marca-topo">
        ${seloEmpresa(empresa)}
        <span class="marca-topo-textos">
            <span class="marca-topo-nome">${academia || empresa.nome}</span>
            ${academia ? html`<span class="marca-topo-sub">${empresa.nome}</span>` : ''}
        </span>
    </span>`;
}

export function avatar(nome, cor) {
    return html`<span class="avatar" data-cor="${cor ?? ''}" aria-hidden="true">${iniciais(nome)}</span>`;
}

/** Cartão de indicador (KPI) dentro de <dl class="indicadores">. */
export function indicador(rotulo, valor, destaque = false) {
    return html`<div class="indicador ${destaque ? 'indicador--destaque' : ''}">
        <dt class="indicador-rotulo">${rotulo}</dt>
        <dd class="indicador-valor">${valor}</dd>
    </div>`;
}

export function opcao(valor, rotulo, selecionado = false) {
    return html`<option value="${valor}" ${selecionado ? html`selected` : ''}>${rotulo}</option>`;
}

/** Frase de um registro de auditoria. As ações vêm com ponto ("aula.concluida"); no dicionário a chave usa sublinhado. */
export function fraseAtividade(evento) {
    const chave = `atividade.${String(evento.acao).replace('.', '_')}`;
    const existe = t(chave) !== chave;
    return t(existe ? chave : 'atividade.desconhecida', { autor: evento.autor ?? t('atividade.alguem'), alvo: evento.alvo ?? '' });
}

export function controlesPreferencias() {
    const escuro = temaEfetivo() === 'escuro';
    return html`<div class="preferencias">
        <div class="idiomas" role="group" aria-label="${t('shell.idioma')}">
            ${Object.entries(IDIOMAS).map(([codigo, nome]) => html`
                <button type="button" class="idioma" data-idioma="${codigo}" lang="${codigo}"
                        aria-pressed="${codigo === idiomaAtual() ? 'true' : 'false'}">${codigo.slice(0, 2).toUpperCase()}<span class="sr-only"> – ${nome}</span></button>`)}
        </div>
        <button type="button" class="botao-icone" data-acao="tema" aria-label="${escuro ? t('shell.temaClaro') : t('shell.temaEscuro')}" title="${escuro ? t('shell.temaClaro') : t('shell.temaEscuro')}">
            ${icone(escuro ? 'sun' : 'moon')}
        </button>
    </div>`;
}

// ----------------------------------------------------------------- rotas --

// `funcao`: qual export da tela desenha a rota (padrão: tela). `menu`: item do menu que fica marcado.
const ROTAS = {
    login: { publica: true, carregar: () => import('./telas/login.js') },
    convite: { publica: true, carregar: () => import('./telas/convite.js') },
    e: { publica: true, funcao: 'telaPublica', carregar: () => import('./telas/empresas.js') },
    painel: { icone: 'home', carregar: () => import('./telas/painel.js') },
    empresas: { icone: 'building', acao: 'ver-empresas', carregar: () => import('./telas/empresas.js') },
    pessoas: { icone: 'users', acao: 'ver-pessoas', carregar: () => import('./telas/pessoas.js') },
    equipe: { icone: 'team', acao: 'ver-equipe', carregar: () => import('./telas/equipe.js') },
    solicitacoes: { icone: 'inbox', acao: 'ver-solicitacoes', carregar: () => import('./telas/solicitacoes.js') },
    cursos: { icone: 'book', acao: 'ver-cursos', carregar: () => import('./telas/cursos.js') },
    certificado: { menu: 'cursos', funcao: 'telaCertificado', carregar: () => import('./telas/cursos.js') },
    cultura: { icone: 'bussola', acao: 'ver-cultura', carregar: () => import('./telas/cultura.js') },
    kaizen: { icone: 'ciclo', acao: 'ver-kaizen', carregar: () => import('./telas/kaizen.js') },
    ranking: { icone: 'trofeu', acao: 'ver-ranking', carregar: () => import('./telas/ranking.js') },
    relatorios: { icone: 'chart', acao: 'ver-relatorios', carregar: () => import('./telas/relatorios.js') },
    auditoria: { icone: 'list', acao: 'ver-auditoria', carregar: () => import('./telas/auditoria.js') },
    marca: { icone: 'palette', acao: 'personalizar-marca', soEmpresa: true, carregar: () => import('./telas/marca.js') },
    conta: { icone: 'user', carregar: () => import('./telas/conta.js') },
    validar: { publica: true, carregar: () => import('./telas/validar.js') },
    recuperar: { publica: true, carregar: () => import('./telas/senha.js') },
    'nova-senha': { publica: true, funcao: 'telaNovaSenha', carregar: () => import('./telas/senha.js') },
};

const MENU = ['painel', 'empresas', 'pessoas', 'equipe', 'solicitacoes', 'cursos', 'cultura', 'kaizen', 'ranking', 'relatorios', 'auditoria', 'marca', 'conta'];

/** Atalhos da barra inferior do celular (os primeiros que o perfil pode ver): a equipe gere, quem é da empresa estuda. */
const ATALHOS_CELULAR = {
    equipe: ['painel', 'empresas', 'cultura', 'relatorios'],
    empresa: ['painel', 'cursos', 'kaizen', 'ranking'],
};

/** Itens do menu que mostram um contador (o que espera uma ação). */
const CONTADORES = { solicitacoes: 'solicitacoes', cultura: 'cultura', kaizen: 'kaizen' };

/** "#/kaizen/novo?dimensao=x" → { nome: 'kaizen', parametros: ['novo'], consulta: URLSearchParams } */
function lerRota() {
    const [caminho, busca = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
    const [nome, ...parametros] = caminho.split('/').filter(Boolean).map((p) => {
        try {
            return decodeURIComponent(p);
        } catch {
            return p;
        }
    });
    return { nome: nome || 'painel', parametros, consulta: new URLSearchParams(busca) };
}

export function irPara(nome) {
    const destino = `#/${nome}`;
    if (window.location.hash === destino) renderizar();
    else window.location.hash = destino;
}

// ------------------------------------------------------- tema e idioma --

let preferencias = { idioma: null, tema: null };

function temaEfetivo() {
    if (preferencias.tema) return preferencias.tema;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

function aplicarTema() {
    if (preferencias.tema) document.documentElement.dataset.tema = preferencias.tema;
    else delete document.documentElement.dataset.tema; // segue o sistema pelo CSS
}

const VARIAVEIS_MARCA = ['--brand', '--on-brand', '--marca', '--marca-2', '--marca-tinta', '--marca-tinta-escura'];
const ATRIBUTOS_MARCA = ['menu', 'menuTom', 'cantos', 'fonte', 'capas'];

/**
 * Pinta um elemento (a página inteira ou a prévia do estúdio) com a marca da empresa.
 * Uma cor qualquer vira a paleta completa (regras.paletaMarca); o resto vira atributos
 * que o CSS lê: estilo do menu, cantos, fonte e capas dos cursos. `null` volta ao padrão.
 */
export function pintarMarca(elemento, empresa) {
    const estilo = elemento.style;
    VARIAVEIS_MARCA.forEach((nome) => estilo.removeProperty(nome));
    ATRIBUTOS_MARCA.forEach((nome) => delete elemento.dataset[nome]);
    if (!empresa) return;
    const marca = marcaDe(empresa);
    if (marca.cor) {
        const p = paletaMarca(marca.cor);
        estilo.setProperty('--brand', p.acao);
        estilo.setProperty('--on-brand', p.onAcao);
        estilo.setProperty('--marca', p.base);
        estilo.setProperty('--marca-tinta', p.tinta);
        estilo.setProperty('--marca-tinta-escura', p.tintaEscura);
        elemento.dataset.menuTom = p.onAcao === '#ffffff' ? 'claro' : 'escuro';
    }
    if (marca.corSecundaria) estilo.setProperty('--marca-2', marca.corSecundaria);
    elemento.dataset.menu = marca.estiloMenu;
    elemento.dataset.cantos = marca.cantos;
    elemento.dataset.fonte = marca.fonte;
    elemento.dataset.capas = marca.capasMarca ? 'marca' : 'variadas';
}

let nomeDaMarca = MARCA;

/** Marca da página: a da empresa para quem é dela (e nas páginas públicas dela); a da consultoria para a equipe. */
function aplicarMarca(empresa) {
    pintarMarca(document.documentElement, empresa);
    const marca = empresa ? marcaDe(empresa) : null;
    nomeDaMarca = marca ? marca.academia || empresa.nome : MARCA;
    document.querySelector('link[rel="icon"]')?.setAttribute('href', marca?.logo ?? 'img/icone.svg');
    const tema = document.querySelector('meta[name="theme-color"]');
    if (tema) tema.content = getComputedStyle(document.documentElement).getPropertyValue('--palco').trim() || '#071a20';
}

/** Cores e larguras vindas dos dados entram por CSSOM (permitido pela CSP), nunca por style="". */
export function aplicarEstilosDinamicos(raiz) {
    raiz.querySelectorAll('[data-cor]').forEach((el) => {
        if (el.dataset.cor) el.style.setProperty('--cor', corSegura(el.dataset.cor));
    });
    raiz.querySelectorAll('[data-progresso]').forEach((el) => {
        const valor = Math.max(0, Math.min(100, Number(el.dataset.progresso) || 0));
        el.style.setProperty('--progresso', `${valor}%`);
    });
    // Gráficos: data-pct-largura="40" → --largura: 40% (qualquer data-pct-*, sempre entre 0 e 100).
    raiz.querySelectorAll('[class*="nota-barra"], .fav-seg, .halteres-ligacao, .halteres-ponto, [data-pct]').forEach((el) => {
        for (const [chave, bruto] of Object.entries(el.dataset)) {
            if (!chave.startsWith('pct') || chave === 'pct') continue;
            const nome = chave.slice(3).replace(/^./, (c) => c.toLowerCase()).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
            el.style.setProperty(`--${nome}`, `${Math.max(0, Math.min(100, Number(bruto) || 0))}%`);
        }
    });
}

// --------------------------------------------------------------- avisos --

let temporizadorAviso;

/**
 * Mostra uma notificação e a anuncia ao leitor de tela. A região falada (#aviso)
 * existe sempre na página; a notificação visual (#aviso-visual) só aparece e some.
 */
export function anunciar(mensagem, tipo = 'sucesso') {
    const falado = document.getElementById('aviso');
    const visual = document.getElementById('aviso-visual');
    falado.textContent = '';
    // Esvaziar e preencher no próximo quadro faz o leitor de tela anunciar até mensagens repetidas.
    requestAnimationFrame(() => {
        falado.textContent = mensagem;
    });
    visual.innerHTML = html`${icone(tipo === 'erro' ? 'alert' : 'check', 'icone icone--p')}<span>${mensagem}</span>`.texto;
    visual.dataset.tipo = tipo;
    visual.hidden = false;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => {
        visual.hidden = true;
    }, 4500);
}

/**
 * Celebração de conquista (curso concluído, avaliação aprovada): medalha, pontos e o
 * próximo passo. Os confetes respeitam "reduzir movimento" (o CSS os desliga).
 */
export function celebrar({ titulo, texto = '', pontos = 0, acao = null }) {
    const dialogo = document.createElement('dialog');
    dialogo.className = 'dialogo celebracao';
    dialogo.setAttribute('aria-labelledby', 'celebracao-titulo');
    const cores = ['var(--ouro)', 'var(--brand)', 'var(--marca-2, var(--brand-claro))', '#ffffff'];
    dialogo.innerHTML = html`
        <div class="confetes" aria-hidden="true">${Array.from({ length: 28 }, () => html`<span></span>`)}</div>
        <span class="celebracao-medalha" aria-hidden="true">${icone('award')}</span>
        <h2 id="celebracao-titulo" class="celebracao-titulo">${titulo}</h2>
        ${texto ? html`<p class="celebracao-texto">${texto}</p>` : ''}
        ${pontos ? html`<p class="celebracao-pontos">+${pontos} ${t('gamificacao.pontos').toLowerCase()}</p>` : ''}
        <form method="dialog" class="celebracao-acoes">
            ${acao ? html`<a class="botao botao--primario botao--g" href="${acao.href}" data-fechar>${acao.rotulo}</a>` : ''}
            <button type="submit" class="botao ${acao ? 'botao--fantasma' : 'botao--primario'}">${t('celebracao.continuar')}</button>
        </form>`.texto;
    dialogo.querySelectorAll('.confetes span').forEach((pedaco, i) => {
        const angulo = (i / 28) * Math.PI * 2 + Math.random() * 0.4;
        const distancia = 120 + Math.random() * 120;
        pedaco.style.setProperty('--x', `${Math.cos(angulo) * distancia}px`);
        pedaco.style.setProperty('--y', `${Math.sin(angulo) * distancia - 40}px`);
        pedaco.style.setProperty('--giro', `${Math.round(Math.random() * 720 - 360)}deg`);
        pedaco.style.setProperty('--cor', cores[i % cores.length]);
        pedaco.style.setProperty('--atraso', `${Math.round(Math.random() * 120)}ms`);
    });
    dialogo.addEventListener('close', () => dialogo.remove());
    dialogo.querySelector('[data-fechar]')?.addEventListener('click', () => dialogo.close());
    document.body.append(dialogo);
    dialogo.showModal();
    dialogo.querySelector('.celebracao-acoes .botao')?.focus();
}

// ------------------------------------------------- erros de formulário --

const MENSAGENS_ERRO = { proibido: 'erros.proibido', 'nao-encontrado': 'erros.naoEncontrado', inativo: 'erros.inativo', credenciais: 'login.erro' };

export function limparErros(form) {
    form.querySelectorAll('[data-erro-campo]').forEach((el) => el.remove());
    form.querySelectorAll('[aria-invalid="true"]').forEach((campo) => {
        campo.removeAttribute('aria-invalid');
        if (campo.dataset.descricao) campo.setAttribute('aria-describedby', campo.dataset.descricao);
        else campo.removeAttribute('aria-describedby');
    });
    const resumo = form.querySelector('[data-resumo-erro]');
    if (resumo) {
        resumo.hidden = true;
        resumo.textContent = '';
    }
}

/**
 * Mostra um erro de dados.js: de validação, ao lado de cada campo (name = campo);
 * os demais, numa notificação. Erros inesperados viram a mensagem genérica.
 */
export function mostrarErro(erro, form = null) {
    if (!(erro instanceof dados.ErroDados)) {
        console.error(erro);
        anunciar(t('comum.erroGenerico'), 'erro');
        return;
    }
    if (erro.codigo !== 'validacao') {
        anunciar(t(MENSAGENS_ERRO[erro.codigo] ?? 'comum.erroGenerico'), 'erro');
        return;
    }
    const mensagens = Object.entries(erro.campos).map(([campo, chave]) => [campo, t(`erros.campos.${chave}`, erro.params)]);
    if (!form) {
        anunciar(mensagens.map(([, m]) => m).join(' '), 'erro');
        return;
    }
    limparErros(form);
    const soltas = [];
    let primeiro = null;
    for (const [campo, mensagem] of mensagens) {
        const entrada = form.querySelector(`[name="${campo}"]`);
        if (!entrada) {
            soltas.push(mensagem);
            continue;
        }
        const id = `${entrada.id || campo}-erro`;
        const aviso = document.createElement('p');
        aviso.className = 'campo-erro';
        aviso.id = id;
        aviso.dataset.erroCampo = '';
        aviso.textContent = mensagem;
        (entrada.closest('.campo') ?? entrada.parentElement).append(aviso);
        if (entrada.dataset.descricao === undefined) entrada.dataset.descricao = entrada.getAttribute('aria-describedby') ?? '';
        entrada.setAttribute('aria-describedby', `${entrada.dataset.descricao} ${id}`.trim());
        entrada.setAttribute('aria-invalid', 'true');
        primeiro ??= entrada;
    }
    const texto = soltas.length ? soltas.join(' ') : t('erros.revise');
    const resumo = form.querySelector('[data-resumo-erro]');
    if (resumo) {
        resumo.textContent = texto;
        resumo.hidden = false;
    } else {
        anunciar(texto, 'erro');
    }
    primeiro?.focus();
}

/**
 * Diálogo de confirmação (com um campo de texto opcional).
 * Devolve null se cancelar; true ou o texto digitado se confirmar.
 */
export function perguntar({ titulo, texto = '', confirmar, cancelar = t('comum.cancelar'), perigo = false, campo = null }) {
    return new Promise((resolver) => {
        const dialogo = document.createElement('dialog');
        dialogo.className = 'dialogo';
        dialogo.setAttribute('aria-labelledby', 'pergunta-titulo');
        if (texto) dialogo.setAttribute('aria-describedby', 'pergunta-texto');
        const atributos = campo?.obrigatorio ? html`required` : '';
        dialogo.innerHTML = html`
            <form method="dialog">
                <h2 id="pergunta-titulo" class="dialogo-titulo">${titulo}</h2>
                ${texto ? html`<p id="pergunta-texto" class="dialogo-texto">${texto}</p>` : ''}
                ${campo ? html`<div class="campo dialogo-campo">
                    <label for="pergunta-campo">${campo.rotulo}</label>
                    ${campo.multilinha
                        ? html`<textarea id="pergunta-campo" rows="3" maxlength="${campo.maximo ?? 300}" ${atributos}>${campo.valor ?? ''}</textarea>`
                        : html`<input id="pergunta-campo" value="${campo.valor ?? ''}" maxlength="${campo.maximo ?? 120}" autocomplete="off" ${atributos}>`}
                </div>` : ''}
                <div class="dialogo-acoes">
                    <button type="submit" value="cancelar" class="botao botao--secundario" formnovalidate>${cancelar}</button>
                    <button type="submit" value="confirmar" class="botao ${perigo ? 'botao--perigo' : 'botao--primario'}">${confirmar}</button>
                </div>
            </form>`.texto;
        document.body.append(dialogo);
        const entrada = dialogo.querySelector('#pergunta-campo');
        dialogo.addEventListener('close', () => {
            const confirmado = dialogo.returnValue === 'confirmar';
            const valor = entrada ? entrada.value.trim() : true;
            dialogo.remove();
            resolver(confirmado && (valor !== '' || campo?.permitirVazio) ? valor : null);
        });
        dialogo.showModal();
        if (entrada) entrada.focus();
        else dialogo.querySelector('[value="cancelar"]').focus();
    });
}

// ----------------------------------------------------------- utilidades --

/** Endereço completo de uma rota (para copiar links de convite e da empresa). */
export function enderecoDe(rota) {
    return `${window.location.href.split('#')[0]}#/${rota}`;
}

export async function copiarTexto(texto) {
    try {
        await navigator.clipboard.writeText(texto);
        anunciar(t('comum.linkCopiado'));
        return true;
    } catch {
        anunciar(t('comum.copiaFalhou'), 'erro');
        return false;
    }
}

/** Gera e baixa um CSV (separador ;, com BOM para o Excel abrir acentos certo). */
export function baixarCsv(nomeArquivo, linhas) {
    const celula = (valor) => {
        const texto = String(valor ?? '');
        const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto; // evita fórmula na planilha
        return `"${seguro.replace(/"/g, '""')}"`;
    };
    const conteudo = `﻿${linhas.map((linha) => linha.map(celula).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Redesenha só um pedaço da tela (listas filtradas), mantendo o resto. */
export function desenharEm(alvo, conteudo) {
    alvo.innerHTML = conteudo.texto;
    aplicarEstilosDinamicos(alvo);
}

export function preferenciaTema() {
    return preferencias.tema;
}

/** Usado pela tela "Minha conta" (os botões do rodapé fazem o mesmo). */
export async function mudarPreferencias({ idioma, tema }) {
    if (idioma !== undefined) {
        preferencias.idioma = definirIdioma(idioma);
        atualizarTextosFixos();
    }
    if (tema !== undefined) {
        preferencias.tema = tema || null;
        aplicarTema();
    }
    await dados.salvarPreferencias({ idioma: preferencias.idioma, tema: preferencias.tema });
}

// -------------------------------------------------------------- layouts --

let assinaturaLayout = null;

/** Painel de marca da área pública: o da empresa (página dela, convite) ou o da consultoria. */
function painelPublico(empresa) {
    const marca = empresa ? marcaDe(empresa) : null;
    return html`
        <span class="publico-mapa">${mapaSvg(empresa?.id ?? 'mj-consultoria', { largura: 560, altura: 900, marcos: 6, feitos: 3, trilha: [0.12, 0.86, 0.2, 0.4] })}</span>
        ${marcaTopo(empresa, { inverso: true })}
        <div class="publico-marca-meio">
            <p class="publico-tagline">${marca ? marca.academia || empresa.nome : t('login.tagline')}</p>
            <p class="publico-apoio">${marca ? empresa.mensagem || t('login.apoio') : t('login.apoio')}</p>
        </div>
        <p class="publico-rodape">${marca ? t('shell.comConsultoria', { marca: MARCA }) : `© ${new Date().getFullYear()} ${MARCA}`}</p>`;
}

function montarPublico(empresa) {
    const app = document.getElementById('app');
    const assinatura = `publico|${idiomaAtual()}|${temaEfetivo()}|${empresa?.id ?? ''}|${empresa ? JSON.stringify(marcaDe(empresa)) + (empresa.mensagem ?? '') : ''}`;
    if (assinaturaLayout === assinatura) return app.querySelector('#conteudo');
    assinaturaLayout = assinatura;
    app.innerHTML = html`
        <div class="publico">
            <aside class="publico-marca" aria-label="${empresa ? empresa.nome : MARCA}">${painelPublico(empresa)}</aside>
            <div class="publico-corpo">
                <header class="publico-topo">
                    <span class="publico-logo-celular">${marcaTopo(empresa)}</span>
                    ${controlesPreferencias()}
                </header>
                <main id="conteudo" class="publico-conteudo" tabindex="-1"></main>
            </div>
        </div>`.texto;
    aplicarEstilosDinamicos(app);
    return app.querySelector('#conteudo');
}

function itensDoMenu(usuario) {
    return MENU.filter((nome) => (!ROTAS[nome].acao || pode(usuario, ROTAS[nome].acao)) && (!ROTAS[nome].soEmpresa || usuario.empresaId));
}

function montarShell(usuario, empresa, rotaAtual) {
    const app = document.getElementById('app');
    const marca = empresa && !ehEquipe(usuario.perfil) ? empresa : null;
    const assinatura = `shell|${usuario.id}|${idiomaAtual()}|${temaEfetivo()}|${marca ? JSON.stringify(marcaDe(marca)) + marca.nome : ''}`;
    if (assinaturaLayout !== assinatura) {
        assinaturaLayout = assinatura;
        const itens = itensDoMenu(usuario);
        const atalhos = ATALHOS_CELULAR[ehEquipe(usuario.perfil) ? 'equipe' : 'empresa'].filter((nome) => itens.includes(nome)).slice(0, 4);
        const contador = (nome) => (CONTADORES[nome] ? html`<span class="nav-contador" data-contador="${CONTADORES[nome]}" hidden></span>` : '');
        const navegacao = html`
            <button type="button" class="nav-busca" data-acao="paleta" aria-keyshortcuts="Control+K Meta+K">
                ${icone('busca', 'icone icone--p')}<span>${t('paleta.abrir')}</span><kbd>${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'} K</kbd>
            </button>
            <ul class="nav-lista" role="list">
                ${itens.map((nome) => html`
                    <li><a class="nav-item" href="#/${nome}" data-rota="${nome}">
                        ${icone(ROTAS[nome].icone)}<span class="nav-rotulo">${t(`nav.${nome}`)}</span>${contador(nome)}
                    </a></li>`)}
            </ul>`;
        const rodape = html`
            <div class="lateral-rodape">
                <div class="usuario">
                    ${avatar(usuario.nome, empresa?.cor)}
                    <div class="usuario-texto">
                        <p class="usuario-nome">${usuario.nome}</p>
                        <p class="usuario-papel">${t(`perfis.${usuario.perfil}`)}${empresa ? ` · ${empresa.nome}` : ''}</p>
                    </div>
                </div>
                ${controlesPreferencias()}
                <button type="button" class="nav-item nav-item--sair" data-acao="sair">${icone('logout')}<span class="nav-rotulo">${t('shell.sair')}</span></button>
                ${marca ? html`<p class="lateral-credito">${t('shell.comConsultoria', { marca: MARCA })}</p>` : ''}
            </div>`;

        app.innerHTML = html`
            <div class="shell">
                <header class="topo">
                    ${marcaTopo(marca)}
                    <span class="topo-acoes">
                        <button type="button" class="botao-icone" data-acao="paleta" aria-label="${t('paleta.abrir')}">${icone('busca')}</button>
                        <a class="topo-conta" href="#/conta" aria-label="${t('nav.conta')}">${avatar(usuario.nome, marca?.cor)}</a>
                    </span>
                </header>
                <div class="lateral-fundo" data-acao="fechar-menu" hidden></div>
                <aside class="lateral" id="menu-lateral" aria-label="${t('shell.menu')}">
                    <div class="lateral-logo">${marcaTopo(marca, { inverso: true })}</div>
                    <nav class="lateral-nav" aria-label="${t('shell.navPrincipal')}">${navegacao}</nav>
                    ${rodape}
                </aside>
                <main id="conteudo" class="principal" tabindex="-1"></main>
                <nav class="barra-inferior" aria-label="${t('shell.atalhos')}">
                    ${atalhos.map((nome) => html`<a class="barra-item" href="#/${nome}" data-rota="${nome}">${icone(ROTAS[nome].icone)}<span>${t(`nav.${nome}`)}</span>${contador(nome)}</a>`)}
                    <button type="button" class="barra-item" data-acao="menu" aria-controls="menu-lateral" aria-expanded="false">${icone('grid')}<span>${t('shell.mais')}</span></button>
                </nav>
            </div>`.texto;
        aplicarEstilosDinamicos(app);
    }

    app.querySelectorAll('[data-rota]').forEach((link) => {
        if (link.dataset.rota === rotaAtual) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
    fecharMenu();
    atualizarContadores();
    aquecerMenu(1200);
    return app.querySelector('#conteudo');
}

// ------------------------------------------------------- pré-carregamento --
// Cada ida ao Supabase leva de 0,2 a 0,8 s. Para o menu responder na hora, as telas
// são preparadas antes do clique: em segundo plano depois que a primeira tela abre (e de
// novo depois de cada ação), e ao passar o mouse ou o dedo num item do menu. Preparar =
// baixar o módulo e rodar a função da tela, que enche o cache de dados (dados.js).

const preparadas = new Map(); // rota → quando foi preparada
const PREPARO_VALE_MS = 120_000;

async function prepararTela(nome) {
    const rota = ROTAS[nome];
    if (!rota || rota.publica || nome === lerRota().nome) return;
    const ultima = preparadas.get(nome);
    if (ultima && Date.now() - ultima < PREPARO_VALE_MS) return;
    preparadas.set(nome, Date.now());
    try {
        const usuario = await dados.usuarioAtual();
        if (!usuario || (rota.acao && !pode(usuario, rota.acao)) || (rota.soEmpresa && !usuario.empresaId)) return;
        const empresa = usuario.empresaId ? await dados.obterEmpresa(usuario.empresaId) : null;
        const modulo = await rota.carregar();
        await modulo[rota.funcao ?? 'tela']({ usuario, empresa, parametros: [], consulta: new URLSearchParams(), recarregar: () => {} });
    } catch {
        preparadas.delete(nome); // preparar é opcional: o clique carrega normalmente
    }
}

let aquecimento = null;

/** Prepara as telas do menu em segundo plano, duas por vez, sem disputar com a tela atual. */
function aquecerMenu(espera = 600) {
    clearTimeout(aquecimento);
    aquecimento = setTimeout(async () => {
        const usuario = await dados.usuarioAtual();
        if (!usuario) return;
        const fila = itensDoMenu(usuario);
        const trabalhar = async () => {
            while (fila.length) await prepararTela(fila.shift());
        };
        await Promise.all([trabalhar(), trabalhar()]);
    }, espera);
}

// Passar o mouse, focar ou tocar num item do menu já começa a preparar a tela.
['pointerover', 'focusin', 'touchstart'].forEach((tipo) => {
    document.addEventListener(tipo, (evento) => {
        const link = evento.target.closest?.('a[data-rota]');
        if (link) prepararTela(link.dataset.rota);
    }, { passive: true });
});

/** Contadores do menu (pedidos a decidir, pesquisa a responder, kaizen a verificar). Não atrasam a tela. */
async function atualizarContadores() {
    let valores;
    try {
        valores = await dados.contadoresMenu();
    } catch {
        return;
    }
    document.querySelectorAll('[data-contador]').forEach((el) => {
        const n = valores[el.dataset.contador] ?? 0;
        el.hidden = !n;
        el.innerHTML = html`<span aria-hidden="true">${n > 99 ? '99+' : n}</span><span class="sr-only">, ${t('shell.pendentes', { n })}</span>`.texto;
    });
}

function abrirMenu(aberto) {
    const botao = document.querySelector('[data-acao="menu"]');
    if (!botao) return;
    botao.setAttribute('aria-expanded', String(aberto));
    document.getElementById('menu-lateral')?.toggleAttribute('data-aberto', aberto);
    const fundo = document.querySelector('.lateral-fundo');
    if (fundo) fundo.hidden = !aberto;
    document.documentElement.classList.toggle('menu-aberto', aberto);
    if (aberto) document.querySelector('#menu-lateral .nav-item')?.focus();
}

function fecharMenu() {
    abrirMenu(false);
}

// ------------------------------------------------------------ renderizar --

let geracao = 0;
let primeiraTela = true;

async function renderizar() {
    const minha = ++geracao;
    const { nome, parametros, consulta } = lerRota();
    const rota = ROTAS[nome];
    const usuario = await dados.usuarioAtual();

    if (rota && !rota.publica && !usuario) return irPara('login');
    if (nome === 'login' && usuario) return irPara('painel');

    // O código da tela baixa enquanto a empresa chega (em paralelo, não em fila).
    const moduloPronto = rota?.carregar();
    moduloPronto?.catch(() => {}); // o erro é tratado mais abaixo, onde é aguardado
    const empresa = usuario?.empresaId ? await dados.obterEmpresa(usuario.empresaId) : null;
    if (minha !== geracao) return;

    const publica = !usuario || rota?.publica;
    // Quem é da empresa vê a marca dela; a equipe vê a da consultoria. Página pública: decide depois.
    if (!publica) aplicarMarca(usuario && !ehEquipe(usuario.perfil) ? empresa : null);
    let principal = publica ? null : montarShell(usuario, empresa, rota?.menu ?? nome);

    let resultado;
    if (publica) principal = document.querySelector('.publico #conteudo') ?? montarPublico(null);
    try {
        if (!rota) {
            resultado = telaMensagem(t('erros.naoEncontradaTitulo'), t('erros.naoEncontradaTexto'));
        } else if (rota.acao && !pode(usuario, rota.acao)) {
            resultado = telaMensagem(t('erros.semPermissaoTitulo'), t('erros.semPermissaoTexto'));
        } else {
            principal.setAttribute('aria-busy', 'true');
            const modulo = await moduloPronto;
            resultado = await modulo[rota.funcao ?? 'tela']({ usuario, empresa, parametros, consulta, recarregar: renderizar });
        }
    } catch (erro) {
        if (erro instanceof dados.ErroDados) {
            // Item que não existe ou que este perfil não pode ver: a mesma resposta, sem detalhes.
            resultado = telaMensagem(t('erros.naoEncontradaTitulo'), t('erros.naoEncontrado'));
        } else {
            console.error(erro);
            resultado = telaMensagem(t('comum.erroGenerico'), '', true);
        }
    }
    if (minha !== geracao) return;

    // Página pública de empresa (ou convite dela): a marca dela vale enquanto a página estiver aberta.
    if (publica) {
        aplicarMarca(resultado.empresa ?? null);
        principal = montarPublico(resultado.empresa ?? null);
    }
    principal.removeAttribute('aria-busy');
    // Cada tela ganha um contêiner novo: os eventos que ela liga somem junto quando ela sai.
    const tela = document.createElement('div');
    tela.className = 'tela';
    tela.innerHTML = resultado.conteudo.texto;
    principal.replaceChildren(tela);
    principal.classList.remove('entrando');
    void principal.offsetWidth; // reinicia a animação de entrada
    principal.classList.add('entrando');
    aplicarEstilosDinamicos(principal);
    resultado.montar?.(tela, { usuario, empresa, parametros, consulta, recarregar: renderizar });
    document.title = `${resultado.titulo} · ${nomeDaMarca}`;
    // Sinal de "tela pronta" (qual tela e quantas vezes já desenhou): usado pelos testes automáticos.
    principal.dataset.tela = rota ? nome : 'nao-encontrada';
    document.documentElement.dataset.desenhos = String(Number(document.documentElement.dataset.desenhos || 0) + 1);

    // Na primeira carga o foco fica no começo da página; depois, vai para o título da tela nova.
    if (!primeiraTela) principal.querySelector('h1')?.focus({ preventScroll: false });
    primeiraTela = false;
    window.scrollTo({ top: 0 });
}

function telaMensagem(titulo, texto, comTentarDeNovo = false) {
    return {
        titulo,
        conteudo: html`
            <header class="cabecalho">
                <h1 class="titulo" tabindex="-1">${titulo}</h1>
                ${texto ? html`<p class="subtitulo">${texto}</p>` : ''}
            </header>
            <div class="acoes">
                ${comTentarDeNovo ? html`<button type="button" class="botao botao--primario" data-acao="recarregar">${t('comum.tentarDeNovo')}</button>` : ''}
                <a class="botao botao--secundario" href="#/painel">${t('comum.voltarInicio')}</a>
            </div>`,
    };
}

// ------------------------------------------------------------------ dicas --
// Uma dica flutuante para qualquer elemento com data-dica (gráficos, ícones).
// Aparece ao passar o mouse ou ao focar; o valor sempre existe também em texto.

let dica = null;

function mostrarDica(alvo) {
    if (!alvo.dataset.dica) return;
    dica ??= Object.assign(document.createElement('div'), { className: 'dica', role: 'tooltip' });
    if (!dica.isConnected) document.body.append(dica);
    dica.textContent = alvo.dataset.dica;
    dica.hidden = false;
    const caixa = alvo.getBoundingClientRect();
    const largura = dica.offsetWidth;
    const esquerda = Math.max(8, Math.min(window.innerWidth - largura - 8, caixa.left + caixa.width / 2 - largura / 2));
    const acima = caixa.top - dica.offsetHeight - 8;
    dica.style.left = `${esquerda}px`;
    dica.style.top = `${acima > 8 ? acima : caixa.bottom + 8}px`;
}

function esconderDica() {
    if (dica) dica.hidden = true;
}

document.addEventListener('pointerover', (evento) => {
    const alvo = evento.target.closest?.('[data-dica]');
    if (alvo) mostrarDica(alvo);
    else esconderDica();
});
document.addEventListener('focusin', (evento) => {
    const alvo = evento.target.closest?.('[data-dica]');
    if (alvo) mostrarDica(alvo);
    else esconderDica();
});
window.addEventListener('scroll', esconderDica, { passive: true });

// --------------------------------------------------------- busca rápida --
// Ctrl/⌘ + K: ir direto para qualquer tela, curso, empresa ou kaizen.

const semAcento = (texto) => String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function itensDaPaleta(usuario) {
    const telas = itensDoMenu(usuario).map((nome) => ({ rotulo: t(`nav.${nome}`), grupo: t('paleta.telas'), href: `#/${nome}`, icone: ROTAS[nome].icone }));
    const acoes = [
        pode(usuario, 'gerir-cursos') && { rotulo: t('cursos.novo'), href: '#/cursos/novo', icone: 'plus' },
        pode(usuario, 'gerir-empresas') && { rotulo: t('empresas.nova'), href: '#/empresas/nova', icone: 'plus' },
        pode(usuario, 'gerir-diagnosticos') && { rotulo: t('cultura.novo'), href: '#/cultura/novo', icone: 'plus' },
        pode(usuario, 'ver-kaizen') && { rotulo: t('kaizen.novo'), href: '#/kaizen/novo', icone: 'lampada' },
    ].filter(Boolean).map((a) => ({ ...a, grupo: t('paleta.acoes') }));
    const [cursos, empresas, kaizens] = await Promise.all([
        dados.listarCursos(usuario).catch(() => []),
        pode(usuario, 'ver-empresas') ? dados.listarEmpresas(usuario).catch(() => []) : [],
        pode(usuario, 'ver-kaizen') ? dados.listarKaizens().catch(() => []) : [],
    ]);
    return [
        ...acoes,
        ...telas,
        ...cursos.map((c) => ({ rotulo: c.titulo, grupo: t('paleta.cursos'), href: `#/cursos/${c.id}`, icone: 'book' })),
        ...empresas.map((e) => ({ rotulo: e.nome, grupo: t('paleta.empresas'), href: `#/empresas/${e.id}`, icone: 'building' })),
        ...kaizens.map((k) => ({ rotulo: `KZ-${String(k.numero).padStart(3, '0')} · ${k.titulo}`, grupo: t('paleta.kaizens'), href: `#/kaizen/${k.id}`, icone: 'ciclo' })),
    ];
}

async function abrirPaleta() {
    const usuario = await dados.usuarioAtual();
    if (!usuario || document.querySelector('.paleta')) return;
    fecharMenu();
    const dialogo = document.createElement('dialog');
    dialogo.className = 'dialogo paleta';
    dialogo.setAttribute('aria-label', t('paleta.abrir'));
    dialogo.innerHTML = html`
        <div class="paleta-campo">
            ${icone('busca')}
            <input type="search" role="combobox" aria-expanded="true" aria-controls="paleta-lista" aria-autocomplete="list"
                   placeholder="${t('paleta.placeholder')}" aria-label="${t('paleta.abrir')}" autocomplete="off" spellcheck="false">
            <kbd>Esc</kbd>
        </div>
        <ul class="paleta-lista" id="paleta-lista" role="listbox" aria-label="${t('paleta.resultados')}"></ul>`.texto;
    document.body.append(dialogo);
    dialogo.addEventListener('close', () => dialogo.remove());
    dialogo.addEventListener('click', (evento) => {
        if (evento.target === dialogo) dialogo.close(); // clique fora da caixa
    });
    dialogo.showModal();

    const campo = dialogo.querySelector('input');
    const lista = dialogo.querySelector('.paleta-lista');
    let itens = [];
    let visiveis = [];
    let ativo = 0;

    const desenhar = () => {
        const termos = semAcento(campo.value).split(/\s+/).filter(Boolean);
        visiveis = itens.filter((i) => termos.every((termo) => semAcento(`${i.rotulo} ${i.grupo}`).includes(termo))).slice(0, 40);
        ativo = Math.min(ativo, Math.max(0, visiveis.length - 1));
        lista.innerHTML = (visiveis.length ? html`${visiveis.map((item, i) => html`
            <li id="paleta-${i}" role="option" class="paleta-item" aria-selected="${i === ativo ? 'true' : 'false'}" data-indice="${i}">
                ${icone(item.icone ?? 'arrow', 'icone icone--p')}<span class="paleta-rotulo">${item.rotulo}</span><span class="paleta-grupo">${item.grupo}</span>
            </li>`)}` : html`<li class="paleta-vazio" role="presentation">${itens.length ? t('paleta.nada') : t('comum.carregando')}</li>`).texto;
        campo.setAttribute('aria-activedescendant', visiveis.length ? `paleta-${ativo}` : '');
        lista.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    };
    const ir = (item) => {
        if (!item) return;
        dialogo.close();
        window.location.hash = item.href;
    };

    campo.addEventListener('input', () => {
        ativo = 0;
        desenhar();
    });
    campo.addEventListener('keydown', (evento) => {
        if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
            evento.preventDefault();
            if (!visiveis.length) return;
            ativo = (ativo + (evento.key === 'ArrowDown' ? 1 : -1) + visiveis.length) % visiveis.length;
            desenhar();
        } else if (evento.key === 'Enter') {
            evento.preventDefault();
            ir(visiveis[ativo]);
        }
    });
    lista.addEventListener('click', (evento) => ir(visiveis[Number(evento.target.closest('[data-indice]')?.dataset.indice)]));
    desenhar();
    itens = await itensDaPaleta(usuario);
    if (dialogo.open) desenhar();
}

// --------------------------------------------------------------- eventos --

document.addEventListener('click', async (evento) => {
    const alvo = evento.target.closest('[data-acao], [data-idioma], [data-pular]');
    if (!alvo) return;

    if (alvo.dataset.pular !== undefined) {
        // "Pular para o conteúdo" sem mexer no # (que é usado pelas rotas).
        evento.preventDefault();
        document.getElementById('conteudo')?.focus();
        return;
    }

    if (alvo.dataset.idioma) {
        const usuario = await dados.usuarioAtual();
        preferencias.idioma = definirIdioma(alvo.dataset.idioma);
        await dados.salvarPreferencias({ idioma: preferencias.idioma });
        if (usuario) await dados.definirIdiomaDaConta(usuario.id, preferencias.idioma);
        atualizarTextosFixos();
        await renderizar();
        document.querySelector(`[data-idioma="${preferencias.idioma}"]`)?.focus();
        return;
    }

    switch (alvo.dataset.acao) {
        case 'tema': {
            preferencias.tema = temaEfetivo() === 'escuro' ? 'claro' : 'escuro';
            await dados.salvarPreferencias({ tema: preferencias.tema });
            aplicarTema();
            await renderizar();
            document.querySelector('[data-acao="tema"]:not([hidden])')?.focus();
            break;
        }
        case 'menu':
            abrirMenu(alvo.getAttribute('aria-expanded') !== 'true');
            break;
        case 'fechar-menu':
            fecharMenu();
            break;
        case 'paleta':
            abrirPaleta();
            break;
        case 'sair':
            preparadas.clear();
            await dados.sair();
            anunciar(t('shell.saiu'));
            irPara('login');
            break;
        case 'recarregar':
            renderizar();
            break;
        default:
            break;
    }
});

document.addEventListener('keydown', (evento) => {
    if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault();
        abrirPaleta();
        return;
    }
    if (evento.key === 'Escape') esconderDica();
    if (evento.key === 'Escape' && document.querySelector('#menu-lateral[data-aberto]')) {
        fecharMenu();
        document.querySelector('[data-acao="menu"]')?.focus();
    }
});

function atualizarTextosFixos() {
    document.querySelector('[data-pular]').textContent = t('shell.pularConteudo');
}

// --------------------------------------------------------------- início --

async function iniciar() {
    // Volta do e-mail de recuperação de senha: a sessão vem no endereço e sai dele na hora.
    const retorno = dados.retornoDoAuth(window.location.hash);
    if (retorno) {
        const destino = retorno.erro ? `#/recuperar?erro=${encodeURIComponent(retorno.erro)}` : retorno.tipo === 'recovery' ? '#/nova-senha' : '#/painel';
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}${destino}`);
    }
    await dados.iniciar();
    // Depois de uma ação o cache é limpo; as telas do menu voltam a ser preparadas por trás.
    dados.depoisDeEscrever(() => {
        preparadas.clear();
        aquecerMenu(1500);
    });
    preferencias = await dados.lerPreferencias();
    const usuario = await dados.usuarioAtual();
    const idioma = [preferencias.idioma, usuario?.idioma].find(idiomaValido) ?? IDIOMA_PADRAO;
    definirIdioma(idioma);
    aplicarTema();
    atualizarTextosFixos();

    // Tema "do sistema": acompanha a troca feita no sistema operacional.
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
        if (!preferencias.tema) renderizar();
    });

    window.addEventListener('hashchange', renderizar);
    if (!window.location.hash.startsWith('#/')) history.replaceState(null, '', '#/painel');
    await renderizar();
}

iniciar();
