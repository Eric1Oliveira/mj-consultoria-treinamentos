// Solicitações de acesso: pedidos feitos na página da empresa. Aprovar gera um convite.

import * as dados from '../dados.js';
import { ehEquipe } from '../regras.js';
import { t, formatarRelativo } from '../textos.js';
import { html, icone, opcao, anunciar, mostrarErro, perguntar, copiarTexto, enderecoDe } from '../app.js';

const filtro = { situacao: 'pendente', empresaId: '' };
let conviteGerado = null;

function item(s) {
    return html`<li class="solicitacao">
        <div class="solicitacao-topo">
            <p class="linha-principal">${s.nome}<span class="linha-sub">${s.email} · ${s.empresaNome}</span></p>
            <span class="selo ${s.situacao === 'pendente' ? 'selo--aviso-p' : s.situacao === 'aprovada' ? 'selo--sucesso' : 'selo--neutro'}">${t(`solicitacoes.situacao.${s.situacao}`)}</span>
        </div>
        ${s.mensagem ? html`<p class="solicitacao-mensagem">${s.mensagem}</p>` : ''}
        <p class="atividade-meta">${t('solicitacoes.recebida', { quando: formatarRelativo(s.criadoEm) })}</p>
        ${s.situacao !== 'pendente' ? html`<p class="atividade-meta">${t('solicitacoes.decidida', { situacao: t(`solicitacoes.situacao.${s.situacao}`), nome: s.decididoPorNome ?? t('atividade.alguem'), quando: formatarRelativo(s.decididoEm) })}</p>` : ''}
        ${s.motivo ? html`<p class="atividade-meta">${t('solicitacoes.motivoRegistrado', { motivo: s.motivo })}</p>` : ''}
        ${s.podeDecidir ? html`<div class="acoes acoes--p">
            <button type="button" class="botao botao--primario botao--p" data-decidir="aprovar" data-id="${s.id}" data-nome="${s.nome}">${t('solicitacoes.aprovar')}<span class="sr-only"> – ${s.nome}</span></button>
            <button type="button" class="botao botao--secundario botao--p" data-decidir="recusar" data-id="${s.id}" data-nome="${s.nome}">${t('solicitacoes.recusar')}<span class="sr-only"> – ${s.nome}</span></button>
        </div>` : s.situacao === 'pendente' ? html`<p class="bloco-nota">${t('solicitacoes.aguardaConsultoria')}</p>` : ''}
    </li>`;
}

export async function tela({ usuario, empresa, recarregar }) {
    const equipe = ehEquipe(usuario.perfil);
    const empresas = equipe ? await dados.listarEmpresas(usuario) : [];
    const lista = await dados.listarSolicitacoes(usuario, filtro);

    return {
        titulo: t('solicitacoes.titulo'),
        conteudo: html`
            <header class="cabecalho">
                <h1 class="titulo" tabindex="-1">${t('solicitacoes.titulo')}</h1>
                <p class="subtitulo">${t('solicitacoes.sub')}</p>
                ${!equipe && empresa ? html`<p class="bloco-nota">${t('solicitacoes.paginaPublica')} <a href="#/e/${empresa.identificador}">${enderecoDe(`e/${empresa.identificador}`)}</a></p>` : ''}
            </header>
            ${conviteGerado ? html`<div class="caixa-link" role="group" aria-labelledby="sol-link">
                <p id="sol-link" class="caixa-link-titulo">${t('convites.linkTitulo')} — ${conviteGerado.email}</p>
                <div class="caixa-link-linha">
                    <input class="caixa-link-campo" value="${enderecoDe(`convite/${conviteGerado.codigo}`)}" readonly aria-labelledby="sol-link">
                    <button type="button" class="botao botao--secundario" data-copiar="${enderecoDe(`convite/${conviteGerado.codigo}`)}">${icone('copy', 'icone icone--p')}${t('comum.copiarLink')}</button>
                </div>
                <p class="campo-dica">${t('convites.linkAviso')}</p>
            </div>` : ''}
            <section class="painel-bloco" aria-labelledby="sol-lista">
                <h2 id="sol-lista" class="sr-only">${t('solicitacoes.titulo')}</h2>
                <form class="filtros" data-form="filtro">
                    <div class="campo">
                        <label for="sol-situacao">${t('comum.situacao')}</label>
                        <select id="sol-situacao" name="situacao">${['pendente', 'aprovada', 'recusada', 'todas'].map((s) => opcao(s, t(`solicitacoes.situacoes.${s}`), filtro.situacao === s))}</select>
                    </div>
                    ${equipe ? html`<div class="campo">
                        <label for="sol-empresa">${t('comum.empresa')}</label>
                        <select id="sol-empresa" name="empresaId">
                            ${opcao('', t('auditoria.todasEmpresas'), !filtro.empresaId)}
                            ${empresas.map((e) => opcao(e.id, e.nome, filtro.empresaId === e.id))}
                        </select>
                    </div>` : ''}
                    <button type="submit" class="botao botao--secundario">${t('comum.filtrar')}</button>
                </form>
                ${lista.length ? html`<ul class="solicitacoes" role="list">${lista.map(item)}</ul>` : html`<p class="vazio">${t('solicitacoes.nenhuma')}</p>`}
            </section>`,

        montar(raiz) {
            conviteGerado = null; // o link aparece uma vez, logo depois de aprovar
            const form = raiz.querySelector('[data-form="filtro"]');
            form.addEventListener('submit', (evento) => {
                evento.preventDefault();
                filtro.situacao = form.situacao.value;
                filtro.empresaId = form.empresaId?.value ?? '';
                recarregar();
            });

            raiz.addEventListener('click', async (evento) => {
                const copiar = evento.target.closest('[data-copiar]');
                if (copiar) {
                    copiarTexto(copiar.dataset.copiar);
                    return;
                }
                const botao = evento.target.closest('[data-decidir]');
                if (!botao) return;
                const { id, nome } = botao.dataset;
                try {
                    if (botao.dataset.decidir === 'aprovar') {
                        conviteGerado = await dados.aprovarSolicitacao(usuario, id);
                        anunciar(t('solicitacoes.aprovada', { nome }));
                    } else {
                        const motivo = await perguntar({
                            titulo: t('solicitacoes.recusarTitulo', { nome }),
                            texto: t('solicitacoes.recusarTexto'),
                            confirmar: t('solicitacoes.recusar'),
                            perigo: true,
                            campo: { rotulo: t('solicitacoes.motivo'), multilinha: true, obrigatorio: true },
                        });
                        if (!motivo) return;
                        await dados.recusarSolicitacao(usuario, id, motivo);
                        anunciar(t('solicitacoes.recusada'));
                    }
                    await recarregar();
                } catch (erro) {
                    mostrarErro(erro);
                }
            });
        },
    };
}
