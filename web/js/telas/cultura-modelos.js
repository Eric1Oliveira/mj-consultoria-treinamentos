// Modelos de diagnóstico (só a consultoria): biblioteca e editor.
// Editar um modelo não muda os diagnósticos já lançados (cada um guarda a sua cópia).

import * as dados from '../dados.js';
import { t } from '../textos.js';
import { html, icone, opcao, anunciar, irPara, mostrarErro, desenharEm, perguntar } from '../app.js';
import { abas } from './cultura.js';

/** Modelo do banco → estado do editor (perguntas apontam para a dimensão pelo índice). */
function paraEstado(m) {
    const indice = new Map(m.dimensoes.map((d, i) => [d.id, i]));
    return {
        id: m.id ?? null,
        titulo: m.titulo ?? '',
        descricao: m.descricao ?? '',
        norma: m.norma ?? '',
        interpretacao: m.interpretacao ?? 'maturidade',
        publicado: m.publicado !== false,
        niveis: Array.isArray(m.niveis) && m.niveis.length === 5 ? [...m.niveis] : [],
        dimensoes: m.dimensoes.map((d) => ({ ...d, cursos: [...(d.cursos ?? [])] })),
        questoes: m.questoes.map((q) => ({ id: q.id, texto: q.texto, invertida: Boolean(q.invertida), dimensaoIndice: indice.get(q.dimensao) ?? 0 })),
    };
}

// ---------------------------------------------------------------- lista --

export async function lista() {
    const modelos = await dados.listarModelos();
    return {
        titulo: t('modelos.titulo'),
        conteudo: html`
            <header class="cabecalho cabecalho--acoes">
                <div>
                    <h1 class="titulo" tabindex="-1">${t('cultura.titulo')}</h1>
                    <p class="subtitulo">${t('modelos.sub')}</p>
                </div>
                <a class="botao botao--primario" href="#/cultura/modelos/novo">${icone('plus')}${t('modelos.novo')}</a>
            </header>
            ${abas('modelos')}
            <ul class="modelos-grade" role="list">${modelos.map((m) => html`<li class="modelo-cartao">
                <div class="modelo-cartao-topo">
                    <span class="modelo-cartao-icone" aria-hidden="true">${icone(m.interpretacao === 'risco' ? 'escudo' : 'bussola')}</span>
                    <span class="modelo-cartao-selos">
                        ${m.padrao ? html`<span class="selo selo--marca">${t('modelos.padrao')}</span>` : ''}
                        ${m.interpretacao === 'risco' ? html`<span class="selo selo--aviso-p">${t('cultura.leituraRisco')}</span>` : ''}
                        ${m.publicado ? '' : html`<span class="selo selo--neutro">${t('modelos.rascunho')}</span>`}
                    </span>
                </div>
                <h2 class="modelo-cartao-titulo">${m.titulo}</h2>
                <p class="modelo-cartao-texto">${m.descricao}</p>
                <p class="modelo-opcao-meta">${icone('escudo', 'icone icone--p')}${m.norma || t('comum.semValor')}</p>
                <p class="modelo-opcao-meta">${t('cultura.modeloResumo', { dimensoes: m.dimensoes.length, perguntas: m.questoes.length })}</p>
                <div class="acoes acoes--p modelo-cartao-acoes">
                    <a class="botao botao--primario botao--p" href="#/cultura/novo?modelo=${m.id}">${t('cultura.lancar')}<span class="sr-only"> – ${m.titulo}</span></a>
                    <a class="botao botao--secundario botao--p" href="#/cultura/modelos/${m.id}">${t('comum.editar')}<span class="sr-only"> – ${m.titulo}</span></a>
                    <button type="button" class="botao botao--fantasma botao--p" data-duplicar="${m.id}">${icone('copy', 'icone icone--p')}${t('modelos.duplicar')}<span class="sr-only"> – ${m.titulo}</span></button>
                </div>
            </li>`)}</ul>`,
        montar(raiz) {
            raiz.addEventListener('click', async (evento) => {
                const botao = evento.target.closest('[data-duplicar]');
                if (!botao) return;
                botao.disabled = true;
                try {
                    const original = modelos.find((m) => m.id === botao.dataset.duplicar);
                    const copia = await dados.salvarModelo({ ...paraEstado(original), id: null, titulo: `${original.titulo} (${t('modelos.copia')})`.slice(0, 150), publicado: false });
                    anunciar(t('modelos.duplicado'));
                    irPara(`cultura/modelos/${copia.id}`);
                } catch (erro) {
                    botao.disabled = false;
                    mostrarErro(erro);
                }
            });
        },
    };
}

