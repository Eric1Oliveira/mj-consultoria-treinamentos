// Relatórios: indicadores calculados das matrículas, por curso e por pessoa, com exportação CSV.
// A lista por pessoa filtra e ordena na hora (sem ir ao servidor de novo).

import * as dados from '../dados.js';
import { ehEquipe } from '../regras.js';
import { t, formatarNumero, formatarPercentual, formatarData, formatarRelativo } from '../textos.js';
import { html, icone, opcao, anunciar, baixarCsv, desenharEm, indicador } from '../app.js';

const filtro = { empresaId: '', cursoId: '' };
const lista = { busca: '', situacao: '', area: '', ordem: 'pessoa', crescente: true };

const SELO_SITUACAO = { concluido: 'selo--sucesso', andamento: 'selo--marca', atrasado: 'selo--perigo', naoIniciado: 'selo--neutro' };
const SITUACOES = ['andamento', 'atrasado', 'naoIniciado', 'concluido'];

const nota = (valor) => (valor === null ? t('comum.semValor') : `${formatarNumero(valor)}%`);
const dataPrazo = (iso) => formatarData(`${iso}T12:00:00`, { day: 'numeric', month: 'short', year: 'numeric' });

/** Como cada coluna ordena (texto em ordem alfabética, número, data). */
const ORDENAR = {
    pessoa: (l) => l.pessoa.toLocaleLowerCase(),
    empresa: (l) => l.empresa.toLocaleLowerCase(),
    curso: (l) => l.curso.toLocaleLowerCase(),
    progresso: (l) => l.progresso,
    nota: (l) => l.nota ?? -1,
    situacao: (l) => SITUACOES.indexOf(l.situacao),
    prazo: (l) => l.prazo ?? '9999',
    ultima: (l) => l.ultimaAtividade,
};

function linhasVisiveis(linhas) {
    const termo = lista.busca.trim().toLowerCase();
    const chave = ORDENAR[lista.ordem] ?? ORDENAR.pessoa;
    return linhas
        .filter((l) => !termo || `${l.pessoa} ${l.curso} ${l.area} ${l.empresa}`.toLowerCase().includes(termo))
        .filter((l) => !lista.situacao || l.situacao === lista.situacao)
        .filter((l) => !lista.area || l.area === lista.area)
        .sort((a, b) => {
            const [x, y] = [chave(a), chave(b)];
            const comparacao = typeof x === 'string' ? x.localeCompare(y) : x - y;
            return (lista.crescente ? comparacao : -comparacao) || a.pessoa.localeCompare(b.pessoa);
        });
}

function cabecalhoOrdenavel(coluna, rotulo, classe = '') {
    const ativa = lista.ordem === coluna;
    const sentido = ativa ? (lista.crescente ? 'ascending' : 'descending') : 'none';
    return html`<th scope="col" class="${classe}" aria-sort="${sentido}">
        <button type="button" class="ordenar ${ativa ? 'ordenar--ativa' : ''}" data-ordenar="${coluna}">${rotulo}${icone(ativa && !lista.crescente ? 'descer' : 'subir', 'icone icone--p ordenar-seta')}</button>
    </th>`;
}

function tabelaPessoas(equipe, linhas) {
    const visiveis = linhasVisiveis(linhas);
    if (!visiveis.length) return html`<p class="vazio">${t('comum.nenhumResultado')}</p>`;
    return html`<p class="bloco-nota" role="status">${t('relatorios.mostrando', { n: formatarNumero(visiveis.length), total: formatarNumero(linhas.length) })}</p>
        <div class="tabela-rolagem" tabindex="0" role="region" aria-labelledby="rel-pessoa-titulo">
        <table class="tabela tabela--cartoes">
            <thead><tr>
                ${cabecalhoOrdenavel('pessoa', t('relatorios.pessoa'))}
                ${equipe ? cabecalhoOrdenavel('empresa', t('comum.empresa')) : ''}
                ${cabecalhoOrdenavel('curso', t('relatorios.curso'))}
                ${cabecalhoOrdenavel('progresso', t('relatorios.progresso'), 'num')}
                ${cabecalhoOrdenavel('nota', t('relatorios.nota'), 'num')}
                ${cabecalhoOrdenavel('situacao', t('comum.situacao'))}
                ${cabecalhoOrdenavel('prazo', t('relatorios.prazo'))}
                ${cabecalhoOrdenavel('ultima', t('relatorios.ultima'))}
            </tr></thead>
            <tbody>${visiveis.map((l) => html`<tr>
                <th scope="row">${l.pessoa}${l.area ? html`<span class="linha-sub">${l.area}</span>` : ''}</th>
                ${equipe ? html`<td data-rotulo="${t('comum.empresa')}">${l.empresa}</td>` : ''}
                <td data-rotulo="${t('relatorios.curso')}">${l.curso}</td>
                <td class="num" data-rotulo="${t('relatorios.progresso')}">${formatarNumero(l.progresso)}%</td>
                <td class="num" data-rotulo="${t('relatorios.nota')}">${nota(l.nota)}</td>
                <td data-rotulo="${t('comum.situacao')}"><span class="selo ${SELO_SITUACAO[l.situacao]}">${t(`relatorios.situacoes.${l.situacao}`)}</span></td>
                <td data-rotulo="${t('relatorios.prazo')}">${l.prazo ? html`<span class="${l.vencido ? 'texto-perigo' : ''}">${dataPrazo(l.prazo)}</span>` : t('comum.semValor')}</td>
                <td data-rotulo="${t('relatorios.ultima')}"><time datetime="${l.ultimaAtividade}">${formatarRelativo(l.ultimaAtividade)}</time></td>
            </tr>`)}</tbody>
        </table>
    </div>`;
}

