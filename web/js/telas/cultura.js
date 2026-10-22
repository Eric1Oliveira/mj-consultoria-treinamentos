// Cultura e maturidade: diagnósticos baseados em normas, respondidos de forma anônima.
//
// Rotas: #/cultura (panorama da consultoria ou diagnósticos da empresa)
//        #/cultura/diagnosticos · #/cultura/novo · #/cultura/:id · #/cultura/:id/responder
//        #/cultura/modelos · #/cultura/modelos/novo · #/cultura/modelos/:id   (cultura-modelos.js)

import * as dados from '../dados.js';
import { ehEquipe, pode, faixaRisco, GAP_PONTO_CEGO, zonaEnps } from '../regras.js';
import { t, formatarNumero, formatarPercentual, formatarData } from '../textos.js';
import { html, icone, opcao, anunciar, irPara, mostrarErro, perguntar, celebrar, baixarCsv, indicador } from '../app.js';
import {
    barraNota, classeCalor, legendaCalor, barraFavorabilidade, legendaFavorabilidade, halteres, legendaHalteres,
    barraEnps, linhaEvolucao, variacao, nomesNiveis, leitura, seloLeitura,
} from '../graficos.js';

// ------------------------------------------------------------- leitura --

const nomeDimensao = (d, id) => d.dimensoes.find((x) => x.id === id)?.nome ?? id;

function situacaoDiagnostico(d) {
    if (d.aberto) {
        return html`<span class="selo selo--sucesso"><span class="ponto-vivo" aria-hidden="true"></span>${d.fechaEm ? t('cultura.abertoAte', { data: formatarData(`${d.fechaEm}T12:00:00`, { day: 'numeric', month: 'short' }) }) : t('cultura.aberto')}</span>`;
    }
    return html`<span class="selo selo--neutro">${t('cultura.encerrado')}</span>`;
}

function abas(atual) {
    const itens = [
        ['panorama', '#/cultura', 'chart'],
        ['diagnosticos', '#/cultura/diagnosticos', 'list'],
        ['modelos', '#/cultura/modelos', 'layers'],
    ];
    return html`<nav class="abas" aria-label="${t('cultura.titulo')}">
        ${itens.map(([chave, href, ic]) => html`<a class="aba" href="${href}" ${chave === atual ? html`aria-current="page"` : ''}>${icone(ic, 'icone icone--p')}${t(`cultura.abas.${chave}`)}</a>`)}
    </nav>`;
}

function cabecalho(usuario, sub) {
    return html`<header class="cabecalho cabecalho--acoes">
        <div>
            <h1 class="titulo" tabindex="-1">${t('cultura.titulo')}</h1>
            <p class="subtitulo">${sub}</p>
        </div>
        ${pode(usuario, 'gerir-diagnosticos') ? html`<a class="botao botao--primario" href="#/cultura/novo">${icone('plus')}${t('cultura.novo')}</a>` : ''}
    </header>`;
}

// ------------------------------------------------------------- panorama --

/** Modelo que vem com a plataforma (supabase/schema.sql): "Maturidade da gestão e da cultura". */
const MODELO_PADRAO = 'a0000000-0000-4000-8000-000000000001';

