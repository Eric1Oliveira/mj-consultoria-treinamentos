// Funcionários de uma empresa: busca, edição, desativação, perfil e convites
// (um a um ou em lote). Os blocos de convite também servem à tela "Equipe".

import * as dados from '../dados.js';
import { pode, podeGerirPessoa, podeConvidar, ehEquipe } from '../regras.js';
import { t, formatarRelativo } from '../textos.js';
import { html, icone, avatar, opcao, anunciar, mostrarErro, limparErros, desenharEm, perguntar, copiarTexto, enderecoDe } from '../app.js';

// ------------------------------------------------------- convites (comum) --

let ultimoConvite = null; // último convite criado/renovado nesta tela, para mostrar o link

function caixaLink(convite) {
    if (!convite) return '';
    const endereco = enderecoDe(`convite/${convite.codigo}`);
    return html`<div class="caixa-link" role="group" aria-labelledby="caixa-link-titulo">
        <p id="caixa-link-titulo" class="caixa-link-titulo">${t('convites.linkTitulo')} — ${convite.email}</p>
        <div class="caixa-link-linha">
            <input class="caixa-link-campo" value="${endereco}" readonly aria-labelledby="caixa-link-titulo" data-selecionar>
            <button type="button" class="botao botao--secundario" data-copiar="${endereco}">${icone('copy', 'icone icone--p')}${t('comum.copiarLink')}</button>
        </div>
        <p class="campo-dica">${t('convites.linkAviso')}</p>
    </div>`;
}

function listaConvites(convites) {
    if (!convites.length) return html`<p class="vazio">${t('convites.nenhumPendente')}</p>`;
    return html`<ul class="linhas" role="list">
        ${convites.map((c) => html`
            <li class="linha linha--compacta">
                <span class="linha-principal">${c.email}
                    <span class="linha-sub">${t(`perfis.${c.perfil}`)} · ${c.expirado ? t('convites.expirado') : t('convites.expira', { quando: formatarRelativo(c.expiraEm) })}${c.convidadoPorNome ? ` · ${t('convites.convidadoPor', { nome: c.convidadoPorNome })}` : ''}</span>
                </span>
                <span class="linha-acoes">
                    ${c.pendente ? html`<button type="button" class="botao botao--secundario botao--p" data-copiar="${enderecoDe(`convite/${c.codigo}`)}">${t('comum.copiarLink')}<span class="sr-only"> – ${c.email}</span></button>` : ''}
                    <button type="button" class="botao botao--secundario botao--p" data-convite="renovar" data-id="${c.id}">${t('convites.renovar')}<span class="sr-only"> – ${c.email}</span></button>
                    <button type="button" class="botao botao--fantasma botao--p" data-convite="cancelar" data-id="${c.id}" data-email="${c.email}">${t('convites.cancelar')}<span class="sr-only"> – ${c.email}</span></button>
                </span>
            </li>`)}
    </ul>`;
}

/** Bloco "Convidar": formulário, link do último convite e convites pendentes. */
export function blocoConvites({ perfis, convites, titulo, empresaId = null }) {
    const ultimo = ultimoConvite && ultimoConvite.empresaId === empresaId ? ultimoConvite : null;
    return html`<section class="painel-bloco" aria-labelledby="convites-titulo">
        <h2 id="convites-titulo" class="bloco-titulo">${titulo}</h2>
        <form class="formulario formulario--compacto" data-form="convite" novalidate>
            <div class="campo">
                <label for="convite-email">${t('comum.email')}</label>
                <input id="convite-email" name="email" type="email" maxlength="255" required autocomplete="off" spellcheck="false" autocapitalize="none">
            </div>
            ${perfis.length > 1 ? html`<div class="campo">
                <label for="convite-perfil">${t('comum.perfil')}</label>
                <select id="convite-perfil" name="perfil">${perfis.map((p) => opcao(p, t(`perfis.${p}`)))}</select>
            </div>` : html`<input type="hidden" name="perfil" value="${perfis[0]}">`}
            <p class="campo-erro" data-resumo-erro role="alert" hidden></p>
            <button type="submit" class="botao botao--primario">${t('convites.enviar')}</button>
        </form>
        <div data-caixa-link>${caixaLink(ultimo)}</div>
        <h3 class="subbloco-titulo">${t('convites.pendentes')}</h3>
        <div data-convites>${listaConvites(convites)}</div>
    </section>`;
}

