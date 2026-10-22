// Painel inicial. Muda conforme o perfil; tudo vem de dados.js (cursos, pontos, matrículas).

import * as dados from '../dados.js';
import { ehEquipe, podeEstudar, primeiroNome, pode, PONTOS, NIVEIS, ETAPAS_KAIZEN, codigoKaizen } from '../regras.js';
import { t, tn, formatarNumero, formatarPercentual, formatarData, formatarRelativo } from '../textos.js';
import { html, icone, avatar, fraseAtividade, capa, mapaSvg, desenharEm } from '../app.js';
import { barraNota, seloLeitura } from '../graficos.js';
import { barra, rotuloAcao } from './cursos.js';

function indicador(rotulo, valor, destaque = false) {
    return html`<div class="indicador ${destaque ? 'indicador--destaque' : ''}">
        <dt class="indicador-rotulo">${rotulo}</dt>
        <dd class="indicador-valor">${valor}</dd>
    </div>`;
}

function blocoIndicadores(usuario, resumo) {
    let itens;
    if (ehEquipe(usuario.perfil)) {
        itens = [
            indicador(t('painel.empresasAtivas'), formatarNumero(resumo.empresasAtivas), true),
            indicador(t('painel.alunosAtivos'), formatarNumero(resumo.alunosAtivos)),
            indicador(t('painel.cursosAtivos'), formatarNumero(resumo.cursosAtivos)),
            indicador(t('painel.matriculas'), formatarNumero(resumo.matriculas)),
            indicador(t('painel.certificados'), formatarNumero(resumo.certificados)),
            indicador(t('painel.solicitacoesPendentes'), formatarNumero(resumo.solicitacoesPendentes)),
        ];
    } else if (usuario.perfil === 'company_admin') {
        itens = [
            indicador(t('painel.funcionariosAtivos'), formatarNumero(resumo.funcionariosAtivos), true),
            indicador(t('painel.taxaConclusao'), formatarPercentual(resumo.taxaConclusao)),
            indicador(t('painel.certificados'), formatarNumero(resumo.certificados)),
            indicador(t('painel.solicitacoesPendentes'), formatarNumero(resumo.solicitacoesPendentes)),
        ];
    } else {
        return '';
    }
    return html`<section aria-labelledby="painel-resumo">
        <h2 id="painel-resumo" class="sr-only">${t('painel.resumo')}</h2>
        <dl class="indicadores">${itens}</dl>
    </section>`;
}

// ------------------------------------------------------------- aprendizado --

function blocoContinuar(curso, proximaAula, concluiuTudo = false) {
    if (!curso) {
        return html`<section class="destaque destaque--vazio" aria-labelledby="painel-continuar">
            <span class="destaque-fundo">${mapaSvg('sem-curso', { largura: 960, altura: 360, marcos: 6, feitos: concluiuTudo ? 5 : -1, trilha: [0.5, 0.92, 0.22, 0.72] })}</span>
            <div class="destaque-corpo">
                <h2 id="painel-continuar" class="destaque-rotulo">${t('painel.continuar')}</h2>
                <p class="destaque-titulo">${concluiuTudo ? t('painel.tudoConcluido') : t('painel.semCursos')}</p>
                ${concluiuTudo ? html`<p class="destaque-proxima">${t('painel.tudoConcluidoTexto')}</p>` : ''}
                <div class="destaque-acoes"><a class="botao botao--claro" href="#/cursos">${t('painel.verCursos')}${icone('arrow', 'icone icone--p')}</a></div>
            </div>
        </section>`;
    }
    const p = curso.progresso;
    const acao = proximaAula
        ? html`<a class="botao botao--claro botao--g" href="#/cursos/${curso.id}/aula/${proximaAula.id}">${icone('tocar', 'icone icone--p')}${p.feitas ? t('painel.continuarAula') : rotuloAcao(p)}</a>`
        : html`<a class="botao botao--claro botao--g" href="#/cursos/${curso.id}/avaliacao">${t('painel.fazerAvaliacao')}${icone('arrow', 'icone icone--p')}</a>`;
    return html`<section class="destaque" aria-labelledby="painel-continuar">
        ${capa(curso, p, { classe: 'destaque-fundo', largura: 960, altura: 360, trilha: [0.5, 0.92, 0.22, 0.72] })}
        <div class="destaque-corpo">
            <h2 id="painel-continuar" class="destaque-rotulo">${t('painel.continuar')}</h2>
            <p class="destaque-titulo"><a href="#/cursos/${curso.id}">${curso.titulo}</a></p>
            <p class="destaque-proxima">${proximaAula ? t('painel.proximaAula', { titulo: proximaAula.titulo }) : t('painel.faltaAvaliacao')}</p>
            <div class="destaque-progresso">
                <p id="painel-progresso">${t('painel.progressoAulas', { feitas: p.feitas, total: p.total })}</p>
                ${barra(p.percentual, 'painel-progresso')}
            </div>
            <div class="destaque-acoes">${acao}</div>
        </div>
    </section>`;
}

