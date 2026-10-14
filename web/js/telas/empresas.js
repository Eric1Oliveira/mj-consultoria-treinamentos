// Empresas: lista com busca, cadastro/edição (com logotipo e cor) e a página pública de cada empresa.

import * as dados from '../dados.js';
import { COR_PADRAO, corValida, contrasteComBranco, corLegivel, iniciais } from '../regras.js';
import { t, formatarNumero } from '../textos.js';
import { html, icone, avatar, opcao, anunciar, irPara, mostrarErro, limparErros, desenharEm, enderecoDe } from '../app.js';

const filtro = { busca: '', situacao: 'todas' };

function marcaEmpresa(empresa) {
    return empresa.logo
        ? html`<img class="empresa-logo" src="${empresa.logo}" alt="">`
        : html`<span class="empresa-selo" data-cor="${empresa.cor ?? ''}" aria-hidden="true">${iniciais(empresa.nome)}</span>`;
}

function listaEmpresas(empresas) {
    if (!empresas.length) return html`<p class="vazio">${t('empresas.nenhuma')}</p>`;
    return html`<ul class="linhas" role="list">
        ${empresas.map((e) => html`
            <li class="linha">
                ${marcaEmpresa(e)}
                <span class="linha-principal">${e.nome}<span class="linha-sub">${e.identificador} · ${t('empresas.pessoasAtivas', { n: formatarNumero(e.pessoasAtivas) })}</span></span>
                ${e.ativa ? '' : html`<span class="selo selo--neutro">${t('empresas.inativa')}</span>`}
                <span class="linha-acoes">
                    <a class="botao botao--secundario botao--p" href="#/pessoas/${e.id}">${t('empresas.funcionarios')}<span class="sr-only"> – ${e.nome}</span></a>
                    ${e.ativa ? html`<a class="botao botao--secundario botao--p" href="#/e/${e.identificador}">${t('empresas.paginaPublica')}<span class="sr-only"> – ${e.nome}</span></a>` : ''}
                    <a class="botao botao--secundario botao--p" href="#/empresas/${e.id}">${t('comum.editar')}<span class="sr-only"> – ${e.nome}</span></a>
                </span>
            </li>`)}
    </ul>`;
}

async function telaLista(usuario) {
    const empresas = await dados.listarEmpresas(usuario, filtro);
    return {
        titulo: t('empresas.titulo'),
        conteudo: html`
            <header class="cabecalho cabecalho--acoes">
                <div>
                    <h1 class="titulo" tabindex="-1">${t('empresas.titulo')}</h1>
                    <p class="subtitulo">${t('empresas.sub')}</p>
                </div>
                <a class="botao botao--primario" href="#/empresas/nova">${icone('plus')}${t('empresas.nova')}</a>
            </header>
            <section class="painel-bloco" aria-labelledby="empresas-lista-titulo">
                <h2 id="empresas-lista-titulo" class="sr-only">${t('empresas.titulo')}</h2>
                <form class="filtros" data-form="filtro" role="search">
                    <div class="campo campo--cresce">
                        <label for="empresas-busca">${t('empresas.buscaRotulo')}</label>
                        <input id="empresas-busca" name="busca" type="search" value="${filtro.busca}" autocomplete="off">
                    </div>
                    <div class="campo">
                        <label for="empresas-situacao">${t('comum.situacao')}</label>
                        <select id="empresas-situacao" name="situacao">
                            ${opcao('todas', t('comum.todas'), filtro.situacao === 'todas')}
                            ${opcao('ativas', t('comum.ativas'), filtro.situacao === 'ativas')}
                            ${opcao('inativas', t('comum.inativas'), filtro.situacao === 'inativas')}
                        </select>
                    </div>
                </form>
                <div data-lista aria-live="polite">${listaEmpresas(empresas)}</div>
            </section>`,
        montar(raiz) {
            const form = raiz.querySelector('[data-form="filtro"]');
            const atualizar = async () => {
                filtro.busca = form.busca.value;
                filtro.situacao = form.situacao.value;
                desenharEm(raiz.querySelector('[data-lista]'), listaEmpresas(await dados.listarEmpresas(usuario, filtro)));
            };
            form.addEventListener('input', atualizar);
            form.addEventListener('submit', (evento) => {
                evento.preventDefault();
                atualizar();
            });
        },
    };
}

// ---------------------------------------------------------------- editor --

function textoContraste(cor) {
    if (!corValida(cor)) return '';
    const razao = contrasteComBranco(cor).toFixed(1);
    return `${t('empresas.contraste', { razao })} — ${corLegivel(cor) ? t('empresas.contrasteOk') : t('empresas.contrasteRuim')}`;
}

