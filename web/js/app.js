// Liga tudo: navegação entre telas (#/rota), menu, tema, idioma e a faixa de
// demonstração. As telas ficam em js/telas/ e só falam com os dados por dados.js.

import * as dados from './dados.js';
import { pode, corSegura, iniciais, ehEquipe } from './regras.js';
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
    text: '<path d="M6 4h9l4 4v12H6z"/><path d="M14 4v5h5M9 13h7M9 17h5"/>',
    award: '<circle cx="12" cy="9" r="5.5"/><path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7"/>',
    flame: '<path d="M12 21c4 0 7-2.8 7-6.8 0-4.6-4.3-6.7-5.2-11.2-2 1.7-3.3 4-3.3 6.3-1.2-.6-2-1.8-2.3-3C6 8.5 5 10.8 5 14.2 5 18.2 8 21 12 21z"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".75"/>',
};

export function icone(nome, classe = 'icone') {
    return new Seguro(`<svg class="${esc(classe)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONES[nome] ?? ''}</svg>`);
}

/** Trilha de aprendizado (assinatura visual). `feitas`/`total` desenham o progresso real. */
export function trilhaSvg(feitas = 3, total = 6) {
    const pontos = [[24, 196], [104, 196], [176, 132], [232, 132], [304, 68], [364, 68]];
    const n = Math.max(1, Math.min(total, pontos.length));
    const usados = pontos.slice(0, n);
    const atual = Math.min(feitas, n - 1);
    const caminho = usados.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
    const feito = usados.slice(0, atual + 1).map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
    const marcos = usados.map(([x, y], i) => {
        if (i === n - 1) return `<circle cx="${x}" cy="${y}" r="13" class="trilha-selo"/><path d="M${x - 5.5} ${y + 0.5}l3.6 3.6 7-7.4" class="trilha-selo-check"/>`;
        if (i < atual) return `<circle cx="${x}" cy="${y}" r="5.5" class="trilha-feito"/>`;
        if (i === atual) return `<circle cx="${x}" cy="${y}" r="9" class="trilha-atual"/><circle cx="${x}" cy="${y}" r="3.5" class="trilha-feito"/>`;
        return `<circle cx="${x}" cy="${y}" r="5" class="trilha-pendente"/>`;
    }).join('');
    return new Seguro(`<svg class="trilha" viewBox="0 0 400 230" fill="none" aria-hidden="true" focusable="false">
        <path d="${caminho}" class="trilha-caminho"/><path d="${feito}" class="trilha-caminho-feito"/>${marcos}</svg>`);
}

// ------------------------------------------------------ pequenos blocos --

export function logo({ inverso = false } = {}) {
    return html`<span class="logo ${inverso ? 'logo--inverso' : ''}">
        <span class="logo-selo" aria-hidden="true">MJ</span>
        <span class="logo-nome"><span class="sr-only">MJ </span>Consultoria</span>
    </span>`;
}

export function avatar(nome, cor) {
    return html`<span class="avatar" data-cor="${cor ?? ''}" aria-hidden="true">${iniciais(nome)}</span>`;
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
    relatorios: { icone: 'chart', acao: 'ver-relatorios', carregar: () => import('./telas/relatorios.js') },
    auditoria: { icone: 'list', acao: 'ver-auditoria', carregar: () => import('./telas/auditoria.js') },
    conta: { icone: 'user', carregar: () => import('./telas/conta.js') },
};

const MENU = ['painel', 'empresas', 'pessoas', 'equipe', 'solicitacoes', 'cursos', 'relatorios', 'auditoria', 'conta'];