function blocoMeusCursos(cursos, titulo = t('painel.meusCursos')) {
    const meus = cursos.filter((c) => c.progresso?.matriculado);
    if (!meus.length) return '';
    return html`<section class="secao" aria-labelledby="painel-meus-cursos">
        <div class="secao-cabecalho">
            <h2 id="painel-meus-cursos" class="secao-titulo">${titulo}</h2>
            <a class="secao-link" href="#/cursos">${t('painel.verTodas')}${icone('arrow', 'icone icone--p')}</a>
        </div>
        <ul class="mini-cursos" role="list">
            ${meus.map((c) => html`<li class="mini-curso">
                ${capa(c, c.progresso, { classe: 'mini-curso-capa' })}
                <a class="mini-curso-link" href="#/cursos/${c.id}">${c.titulo}</a>
                <p class="mini-curso-sub" id="meu-${c.id}">${c.progresso.concluido ? html`${icone('award', 'icone icone--p')}${t('painel.concluido')}` : t('painel.progressoAulas', { feitas: c.progresso.feitas, total: c.progresso.total })}<span class="mini-curso-pct">${formatarPercentual(c.progresso.percentual / 100)}</span></p>
                ${barra(c.progresso.percentual, `meu-${c.id}`)}
            </li>`)}
        </ul>
    </section>`;
}

function blocoGamificacao(g) {
    const niveis = t('gamificacao.niveis');
    const nome = niveis[g.nivel] ?? niveis[niveis.length - 1];
    const minimoAtual = NIVEIS[g.nivel] ?? 0;
    const percentualNivel = g.proximo ? Math.round(((g.pontos - minimoAtual) / (g.proximo - minimoAtual)) * 100) : 100;
    const dias = g.sequencia === 1 ? t('gamificacao.diasUm', { dias: 1 }) : t('gamificacao.diasVarios', { dias: g.sequencia });
    const conquistas = Object.entries(g.conquistas);

    return html`<section class="painel-bloco gamificacao" aria-labelledby="painel-gamificacao">
        <h2 id="painel-gamificacao" class="bloco-titulo">${t('gamificacao.titulo')}</h2>
        <div class="nivel">
            <span class="nivel-selo" data-progresso="${percentualNivel}" aria-hidden="true"><span>${icone('star')}</span></span>
            <div>
                <p class="nivel-nome"><span class="sr-only">${t('gamificacao.nivel')}: </span>${nome}</p>
                <p class="nivel-pontos">${formatarNumero(g.pontos)} <span>${t('gamificacao.pontos').toLowerCase()}</span></p>
            </div>
        </div>
        <p class="bloco-nota" id="nivel-falta">${g.proximo ? t('gamificacao.faltam', { pontos: formatarNumero(g.proximo - g.pontos), proximo: niveis[g.nivel + 1] }) : t('gamificacao.nivelMaximo')}</p>
        ${barra(percentualNivel, 'nivel-falta')}

        <dl class="mini-indicadores">
            <div><dt>${icone('flame', 'icone icone--p')}${t('gamificacao.sequencia')}</dt><dd>${dias}</dd></div>
            <div><dt>${icone('target', 'icone icone--p')}${t('gamificacao.desafio')}</dt>
                <dd>${g.desafio.cumprido ? t('gamificacao.desafioCumprido') : t('gamificacao.desafioProgresso', { feito: g.desafio.feito, meta: g.desafio.meta })}</dd></div>
        </dl>
        <p class="bloco-nota">${t('gamificacao.desafioTexto', { meta: g.desafio.meta, pontos: PONTOS.desafio })}</p>

        <h3 class="subbloco-titulo">${t('gamificacao.conquistas')}</h3>
        <ul class="conquistas" role="list">
            ${conquistas.map(([chave, obtida]) => html`<li class="conquista ${obtida ? 'conquista--obtida' : ''}">
                <span class="conquista-icone" aria-hidden="true">${icone(obtida ? 'award' : 'lock', 'icone icone--p')}</span>
                <span class="conquista-texto">
                    <span class="conquista-nome">${t(`gamificacao.conquista.${chave}.nome`)}</span>
                    <span class="conquista-descricao">${t(`gamificacao.conquista.${chave}.descricao`)} · ${obtida ? t('gamificacao.obtida') : t('gamificacao.bloqueada')}</span>
                </span>
            </li>`)}
        </ul>

        <details class="regras-pontos">
            <summary>${t('gamificacao.regras')}</summary>
            <ul class="lista-marcada">
                <li>${t('gamificacao.regraAula')}: +${PONTOS.aula}</li>
                <li>${t('gamificacao.regraAvaliacao')}: +${PONTOS.avaliacao}</li>
                <li>${t('gamificacao.regraNota')}: +${PONTOS.notaMaxima}</li>
                <li>${t('gamificacao.regraCurso')}: +${PONTOS.curso}</li>
                <li>${t('gamificacao.regraDesafio')}: +${PONTOS.desafio}</li>
            </ul>
        </details>
    </section>`;
}