async function telaPanorama(usuario, consulta) {
    // O mapa sai junto com a lista de modelos (o pedido já sabe qual modelo mostrar na maioria das vezes).
    const pedido = consulta.get('modelo') || MODELO_PADRAO;
    const [modelos, panoramaPedido, cursos, empresas] = await Promise.all([
        dados.listarModelos(),
        dados.panoramaMaturidade(pedido).catch(() => null),
        dados.listarCursosResumo(),
        dados.panoramaEmpresas(),
    ]);
    const modelo = modelos.find((m) => m.id === consulta.get('modelo')) ?? modelos.find((m) => m.padrao) ?? modelos[0];
    const panorama = modelo?.id === pedido && panoramaPedido ? panoramaPedido : modelo ? await dados.panoramaMaturidade(modelo.id) : [];
    const comResultado = panorama.filter((p) => !p.resultado.oculto && p.resultado.geral !== null);
    const media = (lista) => (lista.length ? Math.round(lista.reduce((s, n) => s + n, 0) / lista.length) : null);
    const mediaGeral = media(comResultado.map((p) => p.resultado.geral));
    const limiteAtencao = modelo?.interpretacao === 'risco' ? 50 : 40;
    const emAtencao = comResultado.filter((p) => p.resultado.geral < limiteAtencao).length;
    const respondentes = panorama.reduce((s, p) => s + p.resultado.respondentes, 0);
    const mediasDim = (modelo?.dimensoes ?? []).map((dm) => ({
        ...dm,
        media: media(comResultado.map((p) => p.resultado.dimensoes?.find((x) => x.id === dm.id)?.score).filter((n) => n !== null && n !== undefined)),
    }));
    const semDiagnostico = empresas.filter((e) => !panorama.some((p) => p.empresa.id === e.id));

    // Onde atuar primeiro: a dimensão mais fraca de cada empresa, da nota mais baixa para a mais alta.
    const oportunidades = comResultado.map((p) => {
        const fraca = [...(p.resultado.dimensoes ?? [])].filter((x) => x.score !== null).sort((a, b) => a.score - b.score)[0];
        return fraca ? { ...p, fraca, dimensao: modelo.dimensoes.find((x) => x.id === fraca.id) } : null;
    }).filter((o) => o?.dimensao).sort((a, b) => a.fraca.score - b.fraca.score).slice(0, 6);
    const curso = (id) => cursos.find((c) => c.id === id);

    const tabelaCalor = () => html`
        <div class="tabela-rolagem" tabindex="0" role="region" aria-labelledby="panorama-calor-titulo">
            <table class="tabela tabela--calor">
                <thead><tr>
                    <th scope="col">${t('comum.empresa')}</th>
                    ${modelo.dimensoes.map((dm) => html`<th scope="col" class="calor-coluna"><span>${dm.nome}</span></th>`)}
                    <th scope="col" class="num">${t('cultura.geral')}</th>
                    <th scope="col">${t('cultura.tendencia')}</th>
                    <th scope="col" class="num">${t('cultura.respostas')}</th>
                </tr></thead>
                <tbody>
                    ${panorama.map((p) => {
                        const r = p.resultado;
                        return html`<tr>
                            <th scope="row"><a class="linha-link" href="#/cultura/${p.diagnostico.id}">${p.empresa.nome}</a>${p.diagnostico.aberto ? html`<span class="linha-sub">${t('cultura.coletando')}</span>` : ''}</th>
                            ${r.oculto
                                ? html`<td colspan="${modelo.dimensoes.length + 1}" class="calor-oculto">${t('cultura.aguardando', { n: r.respondentes, min: r.anonimatoMinimo })}</td>`
                                : html`${modelo.dimensoes.map((dm) => {
                                    const nota = r.dimensoes?.find((x) => x.id === dm.id)?.score ?? null;
                                    const l = leitura(nota, modelo);
                                    return html`<td class="${classeCalor(nota)}" data-dica="${dm.nome}: ${nota ?? '—'}${l ? ` · ${l.texto}` : ''}">${nota ?? '—'}</td>`;
                                })}
                                <td class="num calor-geral">${r.geral}</td>`}
                            <td>${r.oculto ? '' : variacao(r.geral, p.anterior)}</td>
                            <td class="num">${formatarNumero(r.respondentes)}<span class="linha-sub">${formatarPercentual(r.elegiveis ? r.respondentes / r.elegiveis : 0)}</span></td>
                        </tr>`;
                    })}
                </tbody>
                ${comResultado.length > 1 ? html`<tfoot><tr>
                    <th scope="row">${t('cultura.mediaCarteira')}</th>
                    ${mediasDim.map((dm) => html`<td class="${classeCalor(dm.media)}">${dm.media ?? '—'}</td>`)}
                    <td class="num calor-geral">${mediaGeral ?? '—'}</td><td></td><td></td>
                </tr></tfoot>` : ''}
            </table>
        </div>
        ${legendaCalor(nomesNiveis(modelo))}`;

    return {
        titulo: t('cultura.titulo'),
        conteudo: html`
            ${cabecalho(usuario, t('cultura.subEquipe'))}
            ${abas('panorama')}
            <form class="filtros filtros--solto" data-form="modelo">
                <div class="campo campo--cresce">
                    <label for="panorama-modelo">${t('cultura.modelo')}</label>
                    <select id="panorama-modelo" name="modelo">${modelos.map((m) => opcao(m.id, m.titulo, m.id === modelo?.id))}</select>
                </div>
            </form>
            ${modelo ? html`<p class="norma">${icone('escudo', 'icone icone--p')}${modelo.norma}</p>` : ''}

            <section aria-labelledby="panorama-resumo">
                <h2 id="panorama-resumo" class="sr-only">${t('painel.resumo')}</h2>
                <dl class="indicadores">
                    ${indicador(t('cultura.mediaCarteira'), mediaGeral === null ? t('comum.semValor') : html`${mediaGeral}<small class="indicador-sufixo">${leitura(mediaGeral, modelo)?.texto ?? ''}</small>`, true)}
                    ${indicador(t('cultura.empresasAvaliadas'), html`${formatarNumero(comResultado.length)}<small class="indicador-sufixo">${t('cultura.deEmpresas', { n: formatarNumero(empresas.length) })}</small>`)}
                    ${indicador(modelo?.interpretacao === 'risco' ? t('cultura.empresasRisco') : t('cultura.empresasAtencao'), formatarNumero(emAtencao))}
                    ${indicador(t('cultura.respondentes'), formatarNumero(respondentes))}
                </dl>
            </section>

            ${panorama.length ? html`
                <section class="painel-bloco" aria-labelledby="panorama-calor-titulo">
                    <div class="bloco-cabecalho">
                        <h2 id="panorama-calor-titulo" class="bloco-titulo">${t('cultura.mapaTitulo')}</h2>
                        <p class="bloco-nota">${t('cultura.mapaNota')}</p>
                    </div>
                    ${tabelaCalor()}
                </section>
                <div class="painel-grade painel-grade--respiro">
                    <div class="painel-coluna">
                        <section class="painel-bloco" aria-labelledby="oportunidades-titulo">
                            <div class="bloco-cabecalho">
                                <h2 id="oportunidades-titulo" class="bloco-titulo">${t('cultura.oportunidadesTitulo')}</h2>
                                <p class="bloco-nota">${t('cultura.oportunidadesNota')}</p>
                            </div>
                            ${oportunidades.length ? html`<ul class="oportunidades" role="list">${oportunidades.map((o) => html`
                                <li class="oportunidade">
                                    <div class="oportunidade-topo">
                                        <span class="linha-principal"><a class="linha-link" href="#/cultura/${o.diagnostico.id}">${o.empresa.nome}</a><span class="linha-sub">${o.dimensao.nome}</span></span>
                                        <span class="oportunidade-nota">${o.fraca.score}</span>
                                        ${seloLeitura(o.fraca.score, modelo)}
                                    </div>
                                    ${o.dimensao.recomendacao ? html`<p class="oportunidade-texto">${o.dimensao.recomendacao}</p>` : ''}
                                    <div class="oportunidade-acoes">
                                        ${(o.dimensao.cursos ?? []).map(curso).filter(Boolean).map((c) => (c.empresas.includes(o.empresa.id)
                                            ? html`<span class="selo selo--sucesso">${icone('check', 'icone icone--p')}${c.titulo}</span>`
                                            : html`<button type="button" class="botao botao--secundario botao--p" data-liberar="${c.id}" data-empresa="${o.empresa.id}" data-nomes="${c.titulo}|${o.empresa.nome}">${icone('send', 'icone icone--p')}${t('cultura.liberarCurso', { curso: c.titulo })}</button>`))}
                                        <a class="botao botao--fantasma botao--p" href="#/kaizen/novo?empresa=${o.empresa.id}&dimensao=${encodeURIComponent(o.dimensao.nome)}">${icone('lampada', 'icone icone--p')}${t('cultura.abrirKaizen')}</a>
                                    </div>
                                </li>`)}</ul>` : html`<p class="vazio">${t('cultura.semOportunidades')}</p>`}
                            ${modelo && !(modelo.dimensoes ?? []).some((dm) => dm.cursos?.length) ? html`<p class="nota">${icone('book', 'icone icone--p')}${t('cultura.dicaCursos')} <a href="#/cultura/modelos/${modelo.id}">${t('cultura.editarModelo')}</a></p>` : ''}
                        </section>
                    </div>
                    <div class="painel-coluna painel-coluna--lateral">
                        <section class="painel-bloco" aria-labelledby="medias-titulo">
                            <div class="bloco-cabecalho">
                                <h2 id="medias-titulo" class="bloco-titulo">${t('cultura.mediasTitulo')}</h2>
                                <p class="bloco-nota">${t('cultura.mediasNota')}</p>
                            </div>
                            <ul class="barras-lista" role="list">${[...mediasDim].filter((dm) => dm.media !== null).sort((a, b) => b.media - a.media).map((dm) => html`
                                <li><span class="barras-rotulo">${dm.nome}</span>${barraNota(dm.media, dm.nome)}</li>`)}</ul>
                        </section>
                        ${semDiagnostico.length ? html`<section class="painel-bloco painel-bloco--sutil" aria-labelledby="sem-diag-titulo">
                            <h2 id="sem-diag-titulo" class="bloco-titulo">${t('cultura.semDiagnosticoTitulo')}</h2>
                            <ul class="linhas" role="list">${semDiagnostico.map((e) => html`<li class="linha linha--compacta">
                                <span class="linha-principal">${e.nome}<span class="linha-sub">${t('cultura.pessoasAtivas', { n: formatarNumero(e.pessoas) })}</span></span>
                                <a class="botao botao--secundario botao--p" href="#/cultura/novo?empresa=${e.id}&modelo=${modelo?.id ?? ''}">${t('cultura.lancar')}<span class="sr-only"> – ${e.nome}</span></a>
                            </li>`)}</ul>
                        </section>` : ''}
                    </div>
                </div>` : html`<section class="painel-bloco vazio-destaque">
                    ${icone('bussola')}
                    <h2 class="bloco-titulo">${t('cultura.panoramaVazioTitulo')}</h2>
                    <p class="bloco-nota">${t('cultura.panoramaVazioTexto')}</p>
                    <a class="botao botao--primario" href="#/cultura/novo?modelo=${modelo?.id ?? ''}">${t('cultura.lancarPrimeiro')}</a>
                </section>`}`,

        montar(raiz, { recarregar }) {
            const form = raiz.querySelector('[data-form="modelo"]');
            form.addEventListener('change', () => { window.location.hash = `#/cultura?modelo=${form.modelo.value}`; });
            form.addEventListener('submit', (evento) => evento.preventDefault());
            ligarLiberarCurso(raiz, recarregar);
        },
    };
}

/** Botões "Liberar curso" (diagnóstico → treinamento num clique). */
function ligarLiberarCurso(raiz, recarregar) {
    raiz.addEventListener('click', async (evento) => {
        const botao = evento.target.closest('[data-liberar]');
        if (!botao) return;
        const [curso, empresa] = botao.dataset.nomes.split('|');
        const ok = await perguntar({ titulo: t('cultura.liberarTitulo', { curso, empresa }), texto: t('cultura.liberarTexto'), confirmar: t('cultura.liberar') });
        if (!ok) return;
        botao.disabled = true;
        try {
            const salvo = await dados.liberarCurso(botao.dataset.liberar, botao.dataset.empresa);
            anunciar(t(salvo.ativo ? 'cultura.cursoLiberado' : 'cultura.cursoLiberadoInativo', { curso, empresa }));
            await recarregar();
        } catch (erro) {
            botao.disabled = false;
            mostrarErro(erro);
        }
    });
}