function lerRota() {
    const bruto = window.location.hash.replace(/^#\/?/, '');
    const [nome, ...parametros] = bruto.split('/').filter(Boolean);
    return { nome: nome || 'painel', parametros };
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

/** Cor da empresa nas telas do funcionário; equipe e visitantes veem a da consultora. */
function aplicarMarca(usuario, empresa) {
    const raiz = document.documentElement.style;
    if (usuario && !ehEquipe(usuario.perfil) && empresa?.cor) raiz.setProperty('--brand', corSegura(empresa.cor));
    else raiz.removeProperty('--brand');
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
    visual.textContent = mensagem;
    visual.dataset.tipo = tipo;
    visual.hidden = false;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => {
        visual.hidden = true;
    }, 4500);
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
            resolver(confirmado && valor !== '' ? valor : null);
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

// -------------------------------------------------------- faixa da demo --

async function renderizarFaixa(usuario) {
    const faixa = document.getElementById('faixa-demo');
    const perfis = await dados.listarPerfisDemo();
    faixa.setAttribute('aria-label', t('demo.rotulo'));
    faixa.innerHTML = html`
        <p class="faixa-texto">
            <span class="selo selo--demo">${t('demo.rotulo')}</span>
            <span class="faixa-descricao">${t('demo.descricao')}</span>
        </p>
        <div class="faixa-acoes">
            <form class="ver-como" data-form="ver-como">
                <label for="ver-como-perfil">${t('demo.verComo')}</label>
                <select id="ver-como-perfil" name="perfil">
                    ${perfis.map((p) => html`<option value="${p.id}" ${p.id === usuario?.id ? html`selected` : ''}>${t(`perfis.${p.perfil}`)} — ${p.nome}${p.empresa ? ` (${p.empresa.nome})` : ''}</option>`)}
                </select>
                <button type="submit" class="botao botao--faixa">${t('demo.trocar')}</button>
            </form>
            <button type="button" class="botao botao--faixa-fantasma" data-acao="restaurar">${icone('restore', 'icone icone--p')}${t('demo.restaurar')}</button>
        </div>`.texto;
}

// -------------------------------------------------------------- layouts --

let assinaturaLayout = null;

function montarPublico() {
    const app = document.getElementById('app');
    const assinatura = `publico|${idiomaAtual()}|${temaEfetivo()}`;
    if (assinaturaLayout === assinatura) return app.querySelector('#conteudo');
    assinaturaLayout = assinatura;
    app.innerHTML = html`
        <div class="publico">
            <aside class="publico-marca" aria-label="${MARCA}">
                ${logo({ inverso: true })}
                <div class="publico-marca-meio">
                    ${trilhaSvg(3, 6)}
                    <p class="publico-tagline">${t('login.tagline')}</p>
                    <p class="publico-apoio">${t('login.apoio')}</p>
                </div>
                <p class="publico-rodape">© ${new Date().getFullYear()} ${MARCA}</p>
            </aside>
            <div class="publico-corpo">
                <header class="publico-topo">
                    <span class="publico-logo-celular">${logo()}</span>
                    ${controlesPreferencias()}
                </header>
                <main id="conteudo" class="publico-conteudo" tabindex="-1"></main>
            </div>
        </div>`.texto;
    return app.querySelector('#conteudo');
}

function itensDoMenu(usuario) {
    return MENU.filter((nome) => !ROTAS[nome].acao || pode(usuario, ROTAS[nome].acao));
}

function montarShell(usuario, empresa, rotaAtual) {
    const app = document.getElementById('app');
    const assinatura = `shell|${usuario.id}|${idiomaAtual()}|${temaEfetivo()}`;
    if (assinaturaLayout !== assinatura) {
        assinaturaLayout = assinatura;
        const navegacao = html`
            <ul class="nav-lista" role="list">
                ${itensDoMenu(usuario).map((nome) => html`
                    <li><a class="nav-item" href="#/${nome}" data-rota="${nome}">
                        ${icone(ROTAS[nome].icone)}<span class="nav-rotulo">${t(`nav.${nome}`)}</span>
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
            </div>`;

        app.innerHTML = html`
            <div class="shell">
                <header class="topo">
                    ${logo()}
                    <button type="button" class="botao-icone" data-acao="menu" aria-controls="menu-lateral" aria-expanded="false">
                        ${icone('menu', 'icone icone-abrir')}${icone('close', 'icone icone-fechar')}
                        <span class="sr-only">${t('shell.menu')}</span>
                    </button>
                </header>
                <aside class="lateral" id="menu-lateral">
                    <div class="lateral-logo">${logo()}</div>
                    <nav class="lateral-nav" aria-label="${t('shell.navPrincipal')}">${navegacao}</nav>
                    ${rodape}
                </aside>
                <main id="conteudo" class="principal" tabindex="-1"></main>
            </div>`.texto;
        aplicarEstilosDinamicos(app);
    }

    app.querySelectorAll('[data-rota]').forEach((link) => {
        if (link.dataset.rota === rotaAtual) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
    fecharMenu();
    return app.querySelector('#conteudo');
}

function fecharMenu() {
    const botao = document.querySelector('[data-acao="menu"]');
    if (!botao) return;
    botao.setAttribute('aria-expanded', 'false');
    document.getElementById('menu-lateral')?.removeAttribute('data-aberto');
}

// ------------------------------------------------------------ renderizar --

let geracao = 0;
let primeiraTela = true;

async function renderizar() {
    const minha = ++geracao;
    const { nome, parametros } = lerRota();
    const rota = ROTAS[nome];
    const usuario = await dados.usuarioAtual();

    if (rota && !rota.publica && !usuario) return irPara('login');
    if (nome === 'login' && usuario) return irPara('painel');

    const empresa = usuario?.empresaId ? await dados.obterEmpresa(usuario.empresaId) : null;
    if (minha !== geracao) return;

    aplicarMarca(usuario, empresa);
    await renderizarFaixa(usuario);
    const publica = !usuario || rota?.publica;
    const principal = publica ? montarPublico() : montarShell(usuario, empresa, rota?.menu ?? nome);

    let resultado;
    try {
        if (!rota) {
            resultado = telaMensagem(t('erros.naoEncontradaTitulo'), t('erros.naoEncontradaTexto'));
        } else if (rota.acao && !pode(usuario, rota.acao)) {
            resultado = telaMensagem(t('erros.semPermissaoTitulo'), t('erros.semPermissaoTexto'));
        } else {
            principal.setAttribute('aria-busy', 'true');
            const modulo = await rota.carregar();
            resultado = await modulo[rota.funcao ?? 'tela']({ usuario, empresa, parametros, recarregar: renderizar });
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

    // Página pública de empresa: a cor dela vale enquanto a página estiver aberta.
    if (resultado.marca) document.documentElement.style.setProperty('--brand', corSegura(resultado.marca));
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
    resultado.montar?.(tela, { usuario, empresa, parametros, recarregar: renderizar });
    document.title = `${resultado.titulo} · ${MARCA}`;
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

// --------------------------------------------------------------- eventos --

function abrirRestaurar() {
    const dialogo = document.getElementById('dialogo-restaurar');
    dialogo.querySelector('[data-texto="titulo"]').textContent = t('demo.restaurarTitulo');
    dialogo.querySelector('[data-texto="corpo"]').textContent = t('demo.restaurarTexto');
    dialogo.querySelector('[data-texto="cancelar"]').textContent = t('comum.cancelar');
    dialogo.querySelector('[data-texto="confirmar"]').textContent = t('demo.restaurarConfirmar');
    dialogo.showModal();
}

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
        case 'menu': {
            const aberto = alvo.getAttribute('aria-expanded') === 'true';
            alvo.setAttribute('aria-expanded', String(!aberto));
            document.getElementById('menu-lateral').toggleAttribute('data-aberto', !aberto);
            break;
        }
        case 'sair':
            await dados.sair();
            anunciar(t('shell.saiu'));
            irPara('login');
            break;
        case 'restaurar':
            abrirRestaurar();
            break;
        case 'recarregar':
            renderizar();
            break;
        default:
            break;
    }
});

document.addEventListener('submit', async (evento) => {
    if (evento.target.dataset.form !== 'ver-como') return;
    evento.preventDefault();
    const id = new FormData(evento.target).get('perfil');
    const usuario = await dados.entrarComo(String(id));
    anunciar(t('demo.trocadoPara', { nome: usuario.nome }));
    irPara('painel');
});

document.addEventListener('keydown', (evento) => {
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
    await dados.iniciar();
    preferencias = await dados.lerPreferencias();
    const usuario = await dados.usuarioAtual();
    const idioma = [preferencias.idioma, usuario?.idioma].find(idiomaValido) ?? IDIOMA_PADRAO;
    definirIdioma(idioma);
    aplicarTema();
    atualizarTextosFixos();

    document.getElementById('dialogo-restaurar').addEventListener('close', async (evento) => {
        if (evento.target.returnValue !== 'confirmar') return;
        await dados.restaurarExemplo();
        anunciar(t('demo.restaurado'));
        irPara('login');
    });

    // Tema "do sistema": acompanha a troca feita no sistema operacional.
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
        if (!preferencias.tema) renderizar();
    });

    window.addEventListener('hashchange', renderizar);
    if (!window.location.hash.startsWith('#/')) history.replaceState(null, '', '#/painel');
    await renderizar();
}

iniciar();
