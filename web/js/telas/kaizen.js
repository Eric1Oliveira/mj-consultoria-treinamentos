// Kaizen: projetos de melhoria no formato A3, conduzidos pelo ciclo PDCA.
//
// Rotas: #/kaizen (quadro) · #/kaizen/novo · #/kaizen/:id · #/kaizen/:id/editar

import * as dados from '../dados.js';
import { ehEquipe, ETAPAS_KAIZEN, codigoKaizen, podeEditarKaizen, primeiroNome } from '../regras.js';
import { t, formatarNumero, formatarData, formatarRelativo } from '../textos.js';
import { html, icone, opcao, avatar, anunciar, irPara, mostrarErro, desenharEm, perguntar, celebrar, indicador } from '../app.js';

const filtro = { busca: '', area: '', meus: false, arquivados: false };

const moeda = (valor) => formatarNumero(valor, { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const hojeIso = () => new Date().toLocaleDateString('sv-SE');
const dataCurta = (iso) => formatarData(`${iso}T12:00:00`, { day: 'numeric', month: 'short' });

function envolve(k, id) {
    return [k.autorId, k.responsavelId, ...k.membros].includes(id);
}

// ---------------------------------------------------------------- quadro --

function cartaoKaizen(usuario, k, equipe) {
    const atrasado = k.prazo && k.prazo < hojeIso() && !['concluido', 'arquivado'].includes(k.etapa);
    const arrastavel = podeEditarKaizen(usuario, k) && k.etapa !== 'arquivado';
    return html`<li class="kz-cartao ${k.destaque ? 'kz-cartao--destaque' : ''}" data-kaizen="${k.id}" ${arrastavel ? html`draggable="true"` : ''}>
        <p class="kz-cartao-topo">
            <span class="kz-codigo">${codigoKaizen(k.numero)}</span>
            ${k.destaque ? html`<span class="kz-estrela" data-dica="${t('kaizen.destaqueDica')}">${icone('star', 'icone icone--p')}<span class="sr-only">${t('kaizen.destaque')}</span></span>` : ''}
            ${equipe ? html`<span class="kz-empresa">${k.empresaNome}</span>` : ''}
        </p>
        <a class="kz-cartao-titulo" href="#/kaizen/${k.id}">${k.titulo}</a>
        ${k.dimensao || k.area ? html`<p class="kz-etiquetas">${k.dimensao ? html`<span class="etiqueta">${icone('bussola', 'icone icone--p')}${k.dimensao}</span>` : ''}${k.area ? html`<span class="etiqueta">${k.area}</span>` : ''}</p>` : ''}
        <p class="kz-cartao-rodape">
            ${k.responsavelNome ? html`<span class="kz-pessoa" data-dica="${t('kaizen.responsavel')}: ${k.responsavelNome}">${avatar(k.responsavelNome)}<span>${primeiroNome(k.responsavelNome)}</span></span>` : html`<span class="kz-pessoa kz-pessoa--vazia">${t('kaizen.semResponsavel')}</span>`}
            ${k.prazo ? html`<span class="kz-meta ${atrasado ? 'kz-meta--atrasado' : ''}">${icone('clock', 'icone icone--p')}${dataCurta(k.prazo)}${atrasado ? html`<span class="sr-only"> (${t('kaizen.atrasado')})</span>` : ''}</span>` : ''}
            ${k.economia ? html`<span class="kz-meta">${icone('moeda', 'icone icone--p')}${moeda(k.economia)}</span>` : ''}
            ${k.comentarios ? html`<span class="kz-meta">${icone('conversa', 'icone icone--p')}${k.comentarios}<span class="sr-only"> ${t('kaizen.comentariosN')}</span></span>` : ''}
        </p>
    </li>`;
}

function filtrar(usuario, kaizens) {
    const termo = filtro.busca.trim().toLowerCase();
    return kaizens
        .filter((k) => !termo || `${codigoKaizen(k.numero)} ${k.titulo} ${k.problema} ${k.responsavelNome ?? ''}`.toLowerCase().includes(termo))
        .filter((k) => !filtro.area || k.area === filtro.area)
        .filter((k) => !filtro.meus || envolve(k, usuario.id));
}

function colunas(usuario, kaizens, equipe) {
    const visiveis = filtrar(usuario, kaizens);
    const arquivados = visiveis.filter((k) => k.etapa === 'arquivado');
    return html`<div class="kz-quadro" role="list" aria-label="${t('kaizen.quadro')}">
        ${ETAPAS_KAIZEN.map((etapa) => {
            const daEtapa = visiveis.filter((k) => k.etapa === etapa);
            return html`<section class="kz-coluna kz-coluna--${etapa}" role="listitem" data-etapa="${etapa}" aria-labelledby="kz-col-${etapa}">
                <header class="kz-coluna-topo">
                    <h2 id="kz-col-${etapa}" class="kz-coluna-titulo"><span class="kz-pdca" aria-hidden="true">${t(`kaizen.pdca.${etapa}`)}</span>${t(`kaizen.etapas.${etapa}`)}</h2>
                    <span class="kz-coluna-total">${daEtapa.length}</span>
                </header>
                <p class="kz-coluna-dica">${t(`kaizen.etapasDica.${etapa}`)}</p>
                <ul class="kz-lista" role="list">${daEtapa.map((k) => cartaoKaizen(usuario, k, equipe))}</ul>
            </section>`;
        })}
    </div>
    ${filtro.arquivados && arquivados.length ? html`<section class="painel-bloco painel-bloco--sutil kz-arquivados" aria-labelledby="kz-arquivados">
        <h2 id="kz-arquivados" class="bloco-titulo">${t('kaizen.etapas.arquivado')} (${arquivados.length})</h2>
        <ul class="kz-lista kz-lista--linha" role="list">${arquivados.map((k) => cartaoKaizen(usuario, k, equipe))}</ul>
    </section>` : ''}`;
}

async function telaQuadro(usuario, consulta, recarregar) {
    const equipe = ehEquipe(usuario.perfil);
    const empresaId = equipe ? consulta.get('empresa') ?? '' : '';
    const [kaizens, empresas] = await Promise.all([
        dados.listarKaizens({ empresaId }),
        equipe ? dados.listarEmpresas(usuario) : [],
    ]);
    const ativos = kaizens.filter((k) => k.etapa !== 'arquivado');
    const concluidos = ativos.filter((k) => k.etapa === 'concluido');
    const envolvidos = new Set(ativos.flatMap((k) => [k.autorId, k.responsavelId, ...k.membros]).filter(Boolean));
    const areas = [...new Set(kaizens.map((k) => k.area).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const destaques = equipe ? kaizens.filter((k) => k.destaque).slice(0, 4) : [];

    return {
        titulo: t('kaizen.titulo'),
        conteudo: html`
            <header class="cabecalho cabecalho--acoes">
                <div>
                    <h1 class="titulo" tabindex="-1">${t('kaizen.titulo')}</h1>
                    <p class="subtitulo">${equipe ? t('kaizen.subEquipe') : t('kaizen.sub')}</p>
                </div>
                <a class="botao botao--primario" href="#/kaizen/novo${empresaId ? `?empresa=${empresaId}` : ''}">${icone('lampada')}${t('kaizen.novo')}</a>
            </header>
            <section aria-labelledby="kz-resumo">
                <h2 id="kz-resumo" class="sr-only">${t('painel.resumo')}</h2>
                <dl class="indicadores">
                    ${indicador(t('kaizen.emAndamento'), formatarNumero(ativos.length - concluidos.length), true)}
                    ${indicador(t('kaizen.concluidos'), formatarNumero(concluidos.length))}
                    ${indicador(t('kaizen.ganhoAno'), moeda(concluidos.reduce((s, k) => s + k.economia, 0)))}
                    ${indicador(t('kaizen.horasMes'), formatarNumero(concluidos.reduce((s, k) => s + k.horas, 0), { maximumFractionDigits: 1 }))}
                    ${indicador(t('kaizen.pessoasEnvolvidas'), formatarNumero(envolvidos.size))}
                </dl>
            </section>
            <form class="filtros" data-form="filtro" role="search">
                ${equipe ? html`<div class="campo">
                    <label for="kz-empresa">${t('comum.empresa')}</label>
                    <select id="kz-empresa" name="empresa">
                        ${opcao('', t('relatorios.todasEmpresas'), !empresaId)}
                        ${empresas.map((e) => opcao(e.id, e.nome, e.id === empresaId))}
                    </select>
                </div>` : ''}
                <div class="campo campo--cresce">
                    <label for="kz-busca">${t('kaizen.buscaRotulo')}</label>
                    <input id="kz-busca" name="busca" type="search" value="${filtro.busca}" autocomplete="off">
                </div>
                ${areas.length ? html`<div class="campo">
                    <label for="kz-area">${t('pessoas.area')}</label>
                    <select id="kz-area" name="area">${opcao('', t('comum.todas'), !filtro.area)}${areas.map((a) => opcao(a, a, a === filtro.area))}</select>
                </div>` : ''}
                ${equipe ? '' : html`<label class="campo-check campo-check--alinhado"><input type="checkbox" name="meus" ${filtro.meus ? html`checked` : ''}><span>${t('kaizen.soMeus')}</span></label>`}
                <label class="campo-check campo-check--alinhado"><input type="checkbox" name="arquivados" ${filtro.arquivados ? html`checked` : ''}><span>${t('kaizen.verArquivados')}</span></label>
            </form>
            ${kaizens.length ? html`<p class="bloco-nota kz-dica-arrastar">${icone('ciclo', 'icone icone--p')}${t('kaizen.dicaArrastar')}</p>
                <div data-quadro>${colunas(usuario, kaizens, equipe)}</div>` : html`<section class="painel-bloco vazio-destaque">
                ${icone('lampada')}
                <h2 class="bloco-titulo">${t('kaizen.vazioTitulo')}</h2>
                <p class="bloco-nota">${t('kaizen.vazioTexto')}</p>
                <a class="botao botao--primario" href="#/kaizen/novo">${t('kaizen.novo')}</a>
            </section>`}
            ${destaques.length ? html`<section class="painel-bloco" aria-labelledby="kz-destaques">
                <div class="bloco-cabecalho">
                    <h2 id="kz-destaques" class="bloco-titulo">${t('kaizen.destaquesTitulo')}</h2>
                    <p class="bloco-nota">${t('kaizen.destaquesNota')}</p>
                </div>
                <ul class="linhas" role="list">${destaques.map((k) => html`<li class="linha">
                    <span class="medalha" aria-hidden="true">${icone('star')}</span>
                    <span class="linha-principal"><a class="linha-link" href="#/kaizen/${k.id}">${codigoKaizen(k.numero)} · ${k.titulo}</a><span class="linha-sub">${k.empresaNome}${k.dimensao ? ` · ${k.dimensao}` : ''}</span></span>
                    ${k.economia ? html`<span class="linha-meta linha-meta--num">${moeda(k.economia)}</span>` : ''}
                </li>`)}</ul>
            </section>` : ''}`,

        montar(raiz) {
            const form = raiz.querySelector('[data-form="filtro"]');
            const quadro = raiz.querySelector('[data-quadro]');
            form.addEventListener('submit', (evento) => evento.preventDefault());
            form.addEventListener('input', (evento) => {
                if (evento.target.name === 'empresa') {
                    window.location.hash = `#/kaizen${form.empresa.value ? `?empresa=${form.empresa.value}` : ''}`;
                    return;
                }
                filtro.busca = form.busca.value;
                filtro.area = form.area?.value ?? '';
                filtro.meus = Boolean(form.meus?.checked);
                filtro.arquivados = form.arquivados.checked;
                if (quadro) desenharEm(quadro, colunas(usuario, kaizens, equipe));
            });
            if (quadro) ligarArrastar(quadro, kaizens, recarregar);
        },
    };
}

/** Arrastar o cartão para outra coluna muda a etapa (o servidor confere a permissão). */
function ligarArrastar(quadro, kaizens, recarregar) {
    let arrastando = null;
    quadro.addEventListener('dragstart', (evento) => {
        const cartao = evento.target.closest('[data-kaizen][draggable="true"]');
        if (!cartao) return;
        arrastando = kaizens.find((k) => k.id === cartao.dataset.kaizen);
        evento.dataTransfer.effectAllowed = 'move';
        evento.dataTransfer.setData('text/plain', cartao.dataset.kaizen);
        cartao.classList.add('kz-cartao--arrastando');
        quadro.classList.add('kz-quadro--arrastando');
    });
    quadro.addEventListener('dragend', () => {
        arrastando = null;
        quadro.classList.remove('kz-quadro--arrastando');
        quadro.querySelectorAll('.kz-cartao--arrastando, .kz-coluna--alvo').forEach((el) => el.classList.remove('kz-cartao--arrastando', 'kz-coluna--alvo'));
    });
    quadro.addEventListener('dragover', (evento) => {
        const coluna = evento.target.closest('[data-etapa]');
        if (!arrastando || !coluna || coluna.dataset.etapa === arrastando.etapa) return;
        evento.preventDefault();
        quadro.querySelectorAll('.kz-coluna--alvo').forEach((el) => el !== coluna && el.classList.remove('kz-coluna--alvo'));
        coluna.classList.add('kz-coluna--alvo');
    });
    quadro.addEventListener('drop', async (evento) => {
        const coluna = evento.target.closest('[data-etapa]');
        if (!arrastando || !coluna) return;
        evento.preventDefault();
        const k = arrastando;
        try {
            const salvo = await dados.moverKaizen(k.id, coluna.dataset.etapa);
            anunciar(t('kaizen.movido', { codigo: codigoKaizen(k.numero), etapa: t(`kaizen.etapas.${salvo.etapa}`) }));
            await recarregar();
            if (salvo.etapa === 'concluido') {
                celebrar({ titulo: t('kaizen.concluidoTitulo'), texto: t('kaizen.concluidoTexto', { titulo: k.titulo }), pontos: salvo.pontosGanhos });
            }
        } catch (erro) {
            mostrarErro(erro);
        }
    });
}

// --------------------------------------------------------------- detalhe --

function secaoA3(titulo, conteudo, dica = '') {
    return html`<section class="a3-secao">
        <h3 class="a3-titulo">${titulo}</h3>
        ${conteudo ? html`<div class="a3-texto">${String(conteudo).split(/\n+/).map((p) => html`<p>${p}</p>`)}</div>` : html`<p class="a3-vazio">${dica || t('kaizen.aPreencher')}</p>`}
    </section>`;
}

const ICONE_EVENTO = { criado: 'lampada', etapa: 'ciclo', comentario: 'conversa', parecer: 'escudo' };

function linhaDoTempo(k) {
    return html`<ol class="linha-tempo" role="list">${k.eventos.map((e) => html`<li class="evento evento--${e.tipo}">
        <span class="evento-icone" aria-hidden="true">${icone(ICONE_EVENTO[e.tipo] ?? 'arrow', 'icone icone--p')}</span>
        <div class="evento-corpo">
            <p class="evento-frase">${e.tipo === 'etapa' ? t('kaizen.eventoEtapa', { nome: e.autorNome ?? t('atividade.alguem'), etapa: t(`kaizen.etapas.${e.texto}`) })
                : e.tipo === 'criado' ? t('kaizen.eventoCriado', { nome: e.autorNome ?? t('atividade.alguem') })
                    : html`<strong>${e.autorNome ?? t('atividade.alguem')}</strong>${e.tipo === 'parecer' ? html` <span class="selo selo--marca">${t('kaizen.parecerConsultoria')}</span>` : ''}`}</p>
            ${['comentario', 'parecer'].includes(e.tipo) ? html`<p class="evento-texto">${e.texto}</p>` : ''}
            <p class="atividade-meta"><time datetime="${e.em}">${formatarRelativo(e.em)}</time></p>
        </div>
    </li>`)}</ol>`;
}

async function telaDetalhe(usuario, id, recarregar) {
    const k = await dados.obterKaizen(id);
    const etapas = ETAPAS_KAIZEN;
    const posicao = etapas.indexOf(k.etapa);
    const proxima = posicao >= 0 && posicao < etapas.length - 1 ? etapas[posicao + 1] : null;
    const anterior = posicao > 0 ? etapas[posicao - 1] : null;
    const podeEditar = k.pode?.editar;
    const podeAprovar = k.pode?.aprovar;
    const concluido = k.etapa === 'concluido';

    let avancar = '';
    if (podeEditar && k.etapa === 'arquivado') {
        avancar = html`<button type="button" class="botao botao--secundario" data-mover="ideia">${icone('restore', 'icone icone--p')}${t('kaizen.reativar')}</button>`;
    } else if (podeEditar && proxima) {
        avancar = proxima === 'concluido' && !podeAprovar
            ? html`<p class="nota">${icone('clock', 'icone icone--p')}${t('kaizen.aguardandoGestor')}</p>`
            : html`<button type="button" class="botao botao--primario" data-mover="${proxima}">${t('kaizen.avancarPara', { etapa: t(`kaizen.etapas.${proxima}`) })}${icone('arrow', 'icone icone--p')}</button>`;
    }

    return {
        titulo: `${codigoKaizen(k.numero)} · ${k.titulo}`,
        conteudo: html`
            <a class="voltar" href="#/kaizen">${icone('back', 'icone icone--p')}${t('kaizen.voltar')}</a>
            <header class="cabecalho cabecalho--acoes">
                <div>
                    <p class="sobretitulo">${codigoKaizen(k.numero)}${ehEquipe(usuario.perfil) ? ` · ${k.empresaNome}` : ''}${k.destaque ? html` · <span class="kz-estrela">${icone('star', 'icone icone--p')}${t('kaizen.destaque')}</span>` : ''}</p>
                    <h1 class="titulo" tabindex="-1">${k.titulo}</h1>
                </div>
                ${podeEditar ? html`<a class="botao botao--secundario" href="#/kaizen/${k.id}/editar">${t('kaizen.editar')}</a>` : ''}
            </header>

            <section class="pdca" aria-labelledby="pdca-titulo">
                <h2 id="pdca-titulo" class="sr-only">${t('kaizen.etapa')}</h2>
                <ol class="pdca-passos" role="list">${etapas.map((e, i) => html`<li class="pdca-passo ${i < posicao ? 'pdca-passo--feito' : ''} ${e === k.etapa ? 'pdca-passo--atual' : ''}" ${e === k.etapa ? html`aria-current="step"` : ''}>
                    <span class="pdca-marca" aria-hidden="true">${i < posicao ? icone('check', 'icone icone--p') : t(`kaizen.pdca.${e}`)}</span>
                    <span class="pdca-nome">${t(`kaizen.etapas.${e}`)}</span>
                </li>`)}</ol>
                <div class="pdca-acoes">
                    ${k.etapa === 'arquivado' ? html`<span class="selo selo--neutro">${t('kaizen.etapas.arquivado')}</span>` : ''}
                    ${avancar}
                    ${podeEditar && anterior && k.etapa !== 'arquivado' && (!concluido || podeAprovar) ? html`<button type="button" class="botao botao--fantasma" data-mover="${anterior}">${icone('back', 'icone icone--p')}${t('kaizen.voltarPara', { etapa: t(`kaizen.etapas.${anterior}`) })}</button>` : ''}
                    ${podeEditar && !['arquivado', 'concluido'].includes(k.etapa) ? html`<button type="button" class="botao botao--fantasma" data-mover="arquivado">${t('kaizen.arquivar')}</button>` : ''}
                </div>
            </section>

            <div class="painel-grade">
                <div class="painel-coluna">
                    <article class="painel-bloco a3" aria-label="${t('kaizen.a3')}">
                        <div class="a3-grade">
                            <div class="a3-coluna">
                                <p class="a3-fase">${t('kaizen.fases.planejar')}</p>
                                ${secaoA3(t('kaizen.campos.problema'), k.problema)}
                                ${secaoA3(t('kaizen.campos.situacaoAtual'), k.situacaoAtual)}
                                <section class="a3-secao">
                                    <h3 class="a3-titulo">${t('kaizen.campos.porques')}</h3>
                                    ${k.porques.length ? html`<ol class="porques" role="list">${k.porques.map((p, i) => html`<li><span class="porques-n">${t('kaizen.porqueN', { n: i + 1 })}</span>${p}</li>`)}</ol>` : html`<p class="a3-vazio">${t('kaizen.aPreencher')}</p>`}
                                </section>
                                ${secaoA3(t('kaizen.campos.causaRaiz'), k.causaRaiz)}
                                ${secaoA3(t('kaizen.campos.meta'), k.meta)}
                            </div>
                            <div class="a3-coluna">
                                <p class="a3-fase">${t('kaizen.fases.executar')}</p>
                                ${secaoA3(t('kaizen.campos.contramedida'), k.contramedida)}
                                <p class="a3-fase">${t('kaizen.fases.verificar')}</p>
                                ${secaoA3(t('kaizen.campos.resultado'), k.resultado, t('kaizen.resultadoDica'))}
                                <p class="a3-fase">${t('kaizen.fases.agir')}</p>
                                ${secaoA3(t('kaizen.campos.padronizacao'), k.padronizacao)}
                            </div>
                        </div>
                    </article>
                </div>
                <div class="painel-coluna painel-coluna--lateral">
                    <section class="painel-bloco" aria-labelledby="kz-ficha">
                        <h2 id="kz-ficha" class="bloco-titulo">${t('kaizen.ficha')}</h2>
                        <dl class="ficha ficha--solta">
                            <div><dt>${t('kaizen.responsavel')}</dt><dd>${k.responsavelNome ?? t('kaizen.semResponsavel')}</dd></div>
                            <div><dt>${t('kaizen.equipe')}</dt><dd>${k.membrosNomes?.length ? k.membrosNomes.map((m) => m.nome).join(', ') : t('comum.semValor')}</dd></div>
                            <div><dt>${t('kaizen.autor')}</dt><dd>${k.autorNome ?? t('comum.semValor')}</dd></div>
                            ${k.area ? html`<div><dt>${t('pessoas.area')}</dt><dd>${k.area}</dd></div>` : ''}
                            ${k.dimensao ? html`<div><dt>${t('kaizen.dimensao')}</dt><dd>${k.dimensao}</dd></div>` : ''}
                            ${k.prazo ? html`<div><dt>${t('kaizen.prazo')}</dt><dd>${formatarData(`${k.prazo}T12:00:00`, { dateStyle: 'medium' })}</dd></div>` : ''}
                            <div><dt>${concluido ? t('kaizen.ganhoComprovado') : t('kaizen.ganhoEstimado')}</dt><dd>${moeda(k.economia)} ${t('kaizen.porAno')}</dd></div>
                            <div><dt>${t('kaizen.horasPoupadas')}</dt><dd>${formatarNumero(k.horas, { maximumFractionDigits: 1 })} ${t('kaizen.horasMesCurto')}</dd></div>
                            <div><dt>${t('kaizen.atualizado')}</dt><dd>${formatarRelativo(k.atualizadoEm)}</dd></div>
                        </dl>
                    </section>
                    ${k.pode?.parecer ? html`<section class="painel-bloco" aria-labelledby="kz-parecer">
                        <h2 id="kz-parecer" class="bloco-titulo">${t('kaizen.parecerTitulo')}</h2>
                        <form class="formulario formulario--compacto" data-form="parecer" novalidate>
                            <div class="campo">
                                <label for="kz-parecer-texto">${t('kaizen.parecerRotulo')}</label>
                                <textarea id="kz-parecer-texto" name="texto" rows="3" maxlength="1000"></textarea>
                            </div>
                            <label class="campo-check"><input type="checkbox" name="destaque" ${k.destaque ? html`checked` : ''}><span>${t('kaizen.marcarDestaque')}</span></label>
                            <button type="submit" class="botao botao--secundario">${t('kaizen.registrarParecer')}</button>
                        </form>
                    </section>` : ''}
                    <section class="painel-bloco" aria-labelledby="kz-historico">
                        <h2 id="kz-historico" class="bloco-titulo">${t('kaizen.historico')}</h2>
                        <form class="formulario formulario--compacto" data-form="comentario" novalidate>
                            <div class="campo">
                                <label for="kz-comentario">${t('kaizen.comentar')}</label>
                                <textarea id="kz-comentario" name="texto" rows="2" maxlength="1000" placeholder="${t('kaizen.comentarDica')}"></textarea>
                            </div>
                            <p class="campo-erro" data-resumo-erro role="alert" hidden></p>
                            <button type="submit" class="botao botao--secundario botao--p">${icone('send', 'icone icone--p')}${t('kaizen.enviarComentario')}</button>
                        </form>
                        ${linhaDoTempo(k)}
                    </section>
                </div>
            </div>`,

        montar(raiz) {
            raiz.addEventListener('click', async (evento) => {
                const botao = evento.target.closest('[data-mover]');
                if (!botao) return;
                const etapa = botao.dataset.mover;
                if (etapa === 'arquivado') {
                    const ok = await perguntar({ titulo: t('kaizen.arquivarTitulo'), texto: t('kaizen.arquivarTexto'), confirmar: t('kaizen.arquivar') });
                    if (!ok) return;
                }
                botao.disabled = true;
                try {
                    const salvo = await dados.moverKaizen(k.id, etapa);
                    anunciar(t('kaizen.movido', { codigo: codigoKaizen(k.numero), etapa: t(`kaizen.etapas.${salvo.etapa}`) }));
                    await recarregar();
                    if (salvo.etapa === 'concluido') celebrar({ titulo: t('kaizen.concluidoTitulo'), texto: t('kaizen.concluidoTexto', { titulo: k.titulo }), pontos: salvo.pontosGanhos });
                } catch (erro) {
                    botao.disabled = false;
                    mostrarErro(erro);
                }
            });
            const comentario = raiz.querySelector('[data-form="comentario"]');
            comentario.addEventListener('submit', async (evento) => {
                evento.preventDefault();
                try {
                    await dados.comentarKaizen(k.id, comentario.texto.value);
                    anunciar(t('kaizen.comentado'));
                    await recarregar();
                } catch (erro) {
                    mostrarErro(erro, comentario);
                }
            });
            const parecer = raiz.querySelector('[data-form="parecer"]');
            parecer?.addEventListener('submit', async (evento) => {
                evento.preventDefault();
                try {
                    await dados.parecerKaizen(k.id, parecer.texto.value, parecer.destaque.checked);
                    anunciar(t('kaizen.parecerRegistrado'));
                    await recarregar();
                } catch (erro) {
                    mostrarErro(erro, parecer);
                }
            });
        },
    };
}

// ---------------------------------------------------------------- editor --

function blocoPessoas(estado, pessoas) {
    if (!pessoas.length) return html`<p class="vazio">${t('kaizen.escolhaEmpresaPrimeiro')}</p>`;
    return html`
        <div class="campo">
            <label for="kz-responsavel">${t('kaizen.responsavel')}</label>
            <select id="kz-responsavel" name="responsavelId">
                ${opcao('', t('kaizen.semResponsavel'), !estado.responsavelId)}
                ${pessoas.map((p) => opcao(p.id, p.area ? `${p.nome} · ${p.area}` : p.nome, p.id === estado.responsavelId))}
            </select>
        </div>
        <fieldset class="grupo-checks">
            <legend>${t('kaizen.equipe')}</legend>
            <div class="atribuir-lista">${pessoas.map((p) => html`<label class="atribuir-pessoa">
                <input type="checkbox" name="membros" value="${p.id}" ${estado.membros.includes(p.id) ? html`checked` : ''}>
                ${avatar(p.nome)}
                <span class="linha-principal">${p.nome}${p.area ? html`<span class="linha-sub">${p.area}</span>` : ''}</span>
            </label>`)}</div>
        </fieldset>
        <datalist id="kz-areas">${[...new Set(pessoas.map((p) => p.area).filter(Boolean))].map((a) => html`<option value="${a}"></option>`)}</datalist>`;
}

async function telaEditor(usuario, id, consulta) {
    const equipe = ehEquipe(usuario.perfil);
    const existente = id ? await dados.obterKaizen(id) : null;
    if (existente && !existente.pode?.editar) throw new dados.ErroDados('proibido');
    const estado = existente ? { ...existente, porques: [...existente.porques] } : {
        empresaId: equipe ? consulta.get('empresa') ?? '' : usuario.empresaId,
        titulo: consulta.get('titulo') ?? '', problema: '', situacaoAtual: '', porques: [], causaRaiz: '', contramedida: '', meta: '',
        resultado: '', padronizacao: '', dimensao: consulta.get('dimensao') ?? '', area: usuario.area ?? '',
        responsavelId: equipe ? '' : usuario.id, membros: [], economia: 0, horas: 0, prazo: '',
    };
    const [empresas, pessoasIniciais, diagnosticos] = await Promise.all([
        equipe && !existente ? dados.listarEmpresas(usuario, { situacao: 'ativas' }) : [],
        estado.empresaId ? dados.colegas(estado.empresaId) : [],
        dados.listarDiagnosticos({ empresaId: estado.empresaId }).catch(() => []),
    ]);
    let pessoas = pessoasIniciais;
    const dimensoes = [...new Set(diagnosticos.filter((d) => !estado.empresaId || d.empresaId === estado.empresaId).flatMap((d) => (d.dimensoes ?? []).map((x) => x.nome)))];
    const voltar = existente ? `#/kaizen/${existente.id}` : '#/kaizen';
    const campoTexto = (nome, linhas, maximo, obrigatorio = false) => html`<div class="campo">
        <label for="kz-${nome}">${t(`kaizen.campos.${nome}`)}${obrigatorio ? '' : html` <span class="rotulo-opcional">(${t('comum.opcional')})</span>`}</label>
        <textarea id="kz-${nome}" name="${nome}" rows="${linhas}" maxlength="${maximo}" aria-describedby="kz-${nome}-dica" ${obrigatorio ? html`required` : ''}>${estado[nome]}</textarea>
        <p id="kz-${nome}-dica" class="campo-dica">${t(`kaizen.dicas.${nome}`)}</p>
    </div>`;

    return {
        titulo: existente ? t('kaizen.editar') : t('kaizen.novo'),
        conteudo: html`
            <a class="voltar" href="${voltar}">${icone('back', 'icone icone--p')}${existente ? `${codigoKaizen(existente.numero)} · ${existente.titulo}` : t('kaizen.voltar')}</a>
            <header class="cabecalho">
                <h1 class="titulo" tabindex="-1">${existente ? t('kaizen.editar') : t('kaizen.novo')}</h1>
                <p class="subtitulo">${t('kaizen.editorSub')}</p>
            </header>
            <form class="formulario" data-form="kaizen" novalidate>
                <fieldset class="secao-form">
                    <legend class="bloco-titulo">${t('kaizen.secaoIdeia')}</legend>
                    ${equipe && !existente ? html`<div class="campo">
                        <label for="kz-empresaId">${t('comum.empresa')}</label>
                        <select id="kz-empresaId" name="empresaId" required>
                            ${opcao('', t('cultura.escolhaEmpresa'), !estado.empresaId)}
                            ${empresas.map((e) => opcao(e.id, e.nome, e.id === estado.empresaId))}
                        </select>
                    </div>` : ''}
                    <div class="campo">
                        <label for="kz-titulo">${t('kaizen.campos.titulo')}</label>
                        <input id="kz-titulo" name="titulo" value="${estado.titulo}" maxlength="150" required placeholder="${t('kaizen.tituloExemplo')}">
                    </div>
                    ${campoTexto('problema', 3, 2000, true)}
                    <div class="grade-2">
                        <div class="campo">
                            <label for="kz-area">${t('pessoas.area')} <span class="rotulo-opcional">(${t('comum.opcional')})</span></label>
                            <input id="kz-area" name="area" value="${estado.area}" maxlength="60" list="kz-areas" autocomplete="off">
                        </div>
                        <div class="campo">
                            <label for="kz-dimensao">${t('kaizen.dimensao')} <span class="rotulo-opcional">(${t('comum.opcional')})</span></label>
                            <input id="kz-dimensao" name="dimensao" value="${estado.dimensao}" maxlength="120" list="kz-dimensoes" autocomplete="off" aria-describedby="kz-dimensao-dica">
                            <datalist id="kz-dimensoes">${dimensoes.map((n) => html`<option value="${n}"></option>`)}</datalist>
                            <p id="kz-dimensao-dica" class="campo-dica">${t('kaizen.dimensaoDica')}</p>
                        </div>
                    </div>
                </fieldset>

                <fieldset class="secao-form">
                    <legend class="bloco-titulo"><span class="kz-pdca" aria-hidden="true">P</span>${t('kaizen.fases.planejar')}</legend>
                    ${campoTexto('situacaoAtual', 3, 2000)}
                    <fieldset class="grupo-checks porques-editor">
                        <legend>${t('kaizen.campos.porques')}</legend>
                        <p class="campo-dica">${t('kaizen.dicas.porques')}</p>
                        ${[0, 1, 2, 3, 4].map((i) => html`<div class="campo campo--linha">
                            <label for="kz-porque-${i}">${t('kaizen.porqueN', { n: i + 1 })}</label>
                            <input id="kz-porque-${i}" name="porque" value="${estado.porques[i] ?? ''}" maxlength="300">
                        </div>`)}
                    </fieldset>
                    ${campoTexto('causaRaiz', 2, 1000)}
                    ${campoTexto('meta', 2, 500)}
                </fieldset>

                <fieldset class="secao-form">
                    <legend class="bloco-titulo"><span class="kz-pdca" aria-hidden="true">D</span>${t('kaizen.fases.executar')}</legend>
                    ${campoTexto('contramedida', 3, 2000)}
                    <div data-pessoas>${blocoPessoas(estado, pessoas)}</div>
                    <div class="campo">
                        <label for="kz-prazo">${t('kaizen.prazo')} <span class="rotulo-opcional">(${t('comum.opcional')})</span></label>
                        <input id="kz-prazo" name="prazo" type="date" value="${estado.prazo ?? ''}">
                    </div>
                </fieldset>

                <fieldset class="secao-form">
                    <legend class="bloco-titulo"><span class="kz-pdca" aria-hidden="true">C</span>${t('kaizen.fases.verificar')}</legend>
                    ${campoTexto('resultado', 3, 2000)}
                    <div class="grade-2">
                        <div class="campo">
                            <label for="kz-economia">${t('kaizen.economiaCampo')}</label>
                            <input id="kz-economia" name="economia" type="number" min="0" step="0.01" inputmode="decimal" value="${estado.economia || ''}" aria-describedby="kz-economia-dica">
                            <p id="kz-economia-dica" class="campo-dica">${t('kaizen.economiaDica')}</p>
                        </div>
                        <div class="campo">
                            <label for="kz-horas">${t('kaizen.horasCampo')}</label>
                            <input id="kz-horas" name="horas" type="number" min="0" step="0.5" inputmode="decimal" value="${estado.horas || ''}">
                        </div>
                    </div>
                </fieldset>

                <fieldset class="secao-form">
                    <legend class="bloco-titulo"><span class="kz-pdca" aria-hidden="true">A</span>${t('kaizen.fases.agir')}</legend>
                    ${campoTexto('padronizacao', 2, 1000)}
                </fieldset>

                <p class="campo-erro" data-resumo-erro role="alert" hidden></p>
                <div class="acoes">
                    <button type="submit" class="botao botao--primario">${existente ? t('comum.salvarAlteracoes') : t('kaizen.criar')}</button>
                    <a class="botao botao--secundario" href="${voltar}">${t('comum.cancelar')}</a>
                </div>
            </form>`,

        montar(raiz) {
            const form = raiz.querySelector('[data-form="kaizen"]');
            const regiaoPessoas = raiz.querySelector('[data-pessoas]');
            form.empresaId?.addEventListener('change', async () => {
                estado.empresaId = form.empresaId.value;
                estado.responsavelId = '';
                estado.membros = [];
                pessoas = estado.empresaId ? await dados.colegas(estado.empresaId) : [];
                desenharEm(regiaoPessoas, blocoPessoas(estado, pessoas));
            });
            form.addEventListener('submit', async (evento) => {
                evento.preventDefault();
                const botao = form.querySelector('[type="submit"]');
                botao.disabled = true;
                try {
                    const salvo = await dados.salvarKaizen({
                        id: existente?.id,
                        empresaId: form.empresaId?.value ?? estado.empresaId,
                        titulo: form.titulo.value,
                        problema: form.problema.value,
                        situacaoAtual: form.situacaoAtual.value,
                        porques: [...form.querySelectorAll('[name="porque"]')].map((c) => c.value),
                        causaRaiz: form.causaRaiz.value,
                        meta: form.meta.value,
                        contramedida: form.contramedida.value,
                        responsavelId: form.responsavelId?.value ?? '',
                        membros: [...form.querySelectorAll('[name="membros"]:checked')].map((c) => c.value),
                        prazo: form.prazo.value,
                        resultado: form.resultado.value,
                        economia: form.economia.value,
                        horas: form.horas.value,
                        padronizacao: form.padronizacao.value,
                        area: form.area.value,
                        dimensao: form.dimensao.value,
                    });
                    anunciar(existente ? t('kaizen.salvo') : salvo.pontosGanhos ? t('kaizen.criadoPontos', { pontos: salvo.pontosGanhos }) : t('kaizen.criado'));
                    irPara(`kaizen/${salvo.id}`);
                } catch (erro) {
                    mostrarErro(erro, form);
                } finally {
                    botao.disabled = false;
                }
            });
        },
    };
}

// ----------------------------------------------------------------- rotas --

export async function tela({ usuario, parametros, consulta, recarregar }) {
    const [id, parte] = parametros;
    if (!id) return telaQuadro(usuario, consulta, recarregar);
    if (id === 'novo') return telaEditor(usuario, null, consulta);
    if (parte === 'editar') return telaEditor(usuario, id, consulta);
    return telaDetalhe(usuario, id, recarregar);
}