/** Liga o bloco de convites. `empresaId` null = convites da equipe. */
export function ligarConvites(raiz, usuario, empresaId, recarregar) {
    raiz.addEventListener('click', async (evento) => {
        const copiar = evento.target.closest('[data-copiar]');
        if (copiar) {
            copiarTexto(copiar.dataset.copiar);
            return;
        }
        const campo = evento.target.closest('[data-selecionar]');
        if (campo) campo.select();

        const botao = evento.target.closest('[data-convite]');
        if (!botao) return;
        try {
            if (botao.dataset.convite === 'renovar') {
                ultimoConvite = await dados.renovarConvite(usuario, botao.dataset.id);
                anunciar(t('convites.renovado', { email: ultimoConvite.email }));
            } else {
                const ok = await perguntar({
                    titulo: t('convites.cancelarTitulo', { email: botao.dataset.email }),
                    texto: t('convites.cancelarTexto'),
                    confirmar: t('convites.cancelar'),
                    cancelar: t('convites.manter'),
                    perigo: true,
                });
                if (!ok) return;
                await dados.cancelarConvite(usuario, botao.dataset.id);
                if (ultimoConvite?.id === botao.dataset.id) ultimoConvite = null;
                anunciar(t('convites.cancelado'));
            }
            await recarregar();
        } catch (erro) {
            mostrarErro(erro);
        }
    });

    const form = raiz.querySelector('[data-form="convite"]');
    form?.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        limparErros(form);
        try {
            ultimoConvite = await dados.criarConvite(usuario, { email: form.email.value, perfil: form.perfil.value, empresaId });
            anunciar(t('convites.criado', { email: ultimoConvite.email }));
            await recarregar();
        } catch (erro) {
            mostrarErro(erro, form);
        }
    });
}

export function esquecerUltimoConvite() {
    ultimoConvite = null;
}

// ---------------------------------------------------------- convite em lote --

function previaLote(linhas) {
    if (!linhas.length) return html`<p class="vazio">${t('convites.loteVazio')}</p>`;
    const ok = linhas.filter((l) => l.ok).length;
    return html`
        <p class="lote-resumo" role="status">${t('convites.loteResumo', { ok, erro: linhas.length - ok })}</p>
        <div class="tabela-rolagem" tabindex="0" role="region" aria-label="${t('convites.loteRotulo')}">
            <table class="tabela">
                <thead><tr><th scope="col">${t('convites.linha')}</th><th scope="col">${t('comum.nome')}</th><th scope="col">${t('comum.email')}</th><th scope="col">${t('comum.situacao')}</th></tr></thead>
                <tbody>${linhas.map((l) => html`<tr>
                    <td>${l.numero}</td><td>${l.nome || t('comum.semValor')}</td><td>${l.email || t('comum.semValor')}</td>
                    <td>${l.ok ? html`<span class="selo selo--sucesso">${t('convites.pronto')}</span>` : html`<span class="selo selo--perigo">${t(`erros.campos.${l.motivo}`)}</span>`}</td>
                </tr>`)}</tbody>
            </table>
        </div>
        ${ok ? html`<button type="button" class="botao botao--primario" data-lote-criar>${t('convites.loteCriar')} (${ok})</button>` : ''}`;
}

function blocoLote() {
    return html`<details class="painel-bloco painel-bloco--recolhivel">
        <summary class="bloco-titulo">${icone('users', 'icone')}<span>${t('convites.loteTitulo')}</span>${icone('arrow', 'icone icone--p recolhivel-seta')}</summary>
        <form class="formulario formulario--compacto" data-form="lote">
            <div class="campo">
                <label for="lote-lista">${t('convites.loteRotulo')}</label>
                <textarea id="lote-lista" name="lista" rows="5" aria-describedby="lote-dica" spellcheck="false"></textarea>
                <p id="lote-dica" class="campo-dica">${t('convites.loteDica')}</p>
            </div>
            <button type="submit" class="botao botao--secundario">${t('convites.analisar')}</button>
        </form>
        <div data-lote-previa></div>
    </details>`;
}

function ligarLote(raiz, usuario, empresaId, recarregar) {
    const form = raiz.querySelector('[data-form="lote"]');
    const alvo = raiz.querySelector('[data-lote-previa]');
    let linhas = [];
    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        try {
            linhas = await dados.analisarLote(usuario, empresaId, form.lista.value);
            desenharEm(alvo, previaLote(linhas));
        } catch (erro) {
            mostrarErro(erro);
        }
    });
    alvo.addEventListener('click', async (evento) => {
        if (!evento.target.closest('[data-lote-criar]')) return;
        try {
            const criados = await dados.criarConvitesEmLote(usuario, empresaId, linhas.filter((l) => l.ok).map((l) => l.email));
            anunciar(t('convites.loteCriados', { n: criados.length }));
            await recarregar();
        } catch (erro) {
            mostrarErro(erro);
        }
    });
}