function blocoRanking(ranking) {
    const top = ranking.itens.slice(0, 5);
    const voceFora = ranking.voce && !top.some((r) => r.voce) ? ranking.voce : null;
    const linha = (r) => html`<li class="ranking-item ${r.voce ? 'ranking-item--voce' : ''}">
        <span class="ranking-posicao">${t('gamificacao.posicao', { n: r.posicao })}</span>
        ${avatar(r.nome)}
        <span class="linha-principal">${r.nome}${r.voce ? html` <span class="selo selo--marca">${t('comum.voce')}</span>` : ''}</span>
        <span class="ranking-pontos">${t('gamificacao.pontosDe', { n: formatarNumero(r.pontos) })}</span>
    </li>`;
    return html`<section class="painel-bloco" aria-labelledby="painel-ranking">
        <div class="bloco-cabecalho bloco-cabecalho--linha">
            <h2 id="painel-ranking" class="bloco-titulo">${t('painel.rankingMes')}</h2>
            <a href="#/ranking">${t('painel.verTodas')}</a>
        </div>
        ${top.some((r) => r.pontos > 0) ? html`<ol class="ranking" role="list">${top.map(linha)}</ol>
            ${voceFora ? html`<p class="ranking-separador" aria-hidden="true">···</p><ol class="ranking" role="list">${linha(voceFora)}</ol>` : ''}`
            : html`<p class="vazio">${t('gamificacao.rankingVazio')}</p>`}
    </section>`;
}

// --------------------------------------------------- cultura e kaizen --

/** Convite para responder o diagnóstico de cultura que está aberto. */
function blocoPesquisaPendente(pendentes) {
    if (!pendentes?.length) return '';
    const d = pendentes[0];
    return html`<section class="chamada" aria-labelledby="painel-pesquisa">
        <span class="chamada-icone" aria-hidden="true">${icone('bussola')}</span>
        <div class="chamada-texto">
            <h2 id="painel-pesquisa" class="bloco-titulo">${t('painel.pesquisaTitulo')}</h2>
            <p class="bloco-nota">${t('painel.pesquisaTexto', { titulo: d.titulo, min: Math.max(3, Math.round(d.perguntas / 4)) })}</p>
        </div>
        <a class="botao botao--primario" href="#/cultura/${d.id}/responder">${t('cultura.responder')}${icone('arrow', 'icone icone--p')}</a>
    </section>`;
}

