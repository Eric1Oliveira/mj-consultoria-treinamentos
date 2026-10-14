// Painel inicial. Muda conforme o perfil; tudo vem de dados.js (cursos, pontos, matrículas).

import * as dados from '../dados.js';
import { ehEquipe, podeEstudar, primeiroNome, PONTOS, NIVEIS } from '../regras.js';
import { t, formatarNumero, formatarPercentual, formatarData, formatarRelativo } from '../textos.js';
import { html, icone, avatar, fraseAtividade } from '../app.js';
import { trilhaDoCurso, barra, rotuloAcao } from './cursos.js';

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

function blocoContinuar(curso, proximaAula) {
    if (!curso) {
        return html`<section class="painel-bloco trilha-bloco" aria-labelledby="painel-continuar">
            <h2 id="painel-continuar" class="bloco-titulo">${t('painel.continuar')}</h2>
            <p class="vazio">${t('painel.semCursos')}</p>
            <a class="botao botao--primario" href="#/cursos">${t('painel.verCursos')}</a>
        </section>`;
    }
    const p = curso.progresso;
    const acao = proximaAula
        ? html`<a class="botao botao--primario" href="#/cursos/${curso.id}/aula/${proximaAula.id}">${p.feitas ? t('painel.continuarAula') : rotuloAcao(p)}${icone('arrow', 'icone icone--p')}</a>`
        : html`<a class="botao botao--primario" href="#/cursos/${curso.id}/avaliacao">${t('painel.fazerAvaliacao')}</a>`;
    return html`<section class="painel-bloco trilha-bloco" aria-labelledby="painel-continuar">
        <div class="bloco-cabecalho">
            <h2 id="painel-continuar" class="bloco-titulo">${t('painel.continuar')}</h2>
            <p class="bloco-nota">${curso.titulo}</p>
        </div>
        <div class="trilha-visual">${trilhaDoCurso(p)}</div>
        <p class="trilha-progresso" id="painel-progresso">${t('painel.progressoAulas', { feitas: p.feitas, total: p.total })}</p>
        ${barra(p.percentual, 'painel-progresso')}
        <p class="continuar-proxima">${proximaAula ? t('painel.proximaAula', { titulo: proximaAula.titulo }) : t('painel.faltaAvaliacao')}</p>
        ${acao}
    </section>`;
}

function blocoMeusCursos(cursos) {
    const meus = cursos.filter((c) => c.progresso?.matriculado);
    if (!meus.length) return '';
    return html`<section class="painel-bloco" aria-labelledby="painel-meus-cursos">
        <div class="bloco-cabecalho bloco-cabecalho--linha">
            <h2 id="painel-meus-cursos" class="bloco-titulo">${t('painel.meusCursos')}</h2>
            <a href="#/cursos">${t('painel.verTodas')}</a>
        </div>
        <ul class="linhas" role="list">
            ${meus.map((c) => html`<li class="linha">
                <span class="curso-icone curso-icone--p" aria-hidden="true">${icone(c.progresso.concluido ? 'award' : 'book')}</span>
                <a class="linha-principal linha-link" href="#/cursos/${c.id}">${c.titulo}
                    <span class="linha-sub">${c.progresso.concluido ? t('painel.concluido') : t('painel.progressoAulas', { feitas: c.progresso.feitas, total: c.progresso.total })}</span>
                </a>
                <span class="linha-meta linha-meta--num">${formatarPercentual(c.progresso.percentual / 100)}</span>
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
            <span class="nivel-selo" aria-hidden="true">${icone('star')}</span>
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

function blocoPessoas(pessoas) {
    return html`<section class="painel-bloco" aria-labelledby="painel-pessoas">
        <div class="bloco-cabecalho bloco-cabecalho--linha">
            <h2 id="painel-pessoas" class="bloco-titulo">${t('painel.pessoasTitulo')}</h2>
            <a href="#/pessoas">${t('painel.verTodas')}</a>
        </div>
        <ul class="linhas" role="list">
            ${pessoas.map((p) => html`
                <li class="linha">
                    ${avatar(p.nome)}
                    <span class="linha-principal">${p.nome}<span class="linha-sub">${t(`perfis.${p.perfil}`)}</span></span>
                    <span class="linha-meta">${p.ultimoAcesso ? t('painel.ultimoAcesso', { quando: formatarRelativo(p.ultimoAcesso) }) : t('painel.nuncaEntrou')}</span>
                    ${p.ativo ? '' : html`<span class="selo selo--neutro">${t('painel.inativo')}</span>`}
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
    const [resumo, atividade, cursos, gamificacao, ranking] = await Promise.all([
        dados.resumoPainel(usuario),
        dados.atividadeRecente(usuario, 6),
        estuda ? dados.listarCursos(usuario) : [],
        estuda ? dados.perfilGamificacao(usuario) : null,
        usuario.empresaId ? dados.rankingEmpresa(usuario) : null,
    ]);
    const empresas = ehEquipe(usuario.perfil) ? (await dados.listarEmpresas(usuario)).slice(0, 6) : null;
    const pessoas = usuario.perfil === 'company_admin' ? (await dados.listarPessoas(usuario, usuario.empresaId)).slice(0, 6) : null;

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

    const principal = [
        estuda ? blocoContinuar(emAndamento, proximaAula) : '',
        estuda ? blocoMeusCursos(cursos) : '',
        pessoas ? blocoPessoas(pessoas) : '',
        empresas ? blocoEmpresas(empresas) : '',
    ];
    const lateral = [
        gamificacao ? blocoGamificacao(gamificacao) : '',
        ranking ? blocoRanking(ranking) : '',
        blocoAtividade(atividade),
    ];

    return {
        titulo: t('painel.titulo'),
        conteudo: html`
            <header class="cabecalho">
                <h1 class="titulo" tabindex="-1">${t('painel.ola', { nome: primeiroNome(usuario.nome) })}</h1>
                <p class="subtitulo">${subtitulo}</p>
            </header>
            ${blocoIndicadores(usuario, resumo)}
            <div class="painel-grade">
                <div class="painel-coluna">${principal}</div>
                <div class="painel-coluna painel-coluna--lateral">${lateral}</div>
            </div>`,
    };
}