// ------------------------------------------------------------- pessoas --

const filtro = { busca: '', situacao: 'todas' };
let empresaDoFiltro = null;

/** Linha de uma pessoa com as ações que `usuario` pode fazer nela. */
export function linhaPessoa(usuario, p) {
    const gerir = podeGerirPessoa(usuario, p);
    const mudarPerfil = pode(usuario, 'mudar-perfil', { pessoa: p });
    const outroPerfil = p.perfil === 'student' ? 'company_admin' : 'student';
    return html`
        <li class="linha">
            ${avatar(p.nome)}
            <span class="linha-principal">${p.nome}${p.id === usuario.id ? html` <span class="selo selo--marca">${t('pessoas.voce')}</span>` : ''}
                <span class="linha-sub">${p.email}</span>
                <span class="linha-sub">${t(`perfis.${p.perfil}`)} · ${p.ultimoAcesso ? t('painel.ultimoAcesso', { quando: formatarRelativo(p.ultimoAcesso) }) : t('painel.nuncaEntrou')}</span>
            </span>
            ${p.ativo ? '' : html`<span class="selo selo--neutro">${t('comum.inativo')}</span>`}
            ${gerir || mudarPerfil ? html`<span class="linha-acoes">
                ${gerir ? html`<button type="button" class="botao botao--secundario botao--p" data-pessoa="renomear" data-id="${p.id}" data-nome="${p.nome}">${t('pessoas.editarNome')}<span class="sr-only"> – ${p.nome}</span></button>` : ''}
                ${mudarPerfil && p.ativo ? html`<button type="button" class="botao botao--secundario botao--p" data-pessoa="perfil" data-id="${p.id}" data-nome="${p.nome}" data-perfil="${outroPerfil}">${t(outroPerfil === 'company_admin' ? 'pessoas.tornarGestor' : 'pessoas.tornarAluno')}<span class="sr-only"> – ${p.nome}</span></button>` : ''}
                ${gerir ? html`<button type="button" class="botao ${p.ativo ? 'botao--fantasma' : 'botao--secundario'} botao--p" data-pessoa="${p.ativo ? 'desativar' : 'reativar'}" data-id="${p.id}" data-nome="${p.nome}">${p.ativo ? t('comum.desativar') : t('comum.reativar')}<span class="sr-only"> – ${p.nome}</span></button>` : ''}
            </span>` : ''}
        </li>`;
}

export function listaPessoas(usuario, pessoas, vazio = t('pessoas.nenhuma')) {
    if (!pessoas.length) return html`<p class="vazio">${vazio}</p>`;
    return html`<ul class="linhas" role="list">${pessoas.map((p) => linhaPessoa(usuario, p))}</ul>`;
}

/** Ações por pessoa (desativar, reativar, renomear, mudar perfil). */
export function ligarPessoas(raiz, usuario, recarregar) {
    raiz.addEventListener('click', async (evento) => {
        const botao = evento.target.closest('[data-pessoa]');
        if (!botao) return;
        const { id, nome } = botao.dataset;
        try {
            switch (botao.dataset.pessoa) {
                case 'renomear': {
                    const novo = await perguntar({
                        titulo: t('pessoas.editarNomeTitulo', { nome }),
                        confirmar: t('comum.salvar'),
                        campo: { rotulo: t('comum.nome'), valor: nome, obrigatorio: true },
                    });
                    if (!novo) return;
                    await dados.renomearPessoa(usuario, id, novo);
                    anunciar(t('pessoas.renomeada'));
                    break;
                }
                case 'desativar': {
                    const ok = await perguntar({ titulo: t('pessoas.desativarTitulo', { nome }), texto: t('pessoas.desativarTexto'), confirmar: t('comum.desativar'), perigo: true });
                    if (!ok) return;
                    await dados.definirSituacaoPessoa(usuario, id, false);
                    anunciar(t('pessoas.desativada', { nome }));
                    break;
                }
                case 'reativar':
                    await dados.definirSituacaoPessoa(usuario, id, true);
                    anunciar(t('pessoas.reativada', { nome }));
                    break;
                case 'perfil': {
                    const perfil = t(`perfis.${botao.dataset.perfil}`);
                    const ok = await perguntar({ titulo: t('pessoas.perfilTitulo', { nome, perfil }), confirmar: t('comum.confirmar') });
                    if (!ok) return;
                    await dados.definirPerfilPessoa(usuario, id, botao.dataset.perfil);
                    anunciar(t('pessoas.perfilAlterado', { nome, perfil }));
                    break;
                }
                default:
                    return;
            }
            await recarregar();
        } catch (erro) {
            mostrarErro(erro);
        }
    });
}