async function telaEditor(usuario, id) {
    const existente = id ? await dados.obterEmpresa(id) : null;
    if (id && !existente) throw new dados.ErroDados('nao-encontrado');
    const e = existente ?? { nome: '', identificador: '', cor: null, mensagem: '', logo: null, ativa: true, solicitacoesAtivas: true, aprovador: 'empresa' };
    const corInicial = e.cor ?? COR_PADRAO;
    let logo = e.logo;

    return {
        titulo: existente ? t('empresas.editarTitulo') : t('empresas.novaTitulo'),
        conteudo: html`
            <a class="voltar" href="#/empresas">${icone('back', 'icone icone--p')}${t('empresas.voltar')}</a>
            <header class="cabecalho">
                <h1 class="titulo" tabindex="-1">${existente ? existente.nome : t('empresas.novaTitulo')}</h1>
                ${existente ? html`<p class="subtitulo">${t('empresas.editarTitulo')}</p>` : ''}
            </header>
            <form class="formulario" data-form="empresa" novalidate>
                <fieldset class="secao-form">
                    <legend class="bloco-titulo">${t('empresas.secaoDados')}</legend>
                    <div class="campo">
                        <label for="empresa-nome">${t('empresas.nome')}</label>
                        <input id="empresa-nome" name="nome" value="${e.nome}" maxlength="150" required autocomplete="organization">
                    </div>
                    <div class="campo">
                        <label for="empresa-identificador">${t('empresas.identificador')}</label>
                        <input id="empresa-identificador" name="identificador" value="${e.identificador}" maxlength="60" spellcheck="false" autocapitalize="none" aria-describedby="empresa-identificador-dica">
                        <p id="empresa-identificador-dica" class="campo-dica">${t('empresas.identificadorDica')} <span class="codigo" data-endereco>${enderecoDe(`e/${e.identificador || '…'}`)}</span></p>
                    </div>
                    <div class="campo">
                        <label for="empresa-mensagem">${t('empresas.mensagem')}</label>
                        <textarea id="empresa-mensagem" name="mensagem" rows="3" maxlength="300" aria-describedby="empresa-mensagem-dica">${e.mensagem}</textarea>
                        <p id="empresa-mensagem-dica" class="campo-dica">${t('empresas.mensagemDica')}</p>
                    </div>
                </fieldset>

                <fieldset class="secao-form">
                    <legend class="bloco-titulo">${t('empresas.secaoMarca')}</legend>
                    <div class="marca-grade">
                        <div class="formulario">
                            <label class="campo-check">
                                <input type="checkbox" name="usarCor" ${e.cor ? html`checked` : ''}>
                                <span>${t('empresas.usarCor')}</span>
                            </label>
                            <div class="campo">
                                <label for="empresa-cor">${t('empresas.cor')}</label>
                                <div class="cor-linha">
                                    <input id="empresa-cor" name="cor" type="color" value="${corInicial}" aria-describedby="empresa-cor-dica empresa-cor-contraste">
                                    <span class="cor-hex" data-hex>${corInicial}</span>
                                </div>
                                <p id="empresa-cor-contraste" class="campo-dica" data-contraste aria-live="polite">${textoContraste(corInicial)}</p>
                                <p id="empresa-cor-dica" class="campo-dica">${t('empresas.corDica')}</p>
                            </div>
                            <div class="campo">
                                <label for="empresa-logo">${t('empresas.logo')}</label>
                                <input id="empresa-logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="empresa-logo-dica">
                                <p id="empresa-logo-dica" class="campo-dica">${t('empresas.logoDica')}</p>
                                <button type="button" class="botao botao--secundario botao--p" data-remover-logo ${logo ? '' : html`hidden`}>${t('empresas.removerLogo')}</button>
                            </div>
                        </div>
                        <div class="previa" aria-labelledby="previa-titulo" role="group">
                            <p id="previa-titulo" class="previa-rotulo">${t('empresas.previa')}</p>
                            <div class="previa-cartao" data-previa>
                                <div class="previa-topo">
                                    <span data-previa-logo>${logo ? html`<img class="empresa-logo" src="${logo}" alt="">` : avatar(e.nome || '?')}</span>
                                    <strong data-previa-nome>${e.nome || t('empresas.nome')}</strong>
                                </div>
                                <span class="previa-botao">${t('empresas.previaBotao')}</span>
                                <p class="previa-texto">${t('empresas.previaTexto')}</p>
                            </div>
                        </div>
                    </div>
                </fieldset>

                <fieldset class="secao-form">
                    <legend class="bloco-titulo">${t('empresas.secaoAcesso')}</legend>
                    <label class="campo-check">
                        <input type="checkbox" name="solicitacoesAtivas" ${e.solicitacoesAtivas ? html`checked` : ''}>
                        <span>${t('empresas.solicitacoesAtivas')}</span>
                    </label>
                    <div class="campo">
                        <label for="empresa-aprovador">${t('empresas.aprovador')}</label>
                        <select id="empresa-aprovador" name="aprovador">
                            ${opcao('empresa', t('empresas.aprovadorEmpresa'), e.aprovador === 'empresa')}
                            ${opcao('consultoria', t('empresas.aprovadorConsultoria'), e.aprovador === 'consultoria')}
                        </select>
                    </div>
                    ${existente ? html`
                        <label class="campo-check">
                            <input type="checkbox" name="ativa" ${e.ativa ? html`checked` : ''} aria-describedby="empresa-ativa-dica">
                            <span>${t('empresas.ativa')}</span>
                        </label>
                        <p id="empresa-ativa-dica" class="campo-dica">${t('empresas.ativaDica')}</p>` : ''}
                </fieldset>

                <p class="campo-erro" data-resumo-erro role="alert" hidden></p>
                <div class="acoes">
                    <button type="submit" class="botao botao--primario">${existente ? t('comum.salvarAlteracoes') : t('empresas.criar')}</button>
                    <a class="botao botao--secundario" href="#/empresas">${t('comum.cancelar')}</a>
                </div>
            </form>`,

        montar(raiz) {
            const form = raiz.querySelector('[data-form="empresa"]');
            const previa = raiz.querySelector('[data-previa]');
            const pintar = () => {
                const cor = form.usarCor.checked ? form.cor.value : COR_PADRAO;
                previa.style.setProperty('--cor', corLegivel(cor) ? cor : COR_PADRAO);
                form.cor.disabled = !form.usarCor.checked;
                raiz.querySelector('[data-hex]').textContent = form.cor.value;
                raiz.querySelector('[data-contraste]').textContent = form.usarCor.checked ? textoContraste(form.cor.value) : '';
                raiz.querySelector('[data-previa-nome]').textContent = form.nome.value || t('empresas.nome');
                raiz.querySelector('[data-endereco]').textContent = enderecoDe(`e/${form.identificador.value || '…'}`);
            };
            pintar();
            form.addEventListener('input', pintar);

            const desenharLogo = () => {
                desenharEm(raiz.querySelector('[data-previa-logo]'), logo ? html`<img class="empresa-logo" src="${logo}" alt="">` : avatar(form.nome.value || '?'));
                raiz.querySelector('[data-remover-logo]').hidden = !logo;
            };
            form.logo.addEventListener('change', async () => {
                const arquivo = form.logo.files[0];
                if (!arquivo) return;
                limparErros(form);
                try {
                    logo = await dados.lerLogo(arquivo);
                    desenharLogo();
                } catch (erro) {
                    form.logo.value = '';
                    mostrarErro(erro, form);
                }
            });
            raiz.querySelector('[data-remover-logo]').addEventListener('click', () => {
                logo = null;
                form.logo.value = '';
                desenharLogo();
                anunciar(t('empresas.logoRemovido'));
                form.logo.focus();
            });

            form.addEventListener('submit', async (evento) => {
                evento.preventDefault();
                const botao = form.querySelector('[type="submit"]');
                botao.disabled = true;
                try {
                    const salva = await dados.salvarEmpresa(usuario, {
                        id: existente?.id,
                        nome: form.nome.value,
                        identificador: form.identificador.value,
                        cor: form.usarCor.checked ? form.cor.value : '',
                        mensagem: form.mensagem.value,
                        logo,
                        solicitacoesAtivas: form.solicitacoesAtivas.checked,
                        aprovador: form.aprovador.value,
                        ativa: existente ? form.ativa.checked : true,
                    });
                    anunciar(t(existente ? 'empresas.salva' : 'empresas.criada', { nome: salva.nome }));
                    Object.assign(filtro, { busca: '', situacao: 'todas' }); // a empresa salva tem de aparecer na lista
                    irPara('empresas');
                } catch (erro) {
                    mostrarErro(erro, form);
                } finally {
                    botao.disabled = false;
                }
            });
        },
    };
}