/** Retrato da cultura da empresa (gestor): nota geral, nível e adesão do diagnóstico mais recente. */
function blocoCulturaEmpresa(cultura) {
    if (!cultura) {
        return html`<section class="painel-bloco" aria-labelledby="painel-cultura">
            <h2 id="painel-cultura" class="bloco-titulo">${t('painel.culturaTitulo')}</h2>
            <p class="bloco-nota">${t('painel.culturaVazia')}</p>
            <a class="botao botao--primario botao--p" href="#/cultura/novo">${t('cultura.lancarPrimeiro')}</a>
        </section>`;
    }
    const { d, r } = cultura;
    return html`<section class="painel-bloco" aria-labelledby="painel-cultura">
        <div class="bloco-cabecalho bloco-cabecalho--linha">
            <h2 id="painel-cultura" class="bloco-titulo">${t('painel.culturaTitulo')}</h2>
            <a href="#/cultura/${d.id}">${t('cultura.verResultado')}</a>
        </div>
        <p class="bloco-nota">${d.titulo}</p>
        ${r.oculto ? html`<p class="nota">${icone('lock', 'icone icone--p')}${t('cultura.aguardando', { n: r.respondentes, min: r.anonimatoMinimo })}</p>` : html`
            <div class="cultura-resumo">
                <span class="cultura-resumo-nota">${r.geral}</span>
                ${seloLeitura(r.geral, d)}
            </div>
            <ul class="barras-lista" role="list">${[...(r.dimensoes ?? [])].filter((x) => x.score !== null).sort((a, b) => a.score - b.score).slice(0, 3).map((x) => html`<li>
                <span class="barras-rotulo">${d.dimensoes?.find((y) => y.id === x.id)?.nome ?? x.id}</span>${barraNota(x.score)}
            </li>`)}</ul>
            <p class="bloco-nota">${t('painel.culturaFracas')}</p>`}
    </section>`;
}

function blocoCulturaCarregando() {
    return html`<section class="painel-bloco" aria-labelledby="painel-cultura">
        <h2 id="painel-cultura" class="bloco-titulo">${t('painel.culturaTitulo')}</h2>
        <p class="bloco-nota">${t('comum.carregando')}</p>
    </section>`;
}

/** Pipeline do kaizen: quantos em cada etapa e os que aguardam a verificação do gestor. */
function blocoKaizen(kaizens, usuario) {
    const ativos = kaizens.filter((k) => k.etapa !== 'arquivado');
    const aVerificar = usuario.perfil === 'company_admin' ? ativos.filter((k) => k.etapa === 'verificar') : [];
    const meus = usuario.perfil === 'student' ? ativos.filter((k) => [k.autorId, k.responsavelId, ...k.membros].includes(usuario.id)) : [];
    return html`<section class="painel-bloco" aria-labelledby="painel-kaizen">
        <div class="bloco-cabecalho bloco-cabecalho--linha">
            <h2 id="painel-kaizen" class="bloco-titulo">${t('painel.kaizenTitulo')}</h2>
            <a href="#/kaizen">${t('painel.verTodas')}</a>
        </div>
        ${ativos.length ? html`
            <ol class="funil" role="list">${ETAPAS_KAIZEN.map((e) => html`<li class="funil-etapa"><span class="funil-numero">${ativos.filter((k) => k.etapa === e).length}</span><span class="funil-nome">${t(`kaizen.etapas.${e}`)}</span></li>`)}</ol>
            ${aVerificar.length ? html`<p class="nota nota--aviso">${icone('clock', 'icone icone--p')}${t('painel.kaizenVerificar', { n: aVerificar.length })}</p>` : ''}
            ${meus.length ? html`<ul class="linhas" role="list">${meus.slice(0, 3).map((k) => html`<li class="linha linha--compacta">
                <span class="linha-principal"><a class="linha-link" href="#/kaizen/${k.id}">${codigoKaizen(k.numero)} · ${k.titulo}</a><span class="linha-sub">${t(`kaizen.etapas.${k.etapa}`)}</span></span>
            </li>`)}</ul>` : ''}`
            : html`<p class="bloco-nota">${t('painel.kaizenVazio')}</p>`}
        <a class="botao botao--secundario botao--p" href="#/kaizen/novo">${icone('lampada', 'icone icone--p')}${t('kaizen.novo')}</a>
    </section>`;
}