// ------------------------------------------------------- diagnósticos --

function itemDiagnostico(usuario, d) {
    const taxa = d.elegiveis ? d.respondentes / d.elegiveis : 0;
    const gere = ehEquipe(usuario.perfil) || usuario.perfil === 'company_admin';
    const podeVer = gere || !d.aberto;
    return html`<li class="diagnostico">
        <div class="diagnostico-corpo">
            <p class="sobretitulo">${ehEquipe(usuario.perfil) ? d.empresaNome : t('cultura.diagnostico')}</p>
            <h3 class="diagnostico-titulo">${podeVer ? html`<a href="#/cultura/${d.id}">${d.titulo}</a>` : d.titulo}</h3>
            <p class="diagnostico-meta">${situacaoDiagnostico(d)}<span>${t('cultura.perguntasMin', { n: d.perguntas, min: Math.max(3, Math.round(d.perguntas / 4)) })}</span><span>${formatarData(d.criadoEm, { dateStyle: 'medium' })}</span></p>
        </div>
        <div class="diagnostico-adesao">
            <p class="diagnostico-adesao-rotulo" id="adesao-${d.id}">${t('cultura.adesao', { n: formatarNumero(d.respondentes), total: formatarNumero(d.elegiveis) })}<span>${formatarPercentual(taxa)}</span></p>
            <div class="barra barra--fina" role="progressbar" aria-labelledby="adesao-${d.id}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(taxa * 100)}"><span class="barra-preenchida" data-progresso="${Math.round(taxa * 100)}"></span></div>
        </div>
        <div class="diagnostico-acoes">
            ${d.aberto && d.possoResponder && !d.respondi ? html`<a class="botao botao--primario botao--p" href="#/cultura/${d.id}/responder">${t('cultura.responder')}</a>` : ''}
            ${d.respondi ? html`<span class="selo selo--sucesso">${icone('check', 'icone icone--p')}${t('cultura.respondido')}</span>` : ''}
            ${podeVer ? html`<a class="botao botao--secundario botao--p" href="#/cultura/${d.id}">${gere ? t('cultura.verResultado') : t('cultura.verDevolutiva')}<span class="sr-only"> – ${d.titulo}</span></a>` : ''}
        </div>
    </li>`;
}

async function telaDiagnosticos(usuario, consulta) {
    const equipe = ehEquipe(usuario.perfil);
    const empresaId = equipe ? consulta.get('empresa') ?? '' : '';
    const [lista, empresas] = await Promise.all([
        dados.listarDiagnosticos({ empresaId }),
        equipe ? dados.listarEmpresas(usuario) : [],
    ]);
    const pendentes = lista.filter((d) => d.aberto && d.possoResponder && !d.respondi);
    const outros = lista.filter((d) => !pendentes.includes(d));

    // Gestor: o retrato mais recente da empresa no topo.
    let retrato = '';
    if (usuario.perfil === 'company_admin') {
        const recente = lista.find((d) => d.respondentes > 0);
        if (recente) {
            try {
                const r = await dados.resultadoDiagnostico(recente.id);
                if (!r.oculto) {
                    const dims = (r.dimensoes ?? []).filter((x) => x.score !== null).sort((a, b) => b.score - a.score);
                    retrato = html`<section class="retrato" aria-labelledby="retrato-titulo">
                        <div class="retrato-nota">
                            <span class="retrato-numero">${r.geral}</span>
                            ${seloLeitura(r.geral, recente)}
                        </div>
                        <div class="retrato-texto">
                            <h2 id="retrato-titulo" class="bloco-titulo">${t('cultura.retratoTitulo')}</h2>
                            <p class="bloco-nota">${recente.titulo} · ${t('cultura.adesao', { n: r.respondentes, total: r.elegiveis })}</p>
                            ${dims.length > 1 ? html`<p class="retrato-destaques">
                                <span>${icone('star', 'icone icone--p')}${t('cultura.forte')}: <strong>${nomeDimensao(recente, dims[0].id)}</strong> (${dims[0].score})</span>
                                <span>${icone('target', 'icone icone--p')}${t('cultura.oportunidade')}: <strong>${nomeDimensao(recente, dims[dims.length - 1].id)}</strong> (${dims[dims.length - 1].score})</span>
                            </p>` : ''}
                        </div>
                        <a class="botao botao--secundario" href="#/cultura/${recente.id}">${t('cultura.verResultado')}${icone('arrow', 'icone icone--p')}</a>
                    </section>`;
                }
            } catch {
                retrato = '';
            }
        }
    }

    return {
        titulo: t('cultura.titulo'),
        conteudo: html`
            ${cabecalho(usuario, equipe ? t('cultura.subEquipe') : usuario.perfil === 'company_admin' ? t('cultura.subGestor') : t('cultura.subAluno'))}
            ${equipe ? abas('diagnosticos') : ''}
            ${retrato}
            ${!equipe && usuario.perfil === 'student' ? html`<p class="nota nota--anonimato">${icone('lock', 'icone icone--p')}${t('cultura.anonimatoCurto')}</p>` : ''}
            ${equipe ? html`<form class="filtros filtros--solto" data-form="empresa">
                <div class="campo campo--cresce">
                    <label for="diag-empresa">${t('comum.empresa')}</label>
                    <select id="diag-empresa" name="empresa">
                        ${opcao('', t('relatorios.todasEmpresas'), !empresaId)}
                        ${empresas.map((e) => opcao(e.id, e.nome, e.id === empresaId))}
                    </select>
                </div>
            </form>` : ''}
            ${pendentes.length ? html`<section class="secao" aria-labelledby="diag-pendentes">
                <div class="secao-cabecalho"><h2 id="diag-pendentes" class="secao-titulo">${t('cultura.suaVez')}</h2></div>
                <ul class="diagnosticos diagnosticos--destaque" role="list">${pendentes.map((d) => itemDiagnostico(usuario, d))}</ul>
            </section>` : ''}
            <section class="painel-bloco" aria-labelledby="diag-lista">
                <h2 id="diag-lista" class="bloco-titulo">${pendentes.length ? t('cultura.outros') : t('cultura.abas.diagnosticos')}</h2>
                ${outros.length ? html`<ul class="diagnosticos" role="list">${outros.map((d) => itemDiagnostico(usuario, d))}</ul>`
                    : html`<p class="vazio">${pode(usuario, 'gerir-diagnosticos') ? t('cultura.nenhumGestor') : t('cultura.nenhumAluno')}</p>`}
            </section>`,
        montar(raiz) {
            const form = raiz.querySelector('[data-form="empresa"]');
            form?.addEventListener('change', () => { window.location.hash = `#/cultura/diagnosticos${form.empresa.value ? `?empresa=${form.empresa.value}` : ''}`; });
            form?.addEventListener('submit', (evento) => evento.preventDefault());
        },
    };
}

// ------------------------------------------------------------- lançar --