export async function tela({ usuario, parametros }) {
    const [id] = parametros;
    if (id === 'nova') return telaEditor(usuario, null);
    if (id) return telaEditor(usuario, id);
    return telaLista(usuario);
}

// ------------------------------------------------- página pública (#/e/x) --

export async function telaPublica({ parametros }) {
    const empresa = await dados.obterEmpresaPublica(parametros[0] ?? '');
    if (!empresa) {
        return {
            titulo: t('publico.naoEncontradaTitulo'),
            conteudo: html`<div class="login">
                <header class="cabecalho">
                    <h1 class="titulo" tabindex="-1">${t('publico.naoEncontradaTitulo')}</h1>
                    <p class="subtitulo">${t('publico.naoEncontradaTexto')}</p>
                </header>
                <a class="botao botao--secundario" href="#/login">${t('convite.irLogin')}</a>
            </div>`,
        };
    }

    return {
        titulo: empresa.nome,
        marca: empresa.cor,
        conteudo: html`
            <div class="login">
                <header class="cabecalho cabecalho--empresa">
                    ${marcaEmpresa(empresa)}
                    <div>
                        <h1 class="titulo" tabindex="-1">${empresa.nome}</h1>
                        <p class="subtitulo">${t('publico.sub')}</p>
                    </div>
                </header>
                ${empresa.mensagem ? html`<p class="empresa-mensagem">${empresa.mensagem}</p>` : ''}

                <section aria-labelledby="publico-entrar">
                    <h2 id="publico-entrar" class="bloco-titulo">${t('publico.entrarTitulo')}</h2>
                    <p class="bloco-nota">${t('publico.entrarTexto')}</p>
                    <ul class="pessoas-demo" role="list">
                        ${empresa.pessoasDemo.map((p) => html`<li>
                            <button type="button" class="perfil perfil--compacto" data-entrar-como="${p.id}">
                                ${avatar(p.nome, empresa.cor)}
                                <span class="perfil-texto">
                                    <span class="perfil-nome">${t('publico.entrarComo', { nome: p.nome })}</span>
                                    <span class="perfil-descricao">${t(`perfis.${p.perfil}`)}</span>
                                </span>
                            </button>
                        </li>`)}
                    </ul>
                </section>

                <section class="login-form" aria-labelledby="publico-pedir">
                    <h2 id="publico-pedir" class="divisor"><span>${t('publico.pedirTitulo')}</span></h2>
                    ${empresa.solicitacoesAtivas ? html`
                        <p class="bloco-nota">${t('publico.pedirTexto')}</p>
                        <form data-form="pedido" novalidate>
                            <div class="campo">
                                <label for="pedido-nome">${t('comum.nome')}</label>
                                <input id="pedido-nome" name="nome" maxlength="120" required autocomplete="name">
                            </div>
                            <div class="campo">
                                <label for="pedido-email">${t('comum.email')}</label>
                                <input id="pedido-email" name="email" type="email" maxlength="255" required autocomplete="email" spellcheck="false" autocapitalize="none">
                            </div>
                            <div class="campo">
                                <label for="pedido-mensagem">${t('publico.mensagem')} <span class="rotulo-opcional">(${t('comum.opcional')})</span></label>
                                <textarea id="pedido-mensagem" name="mensagem" rows="3" maxlength="500"></textarea>
                            </div>
                            <p class="campo-erro" data-resumo-erro role="alert" hidden></p>
                            <button type="submit" class="botao botao--primario botao--largo">${t('publico.enviar')}</button>
                        </form>
                        <p class="nota-sucesso" data-enviado role="status" hidden>${t('publico.enviado')}</p>`
                        : html`<p class="nota">${t('publico.fechados')}</p>`}
                </section>
            </div>`,

        montar(raiz) {
            raiz.querySelectorAll('[data-entrar-como]').forEach((botao) => {
                botao.addEventListener('click', async () => {
                    botao.disabled = true;
                    try {
                        const usuario = await dados.entrarComo(botao.dataset.entrarComo);
                        anunciar(t('demo.trocadoPara', { nome: usuario.nome }));
                        irPara('painel');
                    } catch (erro) {
                        botao.disabled = false;
                        mostrarErro(erro);
                    }
                });
            });

            const form = raiz.querySelector('[data-form="pedido"]');
            form?.addEventListener('submit', async (evento) => {
                evento.preventDefault();
                try {
                    await dados.enviarSolicitacao(empresa.identificador, { nome: form.nome.value, email: form.email.value, mensagem: form.mensagem.value });
                    form.hidden = true;
                    const ok = raiz.querySelector('[data-enviado]');
                    ok.hidden = false;
                    ok.setAttribute('tabindex', '-1');
                    ok.focus();
                } catch (erro) {
                    mostrarErro(erro, form);
                }
            });
        },
    };
}