/** Carteira da consultoria: engajamento, maturidade e kaizen de cada empresa (as que pedem atenção primeiro). */
function blocoCarteira(carteira) {
    if (!carteira?.length) return '';
    const ordenada = [...carteira].sort((a, b) => a.indice - b.indice);
    return html`<section class="painel-bloco" aria-labelledby="painel-carteira">
        <div class="bloco-cabecalho bloco-cabecalho--linha">
            <h2 id="painel-carteira" class="bloco-titulo">${t('painel.carteiraTitulo')}</h2>
            <a href="#/cultura">${t('painel.verPanorama')}</a>
        </div>
        <p class="bloco-nota">${t('painel.carteiraNota')}</p>
        <div class="tabela-rolagem" tabindex="0" role="region" aria-labelledby="painel-carteira">
            <table class="tabela tabela--cartoes">
                <thead><tr>
                    <th scope="col">${t('comum.empresa')}</th>
                    <th scope="col">${t('painel.engajamento')}</th>
                    <th scope="col">${t('painel.maturidade')}</th>
                    <th scope="col" class="num">${t('painel.kaizens')}</th>
                </tr></thead>
                <tbody>${ordenada.map((e) => html`<tr>
                    <th scope="row"><a class="linha-link" href="#/empresas/${e.id}">${e.nome}</a><span class="linha-sub">${t('painel.ativos30', { n: e.ativos30, total: e.pessoas })}</span></th>
                    <td data-rotulo="${t('painel.engajamento')}">${barraNota(e.indice, t('painel.engajamento'))}</td>
                    <td data-rotulo="${t('painel.maturidade')}">${e.maturidade?.geral !== null && e.maturidade?.geral !== undefined
                        ? html`<a class="linha-link" href="#/cultura/${e.maturidade.diagnosticoId}">${e.maturidade.geral}</a> ${seloLeitura(e.maturidade.geral, e.maturidade)}`
                        : html`<a class="secao-link" href="#/cultura/novo?empresa=${e.id}">${t('cultura.lancar')}</a>`}</td>
                    <td class="num" data-rotulo="${t('painel.kaizens')}">${formatarNumero(e.kaizensAbertos)}<span class="linha-sub">${tn('painel.kaizenConcluidoUm', 'painel.kaizensConcluidos', e.kaizensConcluidos)}</span></td>
                </tr>`)}</tbody>
            </table>
        </div>
    </section>`;
}

/** O valor da promessa se ela já terminou (ou termina em `ms`); senão `undefined`, sem esperar. */
async function seJaPronto(promessa, ms = 40) {
    const pendente = Symbol('pendente');
    const valor = await Promise.race([promessa, new Promise((ok) => setTimeout(() => ok(pendente), ms))]);
    return valor === pendente ? undefined : valor;
}

async function culturaDaEmpresa() {
    const lista = await dados.listarDiagnosticos();
    const d = lista.find((x) => x.respondentes > 0) ?? lista[0];
    if (!d) return null;
    return { d, r: await dados.resultadoDiagnostico(d.id) };
}

// ------------------------------------------------------------ gestão --

/** Atalhos do que quem gere faz todo dia: cada um leva direto à tela certa. */
function blocoAcoes(usuario) {
    const gestor = usuario.perfil === 'company_admin';
    const acoes = [
        gestor ? null : { href: '#/empresas/nova', icone: 'building', chave: 'novaEmpresa', pode: pode(usuario, 'gerir-empresas') },
        { href: '#/cursos', icone: 'book', chave: gestor ? 'atribuir' : 'cursos', pode: true },
        { href: '#/cultura/novo', icone: 'bussola', chave: 'diagnostico', pode: pode(usuario, 'gerir-diagnosticos') },
        { href: '#/pessoas', icone: 'send', chave: 'convidar', pode: pode(usuario, 'ver-pessoas') },
        gestor ? { href: '#/kaizen', icone: 'ciclo', chave: 'kaizen', pode: pode(usuario, 'ver-kaizen') } : null,
        { href: '#/relatorios', icone: 'chart', chave: 'relatorios', pode: pode(usuario, 'ver-relatorios') },
    ].filter((a) => a?.pode);
    return html`<section class="secao" aria-labelledby="painel-acoes">
        <h2 id="painel-acoes" class="sr-only">${t('gestao.acoesTitulo')}</h2>
        <ul class="atalhos" role="list">
            ${acoes.map((a) => html`<li><a class="atalho" href="${a.href}">
                <span class="atalho-icone" aria-hidden="true">${icone(a.icone)}</span>
                <span class="atalho-texto"><strong>${t(`gestao.acoes.${a.chave}.titulo`)}</strong><span>${t(`gestao.acoes.${a.chave}.texto`)}</span></span>
                ${icone('arrow', 'icone icone--p atalho-seta')}
            </a></li>`)}
        </ul>
    </section>`;
}