async function telaNovo(usuario, consulta) {
    if (!pode(usuario, 'gerir-diagnosticos')) throw new dados.ErroDados('proibido');
    const equipe = ehEquipe(usuario.perfil);
    const [modelos, empresas] = await Promise.all([
        dados.listarModelos(),
        equipe ? dados.listarEmpresas(usuario, { situacao: 'ativas' }) : [],
    ]);
    const publicados = modelos.filter((m) => m.publicado || equipe);
    let modeloId = consulta.get('modelo') && publicados.some((m) => m.id === consulta.get('modelo')) ? consulta.get('modelo') : publicados[0]?.id;
    const empresaId = consulta.get('empresa') ?? '';
    const extras = [];
    const modeloAtual = () => publicados.find((m) => m.id === modeloId);

    const listaExtras = () => {
        const m = modeloAtual();
        return html`${extras.length ? html`<ol class="extras" role="list">${extras.map((x, i) => html`<li class="extra">
            <div class="campo">
                <label for="extra-dim-${i}">${t('cultura.extraDimensao')}</label>
                <select id="extra-dim-${i}" data-extra="${i}" data-campo-extra="dimensao">${m.dimensoes.map((dm) => opcao(dm.id, dm.nome, dm.id === x.dimensao))}</select>
            </div>
            <div class="campo campo--cresce">
                <label for="extra-texto-${i}">${t('cultura.extraTexto', { n: i + 1 })}</label>
                <input id="extra-texto-${i}" data-extra="${i}" data-campo-extra="texto" value="${x.texto}" maxlength="300" placeholder="${t('cultura.extraExemplo')}">
            </div>
            <button type="button" class="botao-icone" data-remover-extra="${i}" aria-label="${t('cultura.removerExtra', { n: i + 1 })}">${icone('close', 'icone icone--p')}</button>
        </li>`)}</ol>` : ''}
        ${extras.length < 10 ? html`<button type="button" class="botao botao--secundario botao--p" data-add-extra>${icone('plus', 'icone icone--p')}${t('cultura.addExtra')}</button>` : ''}`;
    };

    return {
        titulo: t('cultura.novo'),
        conteudo: html`
            <a class="voltar" href="#/cultura">${icone('back', 'icone icone--p')}${t('cultura.titulo')}</a>
            <header class="cabecalho">
                <h1 class="titulo" tabindex="-1">${t('cultura.novo')}</h1>
                <p class="subtitulo">${t('cultura.novoSub')}</p>
            </header>
            <form class="formulario" data-form="diagnostico" novalidate>
                <fieldset class="secao-form">
                    <legend class="bloco-titulo">${t('cultura.passoModelo')}</legend>
                    <div class="modelos-escolha" role="radiogroup" aria-label="${t('cultura.modelo')}">
                        ${publicados.map((m) => html`<label class="modelo-opcao">
                            <input type="radio" name="modeloId" value="${m.id}" ${m.id === modeloId ? html`checked` : ''}>
                            <span class="modelo-opcao-corpo">
                                <span class="modelo-opcao-titulo">${m.titulo}${m.interpretacao === 'risco' ? html` <span class="selo selo--aviso-p">${t('cultura.leituraRisco')}</span>` : ''}</span>
                                <span class="modelo-opcao-texto">${m.descricao}</span>
                                <span class="modelo-opcao-meta">${icone('escudo', 'icone icone--p')}${m.norma}</span>
                                <span class="modelo-opcao-meta">${t('cultura.modeloResumo', { dimensoes: m.dimensoes.length, perguntas: m.questoes.length })}</span>
                            </span>
                        </label>`)}
                    </div>
                </fieldset>

                <fieldset class="secao-form">
                    <legend class="bloco-titulo">${t('cultura.passoAplicacao')}</legend>
                    ${equipe ? html`<div class="campo">
                        <label for="diag-novo-empresa">${t('comum.empresa')}</label>
                        <select id="diag-novo-empresa" name="empresaId" required>
                            ${opcao('', t('cultura.escolhaEmpresa'), !empresaId)}
                            ${empresas.map((e) => opcao(e.id, e.nome, e.id === empresaId))}
                        </select>
                    </div>` : ''}
                    <div class="campo">
                        <label for="diag-novo-titulo">${t('cultura.tituloAplicacao')} <span class="rotulo-opcional">(${t('comum.opcional')})</span></label>
                        <input id="diag-novo-titulo" name="titulo" maxlength="150" placeholder="${t('cultura.tituloExemplo', { ano: new Date().getFullYear() })}">
                    </div>
                    <div class="grade-3">
                        <div class="campo">
                            <label for="diag-novo-publico">${t('cultura.publico')}</label>
                            <select id="diag-novo-publico" name="publico">
                                ${['todos', 'funcionarios', 'gestores'].map((p) => opcao(p, t(`cultura.publicos.${p}`), p === 'todos'))}
                            </select>
                        </div>
                        <div class="campo">
                            <label for="diag-novo-fecha">${t('cultura.fechaEm')} <span class="rotulo-opcional">(${t('comum.opcional')})</span></label>
                            <input id="diag-novo-fecha" name="fechaEm" type="date" min="${new Date().toLocaleDateString('sv-SE')}">
                        </div>
                        <div class="campo">
                            <label for="diag-novo-anonimato">${t('cultura.anonimato')}</label>
                            <select id="diag-novo-anonimato" name="anonimatoMinimo" aria-describedby="diag-anonimato-dica">
                                ${[3, 5, 8, 10].map((n) => opcao(n, t('cultura.anonimatoOpcao', { n }), n === 3))}
                            </select>
                        </div>
                    </div>
                    <p id="diag-anonimato-dica" class="campo-dica">${t('cultura.anonimatoDica')}</p>
                    <label class="campo-check"><input type="checkbox" name="enps" checked><span>${t('cultura.incluirEnps')}</span></label>
                    <label class="campo-check"><input type="checkbox" name="comentarios" checked><span>${t('cultura.incluirComentarios')}</span></label>
                </fieldset>

                <fieldset class="secao-form">
                    <legend class="bloco-titulo">${t('cultura.passoExtras')} <span class="rotulo-opcional">(${t('comum.opcional')})</span></legend>
                    <p class="campo-dica">${t('cultura.extrasDica')}</p>
                    <div data-extras>${listaExtras()}</div>
                </fieldset>

                <p class="campo-erro" data-resumo-erro role="alert" hidden></p>
                <div class="acoes">
                    <button type="submit" class="botao botao--primario botao--g">${icone('send')}${t('cultura.lancarAgora')}</button>
                    <a class="botao botao--secundario" href="#/cultura">${t('comum.cancelar')}</a>
                </div>
            </form>`,

        montar(raiz) {
            const form = raiz.querySelector('[data-form="diagnostico"]');
            const regiao = raiz.querySelector('[data-extras]');
            const redesenhar = (foco) => {
                regiao.innerHTML = listaExtras().texto;
                if (foco) regiao.querySelector(`#${foco}`)?.focus();
            };
            form.addEventListener('change', (evento) => {
                if (evento.target.name === 'modeloId') {
                    modeloId = evento.target.value;
                    const dims = modeloAtual().dimensoes.map((dm) => dm.id);
                    extras.forEach((x) => { if (!dims.includes(x.dimensao)) x.dimensao = dims[0]; });
                    redesenhar();
                }
            });
            form.addEventListener('input', (evento) => {
                const i = evento.target.dataset.extra;
                if (i !== undefined) extras[Number(i)][evento.target.dataset.campoExtra] = evento.target.value;
            });
            form.addEventListener('click', (evento) => {
                if (evento.target.closest('[data-add-extra]')) {
                    extras.push({ dimensao: modeloAtual().dimensoes[0].id, texto: '' });
                    redesenhar(`extra-texto-${extras.length - 1}`);
                }
                const remover = evento.target.closest('[data-remover-extra]');
                if (remover) {
                    extras.splice(Number(remover.dataset.removerExtra), 1);
                    redesenhar();
                }
            });
            form.addEventListener('submit', async (evento) => {
                evento.preventDefault();
                const botao = form.querySelector('[type="submit"]');
                botao.disabled = true;
                try {
                    const criado = await dados.criarDiagnostico({
                        empresaId: form.empresaId?.value,
                        modeloId,
                        titulo: form.titulo.value,
                        publico: form.publico.value,
                        fechaEm: form.fechaEm.value,
                        anonimatoMinimo: form.anonimatoMinimo.value,
                        enps: form.enps.checked,
                        comentarios: form.comentarios.checked,
                        extras,
                    });
                    anunciar(t('cultura.lancado', { titulo: criado.titulo }));
                    irPara(`cultura/${criado.id}`);
                } catch (erro) {
                    mostrarErro(erro, form);
                } finally {
                    botao.disabled = false;
                }
            });
        },
    };
}