// --------------------------------------------------------------- editor --

const novaDimensao = () => ({ nome: '', descricao: '', recomendacao: '', cursos: [] });

function estrutura(estado, cursos) {
    return html`${estado.dimensoes.map((d, di) => {
        const perguntas = estado.questoes.map((q, qi) => ({ ...q, qi })).filter((q) => q.dimensaoIndice === di);
        return html`<fieldset class="secao-form editor-dimensao">
            <legend class="bloco-titulo">${t('modelos.dimensaoN', { n: di + 1 })}${d.nome ? ` · ${d.nome}` : ''}</legend>
            <div class="editor-cabeca editor-cabeca--fim">
                <span class="acoes acoes--p">
                    <button type="button" class="botao-icone" data-mover-dim="${di}" data-direcao="-1" ${di === 0 ? html`disabled` : ''} aria-label="${t('modelos.subir', { n: di + 1 })}">${icone('subir', 'icone icone--p')}</button>
                    <button type="button" class="botao-icone" data-mover-dim="${di}" data-direcao="1" ${di === estado.dimensoes.length - 1 ? html`disabled` : ''} aria-label="${t('modelos.descer', { n: di + 1 })}">${icone('descer', 'icone icone--p')}</button>
                    ${estado.dimensoes.length > 1 ? html`<button type="button" class="botao botao--fantasma botao--p" data-remover-dim="${di}">${t('modelos.removerDimensao')}</button>` : ''}
                </span>
            </div>
            <div class="grade-2">
                <div class="campo">
                    <label for="md-${di}-nome">${t('modelos.nomeDimensao')}</label>
                    <input id="md-${di}-nome" data-dim="${di}" data-campo-dim="nome" value="${d.nome}" maxlength="80" required>
                </div>
                <div class="campo">
                    <label for="md-${di}-desc">${t('modelos.descricaoDimensao')}</label>
                    <input id="md-${di}-desc" data-dim="${di}" data-campo-dim="descricao" value="${d.descricao}" maxlength="300">
                </div>
            </div>
            <div class="campo">
                <label for="md-${di}-rec">${t('modelos.recomendacao')}</label>
                <textarea id="md-${di}-rec" rows="2" data-dim="${di}" data-campo-dim="recomendacao" maxlength="800" aria-describedby="md-rec-dica-${di}">${d.recomendacao}</textarea>
                <p id="md-rec-dica-${di}" class="campo-dica">${t('modelos.recomendacaoDica')}</p>
            </div>
            <details class="cursos-recomendados">
                <summary>${icone('book', 'icone icone--p')}${t('modelos.cursosRecomendados', { n: d.cursos.length })}</summary>
                ${cursos.length ? html`<div class="grupo-checks">${cursos.map((c) => html`<label class="campo-check">
                    <input type="checkbox" data-curso-dim="${di}" value="${c.id}" ${d.cursos.includes(c.id) ? html`checked` : ''}>
                    <span>${c.titulo}${c.ativo ? '' : ` (${t('cursos.inativo')})`}</span>
                </label>`)}</div>` : html`<p class="vazio">${t('cursos.nenhum')}</p>`}
            </details>

            <h3 class="subbloco-titulo">${t('modelos.perguntas', { n: perguntas.length })}</h3>
            ${perguntas.length ? html`<ol class="editor-perguntas" role="list">${perguntas.map((q, pi) => html`<li class="editor-pergunta">
                <div class="campo campo--cresce">
                    <label for="mq-${q.qi}">${t('modelos.perguntaN', { n: pi + 1 })}</label>
                    <textarea id="mq-${q.qi}" rows="2" data-questao="${q.qi}" data-campo-questao="texto" maxlength="300">${q.texto}</textarea>
                </div>
                <div class="editor-pergunta-opcoes">
                    <label class="campo-check"><input type="checkbox" data-questao="${q.qi}" data-campo-questao="invertida" ${q.invertida ? html`checked` : ''}><span>${t('cultura.invertida')}</span></label>
                    <button type="button" class="botao botao--fantasma botao--p" data-remover-questao="${q.qi}">${t('modelos.removerPergunta')}<span class="sr-only"> ${pi + 1}</span></button>
                </div>
            </li>`)}</ol>` : html`<p class="vazio">${t('modelos.semPerguntas')}</p>`}
            <button type="button" class="botao botao--secundario botao--p" data-add-questao="${di}">${icone('plus', 'icone icone--p')}${t('modelos.addPergunta')}</button>
        </fieldset>`;
    })}
    <button type="button" class="botao botao--secundario" data-add-dim>${icone('plus', 'icone icone--p')}${t('modelos.addDimensao')}</button>`;
}

