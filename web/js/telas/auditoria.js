// Auditoria: quem fez o quê e quando, com filtros e paginação. Cada perfil vê só o que pode.

import * as dados from '../dados.js';
import { t, formatarData, formatarNumero } from '../textos.js';
import { html, opcao, desenharEm, fraseAtividade } from '../app.js';

const filtro = { de: '', ate: '', empresaId: '', categoria: '', pessoa: '' };
let pagina = 1;

function resultado({ itens, total, pagina: atual, paginas }) {
    if (!total) return html`<p class="vazio">${t('auditoria.nenhum')}</p>`;
    return html`
        <p class="bloco-nota" role="status">${t('auditoria.total', { n: formatarNumero(total) })}</p>
        <div class="tabela-rolagem" tabindex="0" role="region" aria-label="${t('auditoria.titulo')}">
            <table class="tabela">
                <thead><tr>
                    <th scope="col">${t('auditoria.quando')}</th>
                    <th scope="col">${t('auditoria.acao')}</th>
                    <th scope="col">${t('comum.empresa')}</th>
                </tr></thead>
                <tbody>${itens.map((e) => html`<tr>
                    <td class="tabela-data"><time datetime="${e.em}">${formatarData(e.em, { dateStyle: 'short', timeStyle: 'short' })}</time></td>
                    <td>${fraseAtividade(e)}</td>
                    <td>${e.empresa ?? t('comum.semValor')}</td>
                </tr>`)}</tbody>
            </table>
        </div>
        ${paginas > 1 ? html`<nav class="paginacao" aria-label="${t('comum.paginacao')}">
            <button type="button" class="botao botao--secundario botao--p" data-pagina="${atual - 1}" ${atual <= 1 ? html`disabled` : ''}>${t('comum.anterior')}</button>
            <span>${t('comum.paginaDe', { atual, total: paginas })}</span>
            <button type="button" class="botao botao--secundario botao--p" data-pagina="${atual + 1}" ${atual >= paginas ? html`disabled` : ''}>${t('comum.proxima')}</button>
        </nav>` : ''}`;
}

export async function tela({ usuario }) {
    const [empresas, primeira] = await Promise.all([dados.listarEmpresas(usuario), dados.listarAuditoria(usuario, filtro, pagina)]);

    return {
        titulo: t('auditoria.titulo'),
        conteudo: html`
            <header class="cabecalho">
                <h1 class="titulo" tabindex="-1">${t('auditoria.titulo')}</h1>
                <p class="subtitulo">${t('auditoria.sub')}</p>
            </header>
            <section class="painel-bloco" aria-labelledby="aud-lista">
                <h2 id="aud-lista" class="sr-only">${t('auditoria.titulo')}</h2>
                <form class="filtros filtros--grade" data-form="filtro">
                    <div class="campo"><label for="aud-de">${t('auditoria.de')}</label><input id="aud-de" name="de" type="date" value="${filtro.de}"></div>
                    <div class="campo"><label for="aud-ate">${t('auditoria.ate')}</label><input id="aud-ate" name="ate" type="date" value="${filtro.ate}"></div>
                    <div class="campo">
                        <label for="aud-empresa">${t('comum.empresa')}</label>
                        <select id="aud-empresa" name="empresaId">
                            ${opcao('', t('auditoria.todasEmpresas'), !filtro.empresaId)}
                            ${empresas.map((e) => opcao(e.id, e.nome, filtro.empresaId === e.id))}
                        </select>
                    </div>
                    <div class="campo">
                        <label for="aud-categoria">${t('auditoria.categoria')}</label>
                        <select id="aud-categoria" name="categoria">
                            ${opcao('', t('auditoria.todasCategorias'), !filtro.categoria)}
                            ${dados.CATEGORIAS_AUDITORIA.map((c) => opcao(c, t(`auditoria.categorias.${c}`), filtro.categoria === c))}
                        </select>
                    </div>
                    <div class="campo"><label for="aud-pessoa">${t('auditoria.pessoa')}</label><input id="aud-pessoa" name="pessoa" type="search" value="${filtro.pessoa}" autocomplete="off"></div>
                    <div class="filtros-acoes">
                        <button type="submit" class="botao botao--primario">${t('comum.filtrar')}</button>
                        <button type="reset" class="botao botao--secundario">${t('comum.limpar')}</button>
                    </div>
                </form>
                <div data-resultado>${resultado(primeira)}</div>
            </section>`,

        montar(raiz) {
            const form = raiz.querySelector('[data-form="filtro"]');
            const alvo = raiz.querySelector('[data-resultado]');
            const buscar = async () => {
                desenharEm(alvo, resultado(await dados.listarAuditoria(usuario, filtro, pagina)));
            };
            form.addEventListener('submit', (evento) => {
                evento.preventDefault();
                Object.assign(filtro, { de: form.de.value, ate: form.ate.value, empresaId: form.empresaId.value, categoria: form.categoria.value, pessoa: form.pessoa.value });
                pagina = 1;
                buscar();
            });
            form.addEventListener('reset', () => {
                Object.assign(filtro, { de: '', ate: '', empresaId: '', categoria: '', pessoa: '' });
                pagina = 1;
                // o reset do navegador volta aos valores iniciais do HTML; limpamos de verdade depois dele
                setTimeout(() => {
                    form.querySelectorAll('input').forEach((campo) => { campo.value = ''; });
                    form.querySelectorAll('select').forEach((campo) => { campo.value = ''; });
                    buscar();
                });
            });
            alvo.addEventListener('click', async (evento) => {
                const botao = evento.target.closest('[data-pagina]');
                if (!botao) return;
                pagina = Number(botao.dataset.pagina);
                await buscar();
                alvo.querySelector('[role="status"]')?.setAttribute('tabindex', '-1');
                alvo.querySelector('[role="status"]')?.focus();
            });
        },
    };
}