// ------------------------------------------------------------ responder --

const ESCALA = [1, 2, 3, 4, 5];
const chaveRascunho = (id) => `mjc:rascunho-diagnostico:${id}`;

function lerRascunho(id) {
    try {
        return JSON.parse(sessionStorage.getItem(chaveRascunho(id))) ?? {};
    } catch {
        return {};
    }
}

function guardarRascunho(id, valores) {
    try {
        sessionStorage.setItem(chaveRascunho(id), JSON.stringify(valores));
    } catch {
        // sem armazenamento: o rascunho vale só enquanto a tela estiver aberta
    }
}

async function telaResponder(usuario, id) {
    const d = await dados.obterDiagnostico(id);
    if (!d.possoResponder) {
        const motivo = d.respondi ? 'jaRespondeu' : !d.aberto ? 'encerrado' : 'foraDoPublico';
        return {
            titulo: d.titulo,
            conteudo: html`<a class="voltar" href="#/cultura">${icone('back', 'icone icone--p')}${t('cultura.titulo')}</a>
                <header class="cabecalho">
                    <h1 class="titulo" tabindex="-1">${d.titulo}</h1>
                    <p class="subtitulo">${t(`cultura.naoResponde.${motivo}`)}</p>
                </header>
                <a class="botao botao--secundario" href="#/cultura">${t('cultura.voltarCultura')}</a>`,
        };
    }
    const rascunho = lerRascunho(id);
    const total = d.questoes.length + (d.enps ? 1 : 0);
    const gestor = usuario.perfil === 'company_admin';

    return {
        titulo: d.titulo,
        conteudo: html`
            <a class="voltar" href="#/cultura">${icone('back', 'icone icone--p')}${t('cultura.titulo')}</a>
            <header class="cabecalho">
                <p class="sobretitulo">${d.empresaNome}</p>
                <h1 class="titulo" tabindex="-1">${d.titulo}</h1>
                <p class="subtitulo">${t('cultura.responderSub', { n: d.questoes.length, min: Math.max(3, Math.round(d.questoes.length / 4)) })}</p>
            </header>
            <aside class="promessa" aria-labelledby="promessa-titulo">
                <span class="promessa-icone" aria-hidden="true">${icone('lock')}</span>
                <div>
                    <h2 id="promessa-titulo" class="bloco-titulo">${t('cultura.promessaTitulo')}</h2>
                    <p>${t('cultura.promessaTexto', { min: d.anonimatoMinimo })}</p>
                    ${gestor ? html`<p class="bloco-nota">${t('cultura.promessaGestor')}</p>` : ''}
                </div>
            </aside>

            <div class="questionario-progresso" data-progresso-questionario>
                <p id="quest-progresso-rotulo"><span data-respondidas>0</span> / ${total} ${t('cultura.respondidas')}</p>
                <div class="barra barra--fina" role="progressbar" aria-labelledby="quest-progresso-rotulo" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="0" data-barra-questionario><span class="barra-preenchida" data-progresso="0"></span></div>
            </div>

            <form class="questionario" data-form="questionario" novalidate>
                <p class="escala-legenda" aria-hidden="true">${ESCALA.map((v) => html`<span><strong>${v}</strong> ${t(`cultura.escala.${v}`)}</span>`)}</p>
                ${d.dimensoes.map((dm) => {
                    const questoes = d.questoes.filter((q) => q.dimensao === dm.id);
                    if (!questoes.length) return '';
                    return html`<section class="dimensao-bloco" aria-labelledby="dim-${dm.id}">
                        <h2 id="dim-${dm.id}" class="dimensao-titulo">${dm.nome}</h2>
                        ${dm.descricao ? html`<p class="bloco-nota">${dm.descricao}</p>` : ''}
                        ${questoes.map((q) => html`<fieldset class="pergunta" data-pergunta="${q.id}">
                            <legend class="pergunta-texto">${q.texto}${q.extra ? html` <span class="selo selo--marca">${t('cultura.perguntaEmpresa')}</span>` : ''}</legend>
                            <div class="likert">${ESCALA.map((v) => html`<label class="likert-opcao">
                                <input type="radio" name="${q.id}" value="${v}" ${String(rascunho[q.id]) === String(v) ? html`checked` : ''}>
                                <span class="likert-valor">${v}</span><span class="likert-rotulo">${t(`cultura.escala.${v}`)}</span>
                            </label>`)}</div>
                        </fieldset>`)}
                    </section>`;
                })}

                ${d.enps ? html`<section class="dimensao-bloco" aria-labelledby="enps-titulo">
                    <h2 id="enps-titulo" class="dimensao-titulo">${t('cultura.enpsTitulo')}</h2>
                    <fieldset class="pergunta" data-pergunta="enps">
                        <legend class="pergunta-texto">${t('cultura.enpsPergunta')}</legend>
                        <div class="nps">${Array.from({ length: 11 }, (_, v) => html`<label class="nps-opcao">
                            <input type="radio" name="__enps" value="${v}" ${String(rascunho.__enps) === String(v) ? html`checked` : ''}><span>${v}</span>
                        </label>`)}</div>
                        <p class="nps-extremos" aria-hidden="true"><span>${t('cultura.enpsNada')}</span><span>${t('cultura.enpsMuito')}</span></p>
                    </fieldset>
                </section>` : ''}

                ${d.comentarios ? html`<section class="dimensao-bloco" aria-labelledby="comentario-titulo">
                    <h2 id="comentario-titulo" class="dimensao-titulo">${t('cultura.comentarioTitulo')} <span class="rotulo-opcional">(${t('comum.opcional')})</span></h2>
                    <div class="campo">
                        <label for="quest-comentario" class="sr-only">${t('cultura.comentarioTitulo')}</label>
                        <textarea id="quest-comentario" name="__comentario" rows="4" maxlength="600" aria-describedby="comentario-dica">${rascunho.__comentario ?? ''}</textarea>
                        <p id="comentario-dica" class="campo-dica">${t('cultura.comentarioDica')}</p>
                    </div>
                </section>` : ''}

                <p class="campo-erro" data-resumo-erro role="alert" hidden></p>
                <div class="acoes acoes--fim">
                    <button type="submit" class="botao botao--primario botao--g">${icone('send')}${t('cultura.enviarRespostas')}</button>
                </div>
            </form>`,

        montar(raiz) {
            const form = raiz.querySelector('[data-form="questionario"]');
            const contador = raiz.querySelector('[data-respondidas]');
            const barra = raiz.querySelector('[data-barra-questionario]');
            const nomes = [...d.questoes.map((q) => q.id), ...(d.enps ? ['__enps'] : [])];
            const atualizar = () => {
                const valores = Object.fromEntries(new FormData(form));
                const feitas = nomes.filter((n) => valores[n] !== undefined).length;
                contador.textContent = String(feitas);
                barra.setAttribute('aria-valuenow', String(feitas));
                barra.querySelector('.barra-preenchida').style.setProperty('--progresso', `${Math.round((feitas / nomes.length) * 100)}%`);
                form.querySelectorAll('[data-pergunta]').forEach((f) => {
                    const nome = f.dataset.pergunta === 'enps' ? '__enps' : f.dataset.pergunta;
                    f.classList.toggle('pergunta--feita', valores[nome] !== undefined);
                });
                guardarRascunho(id, valores);
            };
            form.addEventListener('change', atualizar);
            form.addEventListener('input', (evento) => { if (evento.target.name === '__comentario') atualizar(); });
            atualizar();

            form.addEventListener('submit', async (evento) => {
                evento.preventDefault();
                const valores = Object.fromEntries(new FormData(form));
                const faltando = nomes.find((n) => valores[n] === undefined);
                const resumo = form.querySelector('[data-resumo-erro]');
                form.querySelectorAll('.pergunta--faltando').forEach((f) => f.classList.remove('pergunta--faltando'));
                if (faltando) {
                    const restantes = nomes.filter((n) => valores[n] === undefined);
                    restantes.forEach((n) => form.querySelector(`[data-pergunta="${n === '__enps' ? 'enps' : n}"]`)?.classList.add('pergunta--faltando'));
                    resumo.textContent = t('cultura.faltam', { n: restantes.length });
                    resumo.hidden = false;
                    form.querySelector(`[name="${faltando}"]`)?.focus();
                    return;
                }
                resumo.hidden = true;
                const botao = form.querySelector('[type="submit"]');
                botao.disabled = true;
                try {
                    const respostas = Object.fromEntries(d.questoes.map((q) => [q.id, valores[q.id]]));
                    const pontos = await dados.responderDiagnostico(id, { respostas, enps: d.enps ? valores.__enps : null, comentario: valores.__comentario ?? '' });
                    try { sessionStorage.removeItem(chaveRascunho(id)); } catch { /* sem armazenamento */ }
                    irPara('cultura');
                    celebrar({ titulo: t('cultura.obrigadoTitulo'), texto: t('cultura.obrigadoTexto'), pontos });
                } catch (erro) {
                    botao.disabled = false;
                    mostrarErro(erro, form);
                }
            });
        },
    };
}

