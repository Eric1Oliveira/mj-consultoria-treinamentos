// Relatórios: indicadores calculados das matrículas, por curso e por pessoa, com exportação CSV.

import * as dados from '../dados.js';
import { ehEquipe } from '../regras.js';
import { t, formatarNumero, formatarPercentual, formatarData, formatarRelativo } from '../textos.js';
import { html, icone, opcao, anunciar, baixarCsv } from '../app.js';

const filtro = { empresaId: '', cursoId: '' };

const SELO_SITUACAO = { concluido: 'selo--sucesso', andamento: 'selo--marca', atrasado: 'selo--perigo', naoIniciado: 'selo--neutro' };

function indicador(rotulo, valor, destaque = false) {
    return html`<div class="indicador ${destaque ? 'indicador--destaque' : ''}">
        <dt class="indicador-rotulo">${rotulo}</dt>
        <dd class="indicador-valor">${valor}</dd>
    </div>`;
}

const nota = (valor) => (valor === null ? t('comum.semValor') : `${formatarNumero(valor)}%`);

export async function tela({ usuario }) {
    const equipe = ehEquipe(usuario.perfil);
    const [empresas, cursos, r] = await Promise.all([
        equipe ? dados.listarEmpresas(usuario) : [],
        dados.listarCursos(usuario),
        dados.relatorio(usuario, filtro),
    ]);
    const i = r.indicadores;

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
                <button type="submit" class="botao botao--secundario">${t('comum.filtrar')}</button>
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
                    <table class="tabela">
                        <thead><tr>
                            <th scope="col">${t('relatorios.curso')}</th>
                            <th scope="col" class="num">${t('relatorios.matriculas')}</th>
                            <th scope="col" class="num">${t('relatorios.concluidas')}</th>
                            <th scope="col">${t('relatorios.taxaConclusao')}</th>
                            <th scope="col" class="num">${t('relatorios.notaMedia')}</th>
                        </tr></thead>
                        <tbody>${r.porCurso.map((c, n) => html`<tr>
                            <th scope="row">${c.curso}</th>
                            <td class="num">${formatarNumero(c.matriculados)}</td>
                            <td class="num">${formatarNumero(c.concluidos)}</td>
                            <td><span class="taxa"><span class="barra barra--fina" role="presentation"><span class="barra-preenchida" data-progresso="${Math.round(c.taxa * 100)}"></span></span><span id="taxa-${n}">${formatarPercentual(c.taxa)}</span></span></td>
                            <td class="num">${nota(c.notaMedia)}</td>
                        </tr>`)}</tbody>
                    </table>
                </div>
            </section>

            <section class="painel-bloco" aria-labelledby="rel-pessoa-titulo">
                <h2 id="rel-pessoa-titulo" class="bloco-titulo">${t('relatorios.porPessoa')}</h2>
                <p class="bloco-nota">${t('relatorios.atrasoDica', { dias: r.diasAtraso })}</p>
                <div class="tabela-rolagem" tabindex="0" role="region" aria-labelledby="rel-pessoa-titulo">
                    <table class="tabela">
                        <thead><tr>
                            <th scope="col">${t('relatorios.pessoa')}</th>
                            ${equipe ? html`<th scope="col">${t('comum.empresa')}</th>` : ''}
                            <th scope="col">${t('relatorios.curso')}</th>
                            <th scope="col" class="num">${t('relatorios.progresso')}</th>
                            <th scope="col" class="num">${t('relatorios.nota')}</th>
                            <th scope="col">${t('comum.situacao')}</th>
                            <th scope="col">${t('relatorios.ultima')}</th>
                        </tr></thead>
                        <tbody>${r.linhas.map((l) => html`<tr>
                            <th scope="row">${l.pessoa}</th>
                            ${equipe ? html`<td>${l.empresa}</td>` : ''}
                            <td>${l.curso}</td>
                            <td class="num">${formatarNumero(l.progresso)}%</td>
                            <td class="num">${nota(l.nota)}</td>
                            <td><span class="selo ${SELO_SITUACAO[l.situacao]}">${t(`relatorios.situacoes.${l.situacao}`)}</span></td>
                            <td><time datetime="${l.ultimaAtividade}">${formatarRelativo(l.ultimaAtividade)}</time></td>
                        </tr>`)}</tbody>
                    </table>
                </div>
            </section>` : html`<p class="vazio">${t('relatorios.nenhum')}</p>`}`,

        montar(raiz, { recarregar }) {
            const form = raiz.querySelector('[data-form="filtro"]');
            form.addEventListener('submit', (evento) => {
                evento.preventDefault();
                filtro.empresaId = form.empresaId?.value ?? '';
                filtro.cursoId = form.cursoId.value;
                recarregar();
            });
            raiz.querySelector('[data-exportar]').addEventListener('click', () => {
                const cabecalho = [t('relatorios.pessoa'), t('comum.empresa'), t('relatorios.curso'), t('relatorios.progresso'), t('relatorios.nota'), t('comum.situacao'), t('relatorios.ultima')];
                const linhas = r.linhas.map((l) => [l.pessoa, l.empresa, l.curso, `${l.progresso}%`, l.nota ?? '', t(`relatorios.situacoes.${l.situacao}`), formatarData(l.ultimaAtividade, { dateStyle: 'short', timeStyle: 'short' })]);
                baixarCsv(`relatorio-${new Date().toISOString().slice(0, 10)}.csv`, [cabecalho, ...linhas]);
                anunciar(t('relatorios.exportado'));
            });
        },
    };
}