export async function tela({ usuario, parametros, recarregar }) {
    let empresas = [];
    let empresaId = usuario.empresaId;
    if (ehEquipe(usuario.perfil)) {
        empresas = await dados.listarEmpresas(usuario);
        empresaId = parametros[0] && empresas.some((e) => e.id === parametros[0]) ? parametros[0] : empresas.find((e) => e.ativa)?.id ?? empresas[0]?.id;
    }
    const empresa = await dados.obterEmpresa(empresaId);
    if (!empresa) throw new dados.ErroDados('nao-encontrado');
    if (empresaDoFiltro !== empresaId) {
        empresaDoFiltro = empresaId;
        filtro.busca = '';
        filtro.situacao = 'todas';
        esquecerUltimoConvite();
    }

    const pessoas = await dados.listarPessoas(usuario, empresaId, filtro);
    const perfisConvite = ['company_admin', 'student'].filter((p) => podeConvidar(usuario, p, empresa));
    const convites = perfisConvite.length ? await dados.listarConvites(usuario, empresaId) : [];

    return {
        titulo: t('pessoas.titulo'),
        conteudo: html`
            <header class="cabecalho cabecalho--acoes">
                <div>
                    <h1 class="titulo" tabindex="-1">${t('pessoas.titulo')}</h1>
                    <p class="subtitulo">${t('pessoas.sub', { empresa: empresa.nome })}</p>
                </div>
                ${empresas.length ? html`<form class="filtros filtros--compacto" data-form="empresa">
                    <div class="campo">
                        <label for="pessoas-empresa">${t('pessoas.escolherEmpresa')}</label>
                        <select id="pessoas-empresa" name="empresa">${empresas.map((e) => opcao(e.id, e.ativa ? e.nome : `${e.nome} (${t('empresas.inativa')})`, e.id === empresaId))}</select>
                    </div>
                    <button type="submit" class="botao botao--secundario">${t('pessoas.trocarEmpresa')}</button>
                </form>` : ''}
            </header>
            <div class="painel-grade">
                <div class="painel-coluna">
                    <section class="painel-bloco" aria-labelledby="pessoas-lista-titulo">
                        <h2 id="pessoas-lista-titulo" class="sr-only">${t('pessoas.titulo')}</h2>
                        <form class="filtros" data-form="filtro" role="search">
                            <div class="campo campo--cresce">
                                <label for="pessoas-busca">${t('pessoas.buscaRotulo')}</label>
                                <input id="pessoas-busca" name="busca" type="search" value="${filtro.busca}" autocomplete="off">
                            </div>
                            <div class="campo">
                                <label for="pessoas-situacao">${t('comum.situacao')}</label>
                                <select id="pessoas-situacao" name="situacao">
                                    ${opcao('todas', t('comum.todas'), filtro.situacao === 'todas')}
                                    ${opcao('ativas', t('comum.ativas'), filtro.situacao === 'ativas')}
                                    ${opcao('inativas', t('comum.inativas'), filtro.situacao === 'inativas')}
                                </select>
                            </div>
                        </form>
                        <div data-lista aria-live="polite">${listaPessoas(usuario, pessoas)}</div>
                    </section>
                </div>
                ${perfisConvite.length ? html`<div class="painel-coluna painel-coluna--lateral">
                    ${blocoConvites({ perfis: perfisConvite, convites, titulo: t('convites.titulo'), empresaId })}
                    ${perfisConvite.includes('student') && empresa.ativa ? blocoLote() : ''}
                </div>` : ''}
            </div>`,

        montar(raiz) {
            raiz.querySelector('[data-form="empresa"]')?.addEventListener('submit', (evento) => {
                evento.preventDefault();
                window.location.hash = `#/pessoas/${evento.target.empresa.value}`;
            });
            const form = raiz.querySelector('[data-form="filtro"]');
            form.addEventListener('input', async () => {
                filtro.busca = form.busca.value;
                filtro.situacao = form.situacao.value;
                desenharEm(raiz.querySelector('[data-lista]'), listaPessoas(usuario, await dados.listarPessoas(usuario, empresaId, filtro)));
            });
            form.addEventListener('submit', (evento) => evento.preventDefault());
            ligarPessoas(raiz, usuario, recarregar);
            if (perfisConvite.length) ligarConvites(raiz, usuario, empresaId, recarregar);
            if (raiz.querySelector('[data-form="lote"]')) ligarLote(raiz, usuario, empresaId, recarregar);
        },
    };
}