// ------------------------------------------------------------ resultado --

function blocoOculto(d, r) {
    const taxa = r.elegiveis ? r.respondentes / r.elegiveis : 0;
    return html`<section class="painel-bloco vazio-destaque" aria-labelledby="oculto-titulo">
        ${icone('lock')}
        <h2 id="oculto-titulo" class="bloco-titulo">${t('cultura.ocultoTitulo')}</h2>
        <p class="bloco-nota">${t('cultura.ocultoTexto', { n: r.respondentes, min: r.anonimatoMinimo })}</p>
        <div class="oculto-adesao">
            <p id="oculto-adesao">${t('cultura.adesao', { n: r.respondentes, total: r.elegiveis })} · ${formatarPercentual(taxa)}</p>
            <div class="barra" role="progressbar" aria-labelledby="oculto-adesao" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(taxa * 100)}"><span class="barra-preenchida" data-progresso="${Math.round(taxa * 100)}"></span></div>
        </div>
        ${d.aberto ? html`<p class="bloco-nota">${t('cultura.ocultoDica')}</p>` : ''}
    </section>`;
}

function tabelaDimensoes(d, r) {
    const anteriores = (r.historico ?? []).filter((h) => h.id !== d.id);
    const anterior = anteriores[anteriores.length - 1];
    const temGap = (r.dimensoes ?? []).some((x) => x.lideranca !== null && x.lideranca !== undefined);
    return html`
        ${temGap ? legendaHalteres() : ''}
        <div class="tabela-rolagem" tabindex="0" role="region" aria-labelledby="res-dimensoes">
            <table class="tabela tabela--cartoes tabela--dimensoes">
                <thead><tr>
                    <th scope="col">${t('cultura.dimensao')}</th>
                    <th scope="col">${t('cultura.nota')} · ${d.interpretacao === 'risco' ? t('cultura.risco') : t('cultura.nivel')}</th>
                    ${temGap ? html`<th scope="col">${t('cultura.liderancaEquipe')}</th><th scope="col" class="num">${t('cultura.gap')}</th>` : ''}
                </tr></thead>
                <tbody>${(r.dimensoes ?? []).map((x) => {
                    const nome = nomeDimensao(d, x.id);
                    const gap = temGap && x.lideranca !== null && x.equipe !== null ? x.lideranca - x.equipe : null;
                    const antes = anterior?.dimensoes?.find((y) => y.id === x.id)?.score ?? null;
                    return html`<tr>
                        <th scope="row">${nome}</th>
                        <td data-rotulo="${t('cultura.nota')}"><span class="nota-com-nivel">${barraNota(x.score, nome)}<span class="nota-com-nivel-linha">${seloLeitura(x.score, d)}${anterior ? variacao(x.score, antes) : ''}</span></span></td>
                        ${temGap ? html`<td data-rotulo="${t('cultura.liderancaEquipe')}">${halteres(x.lideranca, x.equipe)}</td>
                            <td class="num" data-rotulo="${t('cultura.gap')}">${gap === null ? t('comum.semValor') : html`<span class="gap">${gap > 0 ? '+' : ''}${gap}${Math.abs(gap) >= GAP_PONTO_CEGO ? html`<span class="selo selo--aviso-p" data-dica="${t('cultura.pontoCegoDica')}">${t('cultura.pontoCego')}</span>` : ''}</span>`}</td>` : ''}
                    </tr>`;
                })}</tbody>
            </table>
        </div>`;
}

function blocoPerguntas(d, r) {
    const ordem = [...(r.dimensoes ?? [])].sort((a, b) => (a.score ?? 101) - (b.score ?? 101));
    return html`${legendaFavorabilidade()}
        <div class="perguntas-dimensoes">${ordem.map((x, i) => {
            const questoes = d.questoes.filter((q) => q.dimensao === x.id);
            return html`<details class="perguntas-grupo" ${i === 0 ? html`open` : ''}>
                <summary><span class="perguntas-grupo-nome">${nomeDimensao(d, x.id)}</span><span class="perguntas-grupo-nota">${x.score ?? '—'}</span>${icone('descer', 'icone icone--p recolhivel-seta')}</summary>
                <ul class="perguntas-lista" role="list">${questoes.map((q) => {
                    const s = r.questoes?.find((y) => y.id === q.id);
                    return html`<li class="pergunta-resultado">
                        <p class="pergunta-resultado-texto">${q.texto}${q.extra ? html` <span class="selo selo--marca">${t('cultura.perguntaEmpresa')}</span>` : ''}${q.invertida ? html` <span class="selo selo--neutro" data-dica="${t('cultura.invertidaDica')}">${t('cultura.invertida')}</span>` : ''}</p>
                        ${s ? barraFavorabilidade(s) : html`<span class="grafico-vazio">${t('comum.semValor')}</span>`}
                    </li>`;
                })}</ul>
            </details>`;
        })}</div>`;
}