/** Quanto da turma já concluiu cada curso. */
function blocoProgressoCursos(porCurso) {
    return html`<section class="painel-bloco" aria-labelledby="painel-progresso-cursos">
        <div class="bloco-cabecalho bloco-cabecalho--linha">
            <h2 id="painel-progresso-cursos" class="bloco-titulo">${t('gestao.progressoTitulo')}</h2>
            <a href="#/relatorios">${t('painel.verTodas')}</a>
        </div>
        ${porCurso.length ? html`<ul class="progresso-cursos" role="list">
            ${porCurso.map((c, i) => html`<li class="progresso-curso">
                ${capa({ id: c.cursoId }, null, { classe: 'progresso-curso-capa' })}
                <div class="progresso-curso-corpo">
                    <a class="progresso-curso-nome" href="#/cursos/${c.cursoId}">${c.curso}</a>
                    <p class="progresso-curso-sub" id="pc-${i}">${t('gestao.concluiram', { feitos: formatarNumero(c.concluidos), total: formatarNumero(c.matriculados) })}</p>
                    ${barra(Math.round(c.taxa * 100), `pc-${i}`)}
                </div>
                <span class="progresso-curso-pct">${formatarPercentual(c.taxa)}</span>
            </li>`)}
        </ul>` : html`<div class="vazio-acao">
            <p class="vazio">${t('gestao.semMatriculas')}</p>
            <a class="botao botao--primario botao--p" href="#/cursos">${t('gestao.acoes.atribuir.titulo')}</a>
        </div>`}
    </section>`;
}

/** Quem está parado ou ainda não começou: onde o gestor deve agir primeiro. */
function blocoAtencao(linhas, equipe) {
    const ordem = { atrasado: 0, naoIniciado: 1 };
    const itens = linhas.filter((l) => l.situacao in ordem).sort((a, b) => ordem[a.situacao] - ordem[b.situacao]).slice(0, 6);
    return html`<section class="painel-bloco" aria-labelledby="painel-atencao">
        <div class="bloco-cabecalho">
            <h2 id="painel-atencao" class="bloco-titulo">${t('gestao.atencaoTitulo')}</h2>
            <p class="bloco-nota">${t('gestao.atencaoNota')}</p>
        </div>
        ${itens.length ? html`<ul class="linhas" role="list">
            ${itens.map((l) => html`<li class="linha">
                ${avatar(l.pessoa)}
                <span class="linha-principal">${l.pessoa}<span class="linha-sub">${l.curso}${equipe ? ` · ${l.empresa}` : ''}</span></span>
                <span class="selo ${l.situacao === 'atrasado' ? 'selo--perigo' : 'selo--neutro'}">${t(`relatorios.situacoes.${l.situacao}`)}</span>
            </li>`)}
        </ul>` : html`<p class="tudo-certo">${icone('check', 'icone icone--p')}${t('gestao.tudoEmDia')}</p>`}
    </section>`;
}

function blocoAtividade(eventos) {
    return html`<section class="painel-bloco" aria-labelledby="painel-atividade">
        <div class="bloco-cabecalho"><h2 id="painel-atividade" class="bloco-titulo">${t('painel.atividade')}</h2></div>
        ${eventos.length === 0
            ? html`<p class="vazio">${t('painel.semAtividade')}</p>`
            : html`<ol class="atividade" role="list">
                ${eventos.map((e) => html`
                    <li class="atividade-item">
                        <p class="atividade-frase">${fraseAtividade(e)}</p>
                        <p class="atividade-meta"><time datetime="${e.em}">${formatarRelativo(e.em)}</time>${e.empresa ? html` · ${e.empresa}` : ''}</p>
                    </li>`)}
            </ol>`}
    </section>`;
}