export async function tela({ usuario }) {
    const equipe = ehEquipe(usuario.perfil);
    const [empresas, cursos, r] = await Promise.all([
        equipe ? dados.listarEmpresas(usuario) : [],
        dados.listarCursos(usuario),
        dados.relatorio(usuario, filtro),
    ]);
    const i = r.indicadores;
    const areas = [...new Set(r.linhas.map((l) => l.area).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    if (lista.area && !areas.includes(lista.area)) lista.area = '';

    return {
        titulo: t('relatorios.titulo'),
        conteudo: html`
            <header class="cabecalho cabecalho--acoes">
                <div>
                    <h1 class="titulo" tabindex="-1">${t('relatorios.titulo')}</h1>
                    <p class="subtitulo">${t('relatorios.sub')}</p>
                </div>
                <button type="button" class="botao botao--secundario" data-exportar ${r.linhas.length ? '' : html`disabled`}>${icone('download')}${t('relatorios.exportar')}</button>
            </header>
            <form class="filtros filtros--solto" data-form="filtro">
                ${equipe ? html`<div class="campo">
                    <label for="rel-empresa">${t('comum.empresa')}</label>
                    <select id="rel-empresa" name="empresaId">
                        ${opcao('', t('relatorios.todasEmpresas'), !filtro.empresaId)}
                        ${empresas.map((e) => opcao(e.id, e.nome, filtro.empresaId === e.id))}
                    </select>
                </div>` : ''}
                <div class="campo">
                    <label for="rel-curso">${t('relatorios.curso')}</label>
                    <select id="rel-curso" name="cursoId">
                        ${opcao('', t('relatorios.todosCursos'), !filtro.cursoId)}
                        ${cursos.map((c) => opcao(c.id, c.titulo, filtro.cursoId === c.id))}
                    </select>
                </div>
            </form>

            <section aria-labelledby="rel-indicadores">
                <h2 id="rel-indicadores" class="sr-only">${t('painel.resumo')}</h2>
                <dl class="indicadores">
                    ${indicador(t('relatorios.matriculas'), formatarNumero(i.matriculas), true)}
                    ${indicador(t('relatorios.emAndamento'), formatarNumero(i.emAndamento))}
                    ${indicador(t('relatorios.concluidas'), formatarNumero(i.concluidas))}
                    ${indicador(t('relatorios.taxaConclusao'), formatarPercentual(i.taxaConclusao))}
                    ${indicador(t('relatorios.aprovacoes'), formatarNumero(i.aprovacoes))}
                    ${indicador(t('relatorios.reprovacoes'), formatarNumero(i.reprovacoes))}
                    ${indicador(t('relatorios.notaMedia'), nota(i.notaMedia))}
                    ${indicador(t('relatorios.certificados'), formatarNumero(i.certificados))}
                    ${indicador(t('relatorios.atrasados'), formatarNumero(i.atrasados))}
                </dl>
            </section>

            ${r.linhas.length ? html`
            <section class="painel-bloco" aria-labelledby="rel-curso-titulo">
                <h2 id="rel-curso-titulo" class="bloco-titulo">${t('relatorios.porCurso')}</h2>
                <div class="tabela-rolagem" tabindex="0" role="region" aria-labelledby="rel-curso-titulo">
                    <table class="tabela tabela--cartoes">
                        <thead><tr>
                            <th scope="col">${t('relatorios.curso')}</th>
                            <th scope="col" class="num">${t('relatorios.matriculas')}</th>
                            <th scope="col" class="num">${t('relatorios.concluidas')}</th>
                            <th scope="col">${t('relatorios.taxaConclusao')}</th>
                            <th scope="col" class="num">${t('relatorios.notaMedia')}</th>
                        </tr></thead>
                        <tbody>${r.porCurso.map((c, n) => html`<tr>
                            <th scope="row">${c.curso}</th>
                            <td class="num" data-rotulo="${t('relatorios.matriculas')}">${formatarNumero(c.matriculados)}</td>
                            <td class="num" data-rotulo="${t('relatorios.concluidas')}">${formatarNumero(c.concluidos)}</td>
                            <td data-rotulo="${t('relatorios.taxaConclusao')}"><span class="taxa"><span class="barra barra--fina" role="presentation"><span class="barra-preenchida" data-progresso="${Math.round(c.taxa * 100)}"></span></span><span id="taxa-${n}">${formatarPercentual(c.taxa)}</span></span></td>
                            <td class="num" data-rotulo="${t('relatorios.notaMedia')}">${nota(c.notaMedia)}</td>
                        </tr>`)}</tbody>
                    </table>
                </div>
            </section>

            <section class="painel-bloco" aria-labelledby="rel-pessoa-titulo">
                <h2 id="rel-pessoa-titulo" class="bloco-titulo">${t('relatorios.porPessoa')}</h2>
                <p class="bloco-nota">${t('relatorios.atrasoDica', { dias: r.diasAtraso })}</p>
                <form class="filtros filtros--lista" data-form="lista" role="search">
                    <div class="campo campo--cresce">
                        <label for="rel-busca">${t('relatorios.buscaRotulo')}</label>
                        <input id="rel-busca" name="busca" type="search" value="${lista.busca}" autocomplete="off">
                    </div>
                    <div class="campo">
                        <label for="rel-situacao">${t('comum.situacao')}</label>
                        <select id="rel-situacao" name="situacao">
                            ${opcao('', t('comum.todas'), !lista.situacao)}
                            ${SITUACOES.map((s) => opcao(s, t(`relatorios.situacoes.${s}`), lista.situacao === s))}
                        </select>
                    </div>
                    ${areas.length ? html`<div class="campo">
                        <label for="rel-area">${t('pessoas.area')}</label>
                        <select id="rel-area" name="area">${opcao('', t('comum.todas'), !lista.area)}${areas.map((a) => opcao(a, a, lista.area === a))}</select>
                    </div>` : ''}
                </form>
                <div data-tabela-pessoas>${tabelaPessoas(equipe, r.linhas)}</div>
            </section>` : html`<p class="vazio">${t('relatorios.nenhum')}</p>`}`,

        montar(raiz, { recarregar }) {
            const form = raiz.querySelector('[data-form="filtro"]');
            form.addEventListener('submit', (evento) => evento.preventDefault());
            form.addEventListener('change', () => {
                filtro.empresaId = form.empresaId?.value ?? '';
                filtro.cursoId = form.cursoId.value;
                recarregar();
            });

            const alvo = raiz.querySelector('[data-tabela-pessoas]');
            const formLista = raiz.querySelector('[data-form="lista"]');
            const redesenhar = () => desenharEm(alvo, tabelaPessoas(equipe, r.linhas));
            formLista?.addEventListener('submit', (evento) => evento.preventDefault());
            formLista?.addEventListener('input', () => {
                lista.busca = formLista.busca.value;
                lista.situacao = formLista.situacao.value;
                lista.area = formLista.area?.value ?? '';
                redesenhar();
            });
            alvo?.addEventListener('click', (evento) => {
                const botao = evento.target.closest('[data-ordenar]');
                if (!botao) return;
                const coluna = botao.dataset.ordenar;
                lista.crescente = lista.ordem === coluna ? !lista.crescente : true;
                lista.ordem = coluna;
                redesenhar();
                alvo.querySelector(`[data-ordenar="${coluna}"]`)?.focus();
            });

            raiz.querySelector('[data-exportar]').addEventListener('click', () => {
                const cabecalho = [t('relatorios.pessoa'), t('pessoas.area'), t('comum.empresa'), t('relatorios.curso'), t('relatorios.progresso'), t('relatorios.nota'), t('comum.situacao'), t('relatorios.prazo'), t('relatorios.ultima')];
                const linhas = linhasVisiveis(r.linhas).map((l) => [l.pessoa, l.area, l.empresa, l.curso, `${l.progresso}%`, l.nota ?? '', t(`relatorios.situacoes.${l.situacao}`), l.prazo ? dataPrazo(l.prazo) : '', formatarData(l.ultimaAtividade, { dateStyle: 'short', timeStyle: 'short' })]);
                baixarCsv(`relatorio-${new Date().toISOString().slice(0, 10)}.csv`, [cabecalho, ...linhas]);
                anunciar(t('relatorios.exportado'));
            });
        },
    };
}