function blocoPlano(usuario, d, r, cursos) {
    const fracas = [...(r.dimensoes ?? [])].filter((x) => x.score !== null).sort((a, b) => a.score - b.score).slice(0, 3);
    if (!fracas.length) return '';
    const equipe = ehEquipe(usuario.perfil);
    return html`<section class="painel-bloco" aria-labelledby="plano-titulo">
        <div class="bloco-cabecalho">
            <h2 id="plano-titulo" class="bloco-titulo">${t('cultura.planoTitulo')}</h2>
            <p class="bloco-nota">${t('cultura.planoNota')}</p>
        </div>
        <ol class="plano" role="list">${fracas.map((x, i) => {
            const dm = d.dimensoes.find((y) => y.id === x.id) ?? { nome: x.id };
            const recomendados = (dm.cursos ?? []).map((id) => cursos.find((c) => c.id === id)).filter(Boolean);
            return html`<li class="plano-item">
                <span class="plano-numero" aria-hidden="true">${i + 1}</span>
                <div class="plano-corpo">
                    <p class="plano-titulo">${dm.nome} <span class="plano-nota">${x.score}</span></p>
                    ${dm.recomendacao ? html`<p class="plano-texto">${dm.recomendacao}</p>` : ''}
                    <div class="oportunidade-acoes">
                        ${recomendados.map((c) => (c.empresas?.includes(d.empresaId)
                            ? html`<a class="selo selo--sucesso" href="#/cursos/${c.id}">${icone('book', 'icone icone--p')}${c.titulo}</a>`
                            : equipe
                                ? html`<button type="button" class="botao botao--secundario botao--p" data-liberar="${c.id}" data-empresa="${d.empresaId}" data-nomes="${c.titulo}|${d.empresaNome}">${icone('send', 'icone icone--p')}${t('cultura.liberarCurso', { curso: c.titulo })}</button>`
                                : html`<span class="selo selo--neutro">${icone('book', 'icone icone--p')}${c.titulo} · ${t('cultura.pecaConsultoria')}</span>`))}
                        <a class="botao botao--fantasma botao--p" href="#/kaizen/novo?empresa=${d.empresaId}&dimensao=${encodeURIComponent(dm.nome)}">${icone('lampada', 'icone icone--p')}${t('cultura.abrirKaizen')}</a>
                    </div>
                </div>
            </li>`;
        })}</ol>
    </section>`;
}

async function telaResultado(usuario, id, recarregar) {
    const d = await dados.obterDiagnostico(id);
    let r;
    try {
        r = await dados.resultadoDiagnostico(id);
    } catch (erro) {
        if (!(erro instanceof dados.ErroDados) || erro.codigo !== 'proibido') throw erro;
        r = null;
    }
    // Cursos para o plano de ação: a equipe vê o catálogo; o gestor, só o que já é da empresa.
    const cursos = r?.completo ? (ehEquipe(usuario.perfil) ? await dados.listarCursosResumo() : (await dados.listarCursos(usuario)).map((c) => ({ ...c, empresas: c.empresas ?? [d.empresaId] }))) : [];
    const voltar = ehEquipe(usuario.perfil) ? '#/cultura/diagnosticos' : '#/cultura';

    const acoesGestao = d.possoGerir ? html`
        ${d.aberto ? html`<button type="button" class="botao botao--secundario" data-gerir="encerrar">${t('cultura.encerrar')}</button>`
            : html`<button type="button" class="botao botao--secundario" data-gerir="reabrir">${t('cultura.reabrir')}</button>`}
        ${r && r.respondentes === 0 ? html`<button type="button" class="botao botao--fantasma" data-gerir="excluir">${icone('lixo', 'icone icone--p')}${t('cultura.excluir')}</button>` : ''}
        ${r && !r.oculto ? html`<button type="button" class="botao botao--secundario" data-gerir="csv">${icone('download', 'icone icone--p')}${t('relatorios.exportar')}</button>
            <button type="button" class="botao botao--secundario" data-gerir="imprimir">${icone('print', 'icone icone--p')}${t('cultura.imprimir')}</button>` : ''}` : '';

    const cabecalhoResultado = html`
        <a class="voltar sem-impressao" href="${voltar}">${icone('back', 'icone icone--p')}${t('cultura.titulo')}</a>
        <header class="cabecalho cabecalho--acoes">
            <div>
                <p class="sobretitulo">${d.empresaNome}</p>
                <h1 class="titulo" tabindex="-1">${d.titulo}</h1>
                <p class="diagnostico-meta">${situacaoDiagnostico(d)}<span>${t('cultura.lancadoEm', { data: formatarData(d.criadoEm, { dateStyle: 'medium' }) })}</span><span>${t(`cultura.publicos.${d.publico}`)}</span></p>
            </div>
            <div class="acoes sem-impressao">
                ${d.possoResponder ? html`<a class="botao botao--primario" href="#/cultura/${d.id}/responder">${t('cultura.responder')}</a>` : ''}
                ${acoesGestao}
            </div>
        </header>
        ${d.norma ? html`<p class="norma">${icone('escudo', 'icone icone--p')}${d.norma}</p>` : ''}`;

    if (!r) {
        return {
            titulo: d.titulo,
            conteudo: html`${cabecalhoResultado}<p class="nota">${icone('lock', 'icone icone--p')}${t('cultura.devolutivaDepois')}</p>`,
            montar: (raiz) => ligarGestao(raiz, d, null, recarregar),
        };
    }

    const dims = (r.dimensoes ?? []).filter((x) => x.score !== null).sort((a, b) => b.score - a.score);
    const forte = dims[0];
    const fraca = dims[dims.length - 1];
    const historico = (r.historico ?? []).map((h) => ({ rotulo: formatarData(h.criadoEm, { month: 'short', year: '2-digit' }), valor: h.geral }));
    const anterior = (r.historico ?? []).filter((h) => h.id !== d.id).pop();
    const emRiscoAlto = d.interpretacao === 'risco' ? dims.filter((x) => faixaRisco(x.score) === 'alto').length : null;
    const zona = r.enps ? zonaEnps(r.enps.score) : null;

    const conteudo = r.oculto ? html`${cabecalhoResultado}${blocoOculto(d, r)}` : html`
        ${cabecalhoResultado}
        <section aria-labelledby="res-resumo">
            <h2 id="res-resumo" class="sr-only">${t('painel.resumo')}</h2>
            <dl class="indicadores">
                ${indicador(d.interpretacao === 'risco' ? t('cultura.indiceFavoravel') : t('cultura.indiceGeral'), html`${r.geral}<small class="indicador-sufixo">${leitura(r.geral, d).texto}</small>`, true)}
                ${indicador(t('cultura.participacao'), html`${formatarPercentual(r.elegiveis ? r.respondentes / r.elegiveis : 0)}<small class="indicador-sufixo">${t('cultura.adesao', { n: r.respondentes, total: r.elegiveis })}</small>`)}
                ${r.enps ? indicador(t('cultura.enps'), html`${r.enps.score > 0 ? '+' : ''}${r.enps.score}<small class="indicador-sufixo">${t(`cultura.zonas.${zona}`)}</small>`) : ''}
                ${emRiscoAlto !== null ? indicador(t('cultura.dimensoesRiscoAlto'), formatarNumero(emRiscoAlto))
                    : anterior?.geral !== undefined && anterior?.geral !== null ? indicador(t('cultura.vsAnterior'), html`${variacao(r.geral, anterior.geral)}<small class="indicador-sufixo">${t('cultura.antes', { n: anterior.geral })}</small>`) : ''}
            </dl>
        </section>
        ${forte && fraca && forte !== fraca ? html`<div class="destaques-dimensao">
            <p class="destaque-dimensao destaque-dimensao--forte">${icone('star', 'icone icone--p')}<span>${t('cultura.forte')}</span><strong>${nomeDimensao(d, forte.id)}</strong><span class="destaque-dimensao-nota">${forte.score}</span></p>
            <p class="destaque-dimensao destaque-dimensao--fraca">${icone('target', 'icone icone--p')}<span>${t('cultura.oportunidade')}</span><strong>${nomeDimensao(d, fraca.id)}</strong><span class="destaque-dimensao-nota">${fraca.score}</span></p>
        </div>` : ''}
        <div class="painel-grade">
            <div class="painel-coluna">
                <section class="painel-bloco" aria-labelledby="res-dimensoes">
                    <div class="bloco-cabecalho">
                        <h2 id="res-dimensoes" class="bloco-titulo">${t('cultura.porDimensao')}</h2>
                        <p class="bloco-nota">${d.interpretacao === 'risco' ? t('cultura.porDimensaoRisco') : t('cultura.porDimensaoNota')}</p>
                    </div>
                    ${tabelaDimensoes(d, r)}
                </section>
                ${r.completo ? html`<section class="painel-bloco" aria-labelledby="res-perguntas">
                    <div class="bloco-cabecalho">
                        <h2 id="res-perguntas" class="bloco-titulo">${t('cultura.perguntaAPergunta')}</h2>
                        <p class="bloco-nota">${t('cultura.perguntaAPerguntaNota')}</p>
                    </div>
                    ${blocoPerguntas(d, r)}
                </section>` : ''}
                ${r.completo && r.comentarios?.length ? html`<section class="painel-bloco" aria-labelledby="res-comentarios">
                    <div class="bloco-cabecalho">
                        <h2 id="res-comentarios" class="bloco-titulo">${t('cultura.comentarios', { n: r.comentarios.length })}</h2>
                        <p class="bloco-nota">${t('cultura.comentariosNota')}</p>
                    </div>
                    <ul class="comentarios" role="list">${r.comentarios.map((c) => html`<li class="comentario">${icone('conversa', 'icone icone--p')}<p>${c}</p></li>`)}</ul>
                </section>` : ''}
            </div>
            <div class="painel-coluna painel-coluna--lateral">
                ${r.completo ? blocoPlano(usuario, d, r, cursos) : html`<section class="painel-bloco"><h2 class="bloco-titulo">${t('cultura.obrigadoDevolutiva')}</h2><p class="bloco-nota">${t('cultura.devolutivaTexto')}</p></section>`}
                ${r.enps ? html`<section class="painel-bloco" aria-labelledby="res-enps">
                    <h2 id="res-enps" class="bloco-titulo">${t('cultura.enps')}</h2>
                    <p class="enps-numero">${r.enps.score > 0 ? '+' : ''}${r.enps.score}<span>${t(`cultura.zonas.${zona}`)}</span></p>
                    ${barraEnps(r.enps)}
                    <dl class="enps-detalhe">
                        <div><dt><span class="legenda-amostra fav-seg--fav"></span>${t('cultura.promotores')}</dt><dd>${r.enps.promotores}</dd></div>
                        <div><dt><span class="legenda-amostra fav-seg--neutro"></span>${t('cultura.neutros')}</dt><dd>${r.enps.neutros}</dd></div>
                        <div><dt><span class="legenda-amostra fav-seg--desf"></span>${t('cultura.detratores')}</dt><dd>${r.enps.detratores}</dd></div>
                    </dl>
                    <p class="bloco-nota">${t('cultura.enpsNota')}</p>
                </section>` : ''}
                ${historico.length > 1 ? html`<section class="painel-bloco" aria-labelledby="res-evolucao">
                    <h2 id="res-evolucao" class="bloco-titulo">${t('cultura.evolucao')}</h2>
                    ${linhaEvolucao(historico)}
                    <ol class="evolucao-lista" role="list">${(r.historico ?? []).map((h) => html`<li><span>${formatarData(h.criadoEm, { dateStyle: 'medium' })}</span><strong>${h.geral ?? '—'}</strong></li>`)}</ol>
                </section>` : ''}
                ${r.completo && r.areas?.length ? html`<section class="painel-bloco" aria-labelledby="res-areas">
                    <h2 id="res-areas" class="bloco-titulo">${t('cultura.porArea')}</h2>
                    <p class="bloco-nota">${t('cultura.porAreaNota', { min: r.anonimatoMinimo })}</p>
                    <ul class="barras-lista" role="list">${[...r.areas].sort((a, b) => b.score - a.score).map((a) => html`<li><span class="barras-rotulo">${a.area}<span class="linha-sub">${t('cultura.respostasN', { n: a.respondentes })}</span></span>${barraNota(a.score, a.area)}</li>`)}</ul>
                </section>` : ''}
            </div>
        </div>
        <p class="nota nota--anonimato">${icone('lock', 'icone icone--p')}${t('cultura.privacidadeRodape', { min: r.anonimatoMinimo })}</p>`;

    return {
        titulo: d.titulo,
        conteudo,
        montar(raiz) {
            ligarGestao(raiz, d, r, recarregar);
            ligarLiberarCurso(raiz, recarregar);
        },
    };
}