export async function editor(id) {
    const [existente, cursos] = await Promise.all([id ? dados.obterModelo(id) : null, dados.listarCursosResumo()]);
    const estado = existente ? paraEstado(existente) : {
        id: null, titulo: '', descricao: '', norma: '', interpretacao: 'maturidade', publicado: true, niveis: [],
        dimensoes: [novaDimensao()], questoes: [{ texto: '', invertida: false, dimensaoIndice: 0 }],
    };
    const niveisProprios = estado.niveis.length === 5;
    const padroes = t('cultura.niveis');

    return {
        titulo: existente ? existente.titulo : t('modelos.novo'),
        conteudo: html`
            <a class="voltar" href="#/cultura/modelos">${icone('back', 'icone icone--p')}${t('modelos.voltar')}</a>
            <header class="cabecalho">
                <h1 class="titulo" tabindex="-1">${existente ? existente.titulo : t('modelos.novo')}</h1>
                <p class="subtitulo">${t('modelos.editorSub')}</p>
            </header>
            <form class="formulario" data-form="modelo" novalidate>
                <fieldset class="secao-form">
                    <legend class="bloco-titulo">${t('modelos.dados')}</legend>
                    <div class="campo">
                        <label for="m-titulo">${t('modelos.tituloCampo')}</label>
                        <input id="m-titulo" name="titulo" data-campo="titulo" value="${estado.titulo}" maxlength="150" required>
                    </div>
                    <div class="campo">
                        <label for="m-descricao">${t('modelos.descricao')}</label>
                        <textarea id="m-descricao" rows="2" data-campo="descricao" maxlength="800">${estado.descricao}</textarea>
                    </div>
                    <div class="campo">
                        <label for="m-norma">${t('modelos.norma')}</label>
                        <input id="m-norma" data-campo="norma" value="${estado.norma}" maxlength="300" aria-describedby="m-norma-dica">
                        <p id="m-norma-dica" class="campo-dica">${t('modelos.normaDica')}</p>
                    </div>
                    <div class="campo">
                        <label for="m-interpretacao">${t('modelos.interpretacao')}</label>
                        <select id="m-interpretacao" data-campo="interpretacao" aria-describedby="m-interpretacao-dica">
                            ${opcao('maturidade', t('modelos.interpretacoes.maturidade'), estado.interpretacao === 'maturidade')}
                            ${opcao('risco', t('modelos.interpretacoes.risco'), estado.interpretacao === 'risco')}
                        </select>
                        <p id="m-interpretacao-dica" class="campo-dica">${t('modelos.interpretacaoDica')}</p>
                    </div>
                    <details class="cursos-recomendados" ${niveisProprios ? html`open` : ''}>
                        <summary>${icone('layers', 'icone icone--p')}${t('modelos.niveisProprios')}</summary>
                        <p class="campo-dica">${t('modelos.niveisDica', { padrao: padroes.join(' · ') })}</p>
                        <div class="grade-niveis">${[0, 1, 2, 3, 4].map((i) => html`<div class="campo">
                            <label for="m-nivel-${i}">${t('modelos.nivelN', { n: i + 1 })}</label>
                            <input id="m-nivel-${i}" data-nivel="${i}" value="${estado.niveis[i] ?? ''}" maxlength="40" placeholder="${padroes[i]}">
                        </div>`)}</div>
                    </details>
                    <label class="campo-check"><input type="checkbox" data-campo="publicado" ${estado.publicado ? html`checked` : ''}><span>${t('modelos.publicado')}</span></label>
                </fieldset>
                <div data-estrutura>${estrutura(estado, cursos)}</div>
                <p class="campo-erro" data-resumo-erro role="alert" hidden></p>
                <div class="acoes">
                    <button type="submit" class="botao botao--primario">${t('modelos.salvar')}</button>
                    <a class="botao botao--secundario" href="#/cultura/modelos">${t('comum.cancelar')}</a>
                </div>
            </form>`,

        montar(raiz) {
            const form = raiz.querySelector('[data-form="modelo"]');
            const regiao = raiz.querySelector('[data-estrutura]');
            const redesenhar = (foco) => {
                desenharEm(regiao, estrutura(estado, cursos));
                if (foco) raiz.querySelector(`#${foco}`)?.focus();
            };

            form.addEventListener('input', (evento) => {
                const alvo = evento.target;
                if (alvo.dataset.campo && alvo.type !== 'checkbox') estado[alvo.dataset.campo] = alvo.value;
                if (alvo.dataset.dim !== undefined) estado.dimensoes[Number(alvo.dataset.dim)][alvo.dataset.campoDim] = alvo.value;
                if (alvo.dataset.questao !== undefined && alvo.dataset.campoQuestao === 'texto') estado.questoes[Number(alvo.dataset.questao)].texto = alvo.value;
                if (alvo.dataset.nivel !== undefined) {
                    const niveis = [0, 1, 2, 3, 4].map((i) => form.querySelector(`[data-nivel="${i}"]`).value.trim());
                    estado.niveis = niveis.some(Boolean) ? niveis : [];
                }
            });
            form.addEventListener('change', (evento) => {
                const alvo = evento.target;
                if (alvo.dataset.campo === 'publicado') estado.publicado = alvo.checked;
                if (alvo.dataset.campo === 'interpretacao') estado.interpretacao = alvo.value;
                if (alvo.dataset.campoQuestao === 'invertida') estado.questoes[Number(alvo.dataset.questao)].invertida = alvo.checked;
                if (alvo.dataset.cursoDim !== undefined) {
                    const d = estado.dimensoes[Number(alvo.dataset.cursoDim)];
                    d.cursos = alvo.checked ? [...new Set([...d.cursos, alvo.value])] : d.cursos.filter((c) => c !== alvo.value);
                    const resumo = alvo.closest('details').querySelector('summary');
                    resumo.lastChild.textContent = t('modelos.cursosRecomendados', { n: d.cursos.length });
                }
            });

            form.addEventListener('click', async (evento) => {
                const alvo = evento.target.closest('button');
                if (!alvo || alvo.type === 'submit') return;
                if (alvo.dataset.addDim !== undefined) {
                    estado.dimensoes.push(novaDimensao());
                    estado.questoes.push({ texto: '', invertida: false, dimensaoIndice: estado.dimensoes.length - 1 });
                    redesenhar(`md-${estado.dimensoes.length - 1}-nome`);
                } else if (alvo.dataset.removerDim !== undefined) {
                    const di = Number(alvo.dataset.removerDim);
                    const ok = await perguntar({ titulo: t('modelos.removerDimensaoTitulo'), texto: t('modelos.removerDimensaoTexto'), confirmar: t('modelos.removerDimensao'), perigo: true });
                    if (!ok) return;
                    estado.dimensoes.splice(di, 1);
                    estado.questoes = estado.questoes.filter((q) => q.dimensaoIndice !== di)
                        .map((q) => ({ ...q, dimensaoIndice: q.dimensaoIndice > di ? q.dimensaoIndice - 1 : q.dimensaoIndice }));
                    redesenhar(`md-${Math.max(0, di - 1)}-nome`);
                } else if (alvo.dataset.moverDim !== undefined) {
                    const de = Number(alvo.dataset.moverDim);
                    const para = de + Number(alvo.dataset.direcao);
                    [estado.dimensoes[de], estado.dimensoes[para]] = [estado.dimensoes[para], estado.dimensoes[de]];
                    estado.questoes.forEach((q) => {
                        if (q.dimensaoIndice === de) q.dimensaoIndice = para;
                        else if (q.dimensaoIndice === para) q.dimensaoIndice = de;
                    });
                    redesenhar(`md-${para}-nome`);
                } else if (alvo.dataset.addQuestao !== undefined) {
                    estado.questoes.push({ texto: '', invertida: false, dimensaoIndice: Number(alvo.dataset.addQuestao) });
                    redesenhar(`mq-${estado.questoes.length - 1}`);
                } else if (alvo.dataset.removerQuestao !== undefined) {
                    estado.questoes.splice(Number(alvo.dataset.removerQuestao), 1);
                    redesenhar();
                }
            });

            form.addEventListener('submit', async (evento) => {
                evento.preventDefault();
                const botao = form.querySelector('[type="submit"]');
                botao.disabled = true;
                try {
                    const salvo = await dados.salvarModelo(estado);
                    anunciar(t('modelos.salvo', { titulo: salvo.titulo }));
                    irPara('cultura/modelos');
                } catch (erro) {
                    mostrarErro(erro, form);
                } finally {
                    botao.disabled = false;
                }
            });
        },
    };
}