export async function tela({ usuario, empresa }) {
    const estuda = podeEstudar(usuario.perfil);
    const gere = pode(usuario, 'ver-relatorios');
    const gestor = usuario.perfil === 'company_admin';
    const equipe = ehEquipe(usuario.perfil);
    // Blocos de cultura, kaizen e ranking são extras: se falharem, o painel continua.
    const opcional = (promessa) => promessa.catch((erro) => {
        console.error(erro);
        return null;
    });
    // A cultura da empresa precisa de duas idas em fila: não segura o painel; entra quando chega.
    const culturaPromessa = gestor ? opcional(culturaDaEmpresa()) : null;
    const [resumo, atividade, cursos, gamificacao, ranking, relatorio, carteira, pendentes, kaizens] = await Promise.all([
        dados.resumoPainel(usuario),
        dados.atividadeRecente(usuario, 6),
        estuda ? dados.listarCursos(usuario) : [],
        estuda && !gestor ? dados.perfilGamificacao(usuario) : null,
        usuario.empresaId ? opcional(dados.rankingEmpresa({ periodo: 'mes' })) : null,
        gere ? dados.relatorio(usuario) : null,
        equipe ? opcional(dados.panoramaEmpresas()) : null,
        usuario.empresaId ? opcional(dados.diagnosticosPendentes()) : null,
        usuario.empresaId ? opcional(dados.listarKaizens()) : null,
    ]);
    const cultura = gestor ? await seJaPronto(culturaPromessa) : undefined;

    // "Continue de onde parou": um curso em andamento (o mais avançado primeiro).
    const emAndamento = cursos.filter((c) => c.progresso?.matriculado && !c.progresso.concluido)
        .sort((a, b) => b.progresso.feitas - a.progresso.feitas)[0] ?? null;
    // A próxima aula já vem na lista de cursos (sem outra ida ao servidor).
    const proximaAula = emAndamento?.progresso.proximaAulaId
        ? { id: emAndamento.progresso.proximaAulaId, titulo: emAndamento.progresso.proximaAulaTitulo }
        : null;

    const subtitulo = [t(`perfis.${usuario.perfil}`), empresa?.nome, formatarData(new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })]
        .filter(Boolean).join(' · ');

    // Quem gere (gestor e equipe) vê primeiro a turma; o aluno vê primeiro o próprio aprendizado.
    const principal = gere ? [
        equipe ? blocoCarteira(carteira) : '',
        blocoProgressoCursos(relatorio.porCurso),
        blocoAtencao(relatorio.linhas, equipe),
        estuda ? blocoMeusCursos(cursos, t('gestao.seusCursos')) : '',
    ] : [
        blocoMeusCursos(cursos),
        kaizens ? blocoKaizen(kaizens, usuario) : '',
        blocoAtividade(atividade),
    ];
    const lateral = [
        gestor ? html`<div data-cultura-empresa>${cultura === undefined ? blocoCulturaCarregando() : blocoCulturaEmpresa(cultura)}</div>` : '',
        gestor && kaizens ? blocoKaizen(kaizens, usuario) : '',
        gamificacao ? blocoGamificacao(gamificacao) : '',
        ranking ? blocoRanking(ranking) : '',
        gere ? blocoAtividade(atividade) : '',
    ];

    return {
        titulo: t('painel.titulo'),
        conteudo: html`
            <header class="cabecalho">
                <h1 class="titulo" tabindex="-1">${t('painel.ola', { nome: primeiroNome(usuario.nome) })}</h1>
                <p class="subtitulo">${subtitulo}</p>
            </header>
            ${blocoPesquisaPendente(pendentes)}
            ${blocoIndicadores(usuario, resumo)}
            ${gere ? blocoAcoes(usuario) : ''}
            ${estuda && !gere ? blocoContinuar(emAndamento, proximaAula, cursos.some((c) => c.progresso?.concluido)) : ''}
            <div class="painel-grade">
                <div class="painel-coluna">${principal}</div>
                <div class="painel-coluna painel-coluna--lateral">${lateral}</div>
            </div>`,
        montar(raiz) {
            const lugar = raiz.querySelector('[data-cultura-empresa]');
            if (lugar && cultura === undefined) culturaPromessa.then((c) => { if (lugar.isConnected) desenharEm(lugar, blocoCulturaEmpresa(c)); });
        },
    };
}