function ligarGestao(raiz, d, r, recarregar) {
    raiz.addEventListener('click', async (evento) => {
        const botao = evento.target.closest('[data-gerir]');
        if (!botao) return;
        try {
            switch (botao.dataset.gerir) {
                case 'encerrar': {
                    const ok = await perguntar({ titulo: t('cultura.encerrarTitulo'), texto: t('cultura.encerrarTexto'), confirmar: t('cultura.encerrar') });
                    if (!ok) return;
                    await dados.encerrarDiagnostico(d.id);
                    anunciar(t('cultura.encerrado'));
                    break;
                }
                case 'reabrir': {
                    const ok = await perguntar({ titulo: t('cultura.reabrirTitulo'), texto: t('cultura.reabrirTexto'), confirmar: t('cultura.reabrir') });
                    if (!ok) return;
                    await dados.reabrirDiagnostico(d.id);
                    anunciar(t('cultura.reaberto'));
                    break;
                }
                case 'excluir': {
                    const ok = await perguntar({ titulo: t('cultura.excluirTitulo'), texto: t('cultura.excluirTexto'), confirmar: t('cultura.excluir'), perigo: true });
                    if (!ok) return;
                    await dados.excluirDiagnostico(d.id);
                    anunciar(t('cultura.excluido'));
                    irPara('cultura');
                    return;
                }
                case 'csv':
                    exportarCsv(d, r);
                    return;
                case 'imprimir':
                    window.print();
                    return;
                default:
                    return;
            }
            await recarregar();
        } catch (erro) {
            mostrarErro(erro);
        }
    });
}

function exportarCsv(d, r) {
    const linhas = [[t('cultura.dimensao'), t('cultura.pergunta'), t('cultura.nota'), t('cultura.favoravel'), t('cultura.neutro'), t('cultura.desfavoravel'), t('cultura.lideranca'), t('cultura.equipe')]];
    (r.dimensoes ?? []).forEach((x) => {
        const nome = nomeDimensao(d, x.id);
        linhas.push([nome, '', x.score ?? '', '', '', '', x.lideranca ?? '', x.equipe ?? '']);
        d.questoes.filter((q) => q.dimensao === x.id).forEach((q) => {
            const s = r.questoes?.find((y) => y.id === q.id);
            linhas.push([nome, q.texto, s?.score ?? '', s ? `${s.favoravel}%` : '', s ? `${s.neutro}%` : '', s ? `${s.desfavoravel}%` : '', '', '']);
        });
    });
    linhas.push([], [t('cultura.indiceGeral'), '', r.geral], [t('cultura.participacao'), '', `${r.respondentes}/${r.elegiveis}`]);
    if (r.enps) linhas.push([t('cultura.enps'), '', r.enps.score]);
    baixarCsv(`diagnostico-${d.empresaNome}-${d.criadoEm.slice(0, 10)}.csv`.replace(/[^\w.-]+/g, '-').toLowerCase(), linhas);
    anunciar(t('relatorios.exportado'));
}

// ---------------------------------------------------------------- rotas --

export async function tela({ usuario, parametros, consulta, recarregar }) {
    const [a, b] = parametros;
    if (a === 'modelos') {
        if (!pode(usuario, 'gerir-modelos')) throw new dados.ErroDados('proibido');
        const modelos = await import('./cultura-modelos.js');
        return b ? modelos.editor(b === 'novo' ? null : b) : modelos.lista();
    }
    if (a === 'novo') return telaNovo(usuario, consulta);
    if (a === 'diagnosticos') return telaDiagnosticos(usuario, consulta);
    if (a && b === 'responder') return telaResponder(usuario, a);
    if (a) return telaResultado(usuario, a, recarregar);
    return pode(usuario, 'ver-panorama') ? telaPanorama(usuario, consulta) : telaDiagnosticos(usuario, consulta);
}

export { abas };
