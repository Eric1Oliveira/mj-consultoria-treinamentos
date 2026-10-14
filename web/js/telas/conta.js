// Minha conta: nome, idioma, tema e certificados.

import * as dados from '../dados.js';
import { podeEstudar } from '../regras.js';
import { t, IDIOMAS, idiomaAtual, formatarData } from '../textos.js';
import { html, icone, opcao, anunciar, mostrarErro, mudarPreferencias, preferenciaTema } from '../app.js';

export async function tela({ usuario, empresa, recarregar }) {
    const cursos = podeEstudar(usuario.perfil) ? await dados.listarCursos(usuario) : [];
    const certificados = cursos.filter((c) => c.progresso?.certificadoId);
    const tema = preferenciaTema() ?? '';

    return {
        titulo: t('conta.titulo'),
        conteudo: html`
            <header class="cabecalho">
                <h1 class="titulo" tabindex="-1">${t('conta.titulo')}</h1>
                <p class="subtitulo">${t('conta.sub')}</p>
            </header>
            <div class="painel-grade">
                <div class="painel-coluna">
                    <form class="painel-bloco formulario" data-form="conta" novalidate>
                        <h2 class="bloco-titulo">${t('conta.dados')}</h2>
                        <div class="campo">
                            <label for="conta-nome">${t('comum.nome')}</label>
                            <input id="conta-nome" name="nome" value="${usuario.nome}" maxlength="120" required autocomplete="name">
                        </div>
                        <div class="campo">
                            <label for="conta-email">${t('comum.email')}</label>
                            <input id="conta-email" value="${usuario.email}" readonly aria-describedby="conta-email-dica">
                            <p id="conta-email-dica" class="campo-dica">${t('conta.emailDica')}</p>
                        </div>
                        <dl class="ficha">
                            <div><dt>${t('comum.perfil')}</dt><dd>${t(`perfis.${usuario.perfil}`)}</dd></div>
                            ${empresa ? html`<div><dt>${t('comum.empresa')}</dt><dd>${empresa.nome}</dd></div>` : ''}
                        </dl>
                        <h2 class="bloco-titulo">${t('conta.preferencias')}</h2>
                        <div class="grade-2">
                            <div class="campo">
                                <label for="conta-idioma">${t('conta.idioma')}</label>
                                <select id="conta-idioma" name="idioma">${Object.entries(IDIOMAS).map(([codigo, nome]) => opcao(codigo, nome, codigo === idiomaAtual()))}</select>
                            </div>
                            <div class="campo">
                                <label for="conta-tema">${t('conta.tema')}</label>
                                <select id="conta-tema" name="tema">
                                    ${opcao('', t('conta.temaSistema'), tema === '')}
                                    ${opcao('claro', t('conta.temaClaro'), tema === 'claro')}
                                    ${opcao('escuro', t('conta.temaEscuro'), tema === 'escuro')}
                                </select>
                            </div>
                        </div>
                        <p class="campo-erro" data-resumo-erro role="alert" hidden></p>
                        <div class="acoes"><button type="submit" class="botao botao--primario">${t('comum.salvarAlteracoes')}</button></div>
                    </form>
                </div>
                <div class="painel-coluna painel-coluna--lateral">
                    ${podeEstudar(usuario.perfil) ? html`<section class="painel-bloco" aria-labelledby="conta-certificados">
                        <h2 id="conta-certificados" class="bloco-titulo">${t('conta.certificados')}</h2>
                        ${certificados.length ? html`<ul class="linhas" role="list">${certificados.map((c) => html`
                            <li class="linha linha--compacta">
                                <span class="medalha" aria-hidden="true">${icone('award')}</span>
                                <span class="linha-principal">${c.titulo}<span class="linha-sub">${t('cursos.concluidoEm', { data: formatarData(c.progresso.concluidoEm, { dateStyle: 'medium' }) })}</span></span>
                                <a class="botao botao--secundario botao--p" href="#/certificado/${c.progresso.certificadoId}">${t('cursos.verCertificado')}<span class="sr-only"> – ${c.titulo}</span></a>
                            </li>`)}</ul>` : html`<p class="vazio">${t('conta.semCertificados')}</p>`}
                    </section>` : ''}
                    <section class="painel-bloco painel-bloco--sutil" aria-labelledby="conta-seguranca">
                        <h2 id="conta-seguranca" class="bloco-titulo">${t('conta.seguranca')}</h2>
                        <p class="bloco-nota">${t('conta.segurancaTexto')}</p>
                    </section>
                </div>
            </div>`,
        montar(raiz) {
            const form = raiz.querySelector('[data-form="conta"]');
            form.addEventListener('submit', async (evento) => {
                evento.preventDefault();
                try {
                    await dados.atualizarConta(usuario, { nome: form.nome.value, idioma: form.idioma.value });
                    await mudarPreferencias({ idioma: form.idioma.value, tema: form.tema.value });
                    anunciar(t('conta.salva'));
                    await recarregar();
                } catch (erro) {
                    mostrarErro(erro, form);
                }
            });
        },
    };
}
