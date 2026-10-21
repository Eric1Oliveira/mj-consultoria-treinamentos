// Painel inicial. Muda conforme o perfil; tudo vem de dados.js (cursos, pontos, matrículas).

import * as dados from '../dados.js';
import { ehEquipe, podeEstudar, primeiroNome, pode, PONTOS, NIVEIS } from '../regras.js';
import { t, formatarNumero, formatarPercentual, formatarData, formatarRelativo } from '../textos.js';
import { html, icone, avatar, fraseAtividade, capa, mapaSvg } from '../app.js';
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
    return html`<section class="painel-bloco" aria-labelledby="painel-ranking">
        <div class="bloco-cabecalho">
            <h2 id="painel-ranking" class="bloco-titulo">${t('gamificacao.ranking')}</h2>
            <p class="bloco-nota">${t('gamificacao.rankingNota')}</p>
        </div>
        ${ranking.some((r) => r.pontos > 0) ? html`<ol class="ranking" role="list">
            ${ranking.map((r) => html`<li class="ranking-item ${r.voce ? 'ranking-item--voce' : ''}">
                <span class="ranking-posicao">${t('gamificacao.posicao', { n: r.posicao })}</span>
                ${avatar(r.nome)}
                <span class="linha-principal">${r.nome}${r.voce ? html` <span class="selo selo--marca">${t('comum.voce')}</span>` : ''}</span>
                <span class="ranking-pontos">${t('gamificacao.pontosDe', { n: formatarNumero(r.pontos) })}</span>
            </li>`)}
        </ol>` : html`<p class="vazio">${t('gamificacao.rankingVazio')}</p>`}
    </section>`;
}

// ------------------------------------------------------------ gestão --

/** Atalhos do que quem gere faz todo dia: cada um leva direto à tela certa. */
function blocoAcoes(usuario) {
    const gestor = usuario.perfil === 'company_admin';
    const acoes = [
        gestor ? null : { href: '#/empresas/nova', icone: 'building', chave: 'novaEmpresa', pode: pode(usuario, 'gerir-empresas') },
        { href: '#/cursos', icone: 'book', chave: gestor ? 'atribuir' : 'cursos', pode: true },
        { href: '#/pessoas', icone: 'send', chave: 'convidar', pode: pode(usuario, 'ver-pessoas') },
        gestor ? { href: '#/marca', icone: 'palette', chave: 'marca', pode: pode(usuario, 'personalizar-marca') } : null,
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

function blocoEmpresas(empresas) {
    return html`<section class="painel-bloco" aria-labelledby="painel-empresas">
        <div class="bloco-cabecalho bloco-cabecalho--linha">
            <h2 id="painel-empresas" class="bloco-titulo">${t('painel.empresasTitulo')}</h2>
            <a href="#/empresas">${t('painel.verTodas')}</a>
        </div>
        <ul class="linhas" role="list">
            ${empresas.map((e) => html`
                <li class="linha">
                    <span class="ponto-cor" data-cor="${e.cor ?? ''}" aria-hidden="true"></span>
                    <span class="linha-principal">${e.nome}</span>
                    <span class="linha-meta">${t('painel.pessoasAtivasEmpresa', { n: formatarNumero(e.pessoasAtivas) })}</span>
                    ${e.ativa ? '' : html`<span class="selo selo--neutro">${t('painel.inativa')}</span>`}
                </li>`)}
        </ul>
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
    const [resumo, atividade, cursos, gamificacao, ranking, relatorio, todasEmpresas] = await Promise.all([
        dados.resumoPainel(usuario),
        dados.atividadeRecente(usuario, 6),
        estuda ? dados.listarCursos(usuario) : [],
        estuda && !gestor ? dados.perfilGamificacao(usuario) : null,
        usuario.empresaId ? dados.rankingEmpresa(usuario) : null,
        gere ? dados.relatorio(usuario) : null,
        ehEquipe(usuario.perfil) ? dados.listarEmpresas(usuario) : null,
    ]);
    const empresas = todasEmpresas?.slice(0, 6) ?? null;

    // "Continue de onde parou": um curso em andamento (o mais avançado primeiro).
    const emAndamento = cursos.filter((c) => c.progresso?.matriculado && !c.progresso.concluido)
        .sort((a, b) => b.progresso.feitas - a.progresso.feitas)[0] ?? null;
    let proximaAula = null;
    if (emAndamento?.progresso.proximaAulaId) {
        const detalhe = await dados.obterCurso(usuario, emAndamento.id);
        proximaAula = detalhe.modulos.flatMap((m) => m.aulas).find((a) => a.id === emAndamento.progresso.proximaAulaId) ?? null;
    }

    const subtitulo = [t(`perfis.${usuario.perfil}`), empresa?.nome, formatarData(new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })]
        .filter(Boolean).join(' · ');

    // Quem gere (gestor e equipe) vê primeiro a turma; o aluno vê primeiro o próprio aprendizado.
    const principal = gere ? [
        blocoProgressoCursos(relatorio.porCurso),
        blocoAtencao(relatorio.linhas, ehEquipe(usuario.perfil)),
        empresas ? blocoEmpresas(empresas) : '',
        estuda ? blocoMeusCursos(cursos, t('gestao.seusCursos')) : '',
    ] : [
        blocoMeusCursos(cursos),
        blocoAtividade(atividade),
    ];
    const lateral = [
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
            ${blocoIndicadores(usuario, resumo)}
            ${gere ? blocoAcoes(usuario) : ''}
            ${estuda && !gere ? blocoContinuar(emAndamento, proximaAula, cursos.some((c) => c.progresso?.concluido)) : ''}
            <div class="painel-grade">
                <div class="painel-coluna">${principal}</div>
                <div class="painel-coluna painel-coluna--lateral">${lateral}</div>
            </div>`,
    };
}
