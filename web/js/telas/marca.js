// Estúdio de marca: o gestor deixa a plataforma com a cara da empresa (logo, academia,
// cores, menu, cantos, fonte e capas) vendo o resultado ao vivo numa prévia do app.
// Rotas: #/marca (gestor: a própria empresa) · #/marca/:empresaId (equipe da consultoria).

import * as dados from '../dados.js';
import { ehEquipe, paletaMarca, marcaDe, corValida, ESTILOS_MENU, CANTOS, FONTES } from '../regras.js';
import { t } from '../textos.js';
import { html, icone, opcao, anunciar, mostrarErro, limparErros, desenharEm, pintarMarca, marcaTopo, capa, enderecoDe } from '../app.js';

/** Cores sugeridas: um ponto de partida, não um limite (qualquer cor vale). */
const SUGESTOES = ['#0f4c5c', '#1d4f7a', '#e4002b', '#ff5a1f', '#ffc72c', '#2e6136', '#6d28d9', '#111827'];

/** Cursos fictícios só para a prévia (o id decide o desenho da capa). */
const CURSOS_PREVIA = [
    { id: 'previa-a', aulas: 5, progresso: { matriculado: true, feitas: 2, total: 5, concluido: false } },
    { id: 'previa-b', aulas: 4, progresso: { matriculado: true, feitas: 4, total: 4, concluido: true } },
];

// ---------------------------------------------------------------- prévia --

function previaApp(empresa) {
    return html`<div class="previa-app escopo-marca" data-previa-app data-dispositivo="computador" aria-hidden="true">
        <div class="previa-janela">
            <span></span><span></span><span></span>
            <span class="previa-endereco">${enderecoDe('painel').replace(/^https?:\/\//, '')}</span>
        </div>
        <div class="previa-corpo">
            <div class="previa-lateral">
                <div data-previa-marca>${marcaTopo(empresa, { inverso: true })}</div>
                <ul class="previa-nav">
                    <li class="previa-nav-item previa-nav-item--atual">${icone('home', 'icone icone--p')}${t('nav.painel')}</li>
                    <li class="previa-nav-item">${icone('book', 'icone icone--p')}${t('nav.cursos')}</li>
                    <li class="previa-nav-item">${icone('users', 'icone icone--p')}${t('nav.pessoas')}</li>
                    <li class="previa-nav-item">${icone('user', 'icone icone--p')}${t('nav.conta')}</li>
                </ul>
            </div>
            <div class="previa-principal">
                <div class="previa-topo-celular" data-previa-marca-celular>${marcaTopo(empresa)}</div>
                <p class="previa-ola">${t('marca.previaOla')}</p>
                <div class="previa-destaque">
                    ${capa(CURSOS_PREVIA[0], CURSOS_PREVIA[0].progresso, { classe: 'previa-destaque-fundo', largura: 640, altura: 260, trilha: [0.52, 0.92, 0.25, 0.7] })}
                    <div class="previa-destaque-corpo">
                        <span class="previa-rotulo">${t('painel.continuar')}</span>
                        <strong class="previa-destaque-titulo">${t('marca.previaCurso')}</strong>
                        <span class="previa-barra"><span></span></span>
                        <span class="botao botao--claro botao--p">${icone('tocar', 'icone icone--p')}${t('painel.continuarAula')}</span>
                    </div>
                </div>
                <div class="previa-cursos">
                    ${CURSOS_PREVIA.map((c) => capa(c, c.progresso, { classe: 'previa-capa' }))}
                </div>
                <div class="previa-acoes">
                    <span class="botao botao--primario botao--p">${t('marca.previaBotao')}</span>
                    <span class="previa-link">${t('painel.verTodas')}</span>
                </div>
            </div>
            <div class="previa-barra-inferior">
                <span class="previa-barra-item previa-barra-item--atual">${icone('home', 'icone icone--p')}</span>
                <span class="previa-barra-item">${icone('book', 'icone icone--p')}</span>
                <span class="previa-barra-item">${icone('user', 'icone icone--p')}</span>
                <span class="previa-barra-item">${icone('grid', 'icone icone--p')}</span>
            </div>
        </div>
    </div>`;
}

/** Explica o que a paleta fez com a cor escolhida (a empresa não precisa saber de contraste). */
function situacaoCor(cor) {
    if (!cor) return html`${icone('sparkle', 'icone icone--p')}${t('marca.corPadrao')}`;
    const p = paletaMarca(cor);
    if (p.ajustada) return html`${icone('check', 'icone icone--p')}${t('marca.corAjustada')} <span class="amostra" data-cor-amostra="${p.acao}"></span> <span class="codigo">${p.acao}</span>`;
    if (p.onAcao !== '#ffffff') return html`${icone('check', 'icone icone--p')}${t('marca.corTextoEscuro')}`;
    return html`${icone('check', 'icone icone--p')}${t('marca.corPronta')}`;
}

/** Cor mais marcante do logotipo: ignora transparência, branco, preto e cinzas. */
function corDoLogo(src) {
    return new Promise((resolver) => {
        const imagem = new Image();
        imagem.onload = () => {
            const lado = 48;
            const tela = document.createElement('canvas');
            tela.width = lado;
            tela.height = lado;
            const ctx = tela.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(imagem, 0, 0, lado, lado);
            let pixels;
            try {
                pixels = ctx.getImageData(0, 0, lado, lado).data;
            } catch {
                resolver(null);
                return;
            }
            const baldes = new Map();
            for (let i = 0; i < pixels.length; i += 4) {
                const [r, g, b, a] = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                if (a < 200 || max - min < 40 || max < 35 || min > 235) continue;
                const chave = `${r >> 5}-${g >> 5}-${b >> 5}`;
                const balde = baldes.get(chave) ?? { n: 0, r: 0, g: 0, b: 0, peso: 0 };
                balde.n += 1;
                balde.r += r;
                balde.g += g;
                balde.b += b;
                balde.peso += (max - min) / 255 + 0.5;
                baldes.set(chave, balde);
            }
            const melhor = [...baldes.values()].sort((x, y) => y.peso - x.peso)[0];
            if (!melhor) {
                resolver(null);
                return;
            }
            const hex = [melhor.r, melhor.g, melhor.b].map((v) => Math.round(v / melhor.n).toString(16).padStart(2, '0')).join('');
            resolver(`#${hex}`);
        };
        imagem.onerror = () => resolver(null);
        imagem.src = src;
    });
}

// ----------------------------------------------------------------- campos --

function escolhas(nome, valores, atual, rotulo, conteudo = null) {
    return html`<fieldset class="escolhas">
        <legend>${rotulo}</legend>
        <div class="escolhas-opcoes escolhas-opcoes--${nome}">
            ${valores.map((valor) => html`<label class="escolha">
                <input type="radio" name="${nome}" value="${valor}" ${valor === atual ? html`checked` : ''}>
                <span class="escolha-cartao">
                    ${conteudo ? conteudo(valor) : ''}
                    <span class="escolha-nome">${t(`marca.${nome}Opcoes.${valor}`)}</span>
                </span>
            </label>`)}
        </div>
    </fieldset>`;
}

const miniaturaMenu = (valor) => html`<span class="miniatura-menu escopo-marca" data-menu="${valor}"><span></span><span></span></span>`;
const miniaturaCantos = (valor) => html`<span class="miniatura-cantos" data-cantos="${valor}"><span></span></span>`;
const miniaturaFonte = (valor) => html`<span class="miniatura-fonte" data-fonte="${valor}">Aa</span>`;

// ------------------------------------------------------------------- tela --

export async function tela({ usuario, parametros, recarregar }) {
    const equipe = ehEquipe(usuario.perfil);
    let empresas = [];
    let empresaId = usuario.empresaId;
    if (equipe) {
        empresas = (await dados.listarEmpresas(usuario)).filter((e) => e.ativa || e.id === parametros[0]);
        empresaId = parametros[0] && empresas.some((e) => e.id === parametros[0]) ? parametros[0] : empresas[0]?.id;
    }
    const empresa = await dados.obterEmpresa(empresaId);
    if (!empresa) throw new dados.ErroDados('nao-encontrado');

    const salvo = { ...marcaDe(empresa), mensagem: empresa.mensagem ?? '' };
    const estado = structuredClone(salvo);
    const m = estado;

    return {
        titulo: t('marca.titulo'),
        conteudo: html`
            ${equipe ? html`<a class="voltar" href="#/empresas/${empresa.id}">${icone('back', 'icone icone--p')}${empresa.nome}</a>` : ''}
            <header class="cabecalho cabecalho--acoes">
                <div>
                    <p class="sobretitulo">${t('marca.sobretitulo')}</p>
                    <h1 class="titulo" tabindex="-1">${t('marca.titulo')}</h1>
                    <p class="subtitulo">${t('marca.sub', { empresa: empresa.nome })}</p>
                </div>
                ${empresas.length > 1 ? html`<form class="filtros filtros--compacto" data-form="empresa">
                    <div class="campo">
                        <label for="marca-empresa">${t('pessoas.escolherEmpresa')}</label>
                        <select id="marca-empresa" name="empresa">${empresas.map((e) => opcao(e.id, e.nome, e.id === empresaId))}</select>
                    </div>
                    <button type="submit" class="botao botao--secundario">${t('pessoas.trocarEmpresa')}</button>
                </form>` : ''}
            </header>

            <div class="estudio">
                <form class="estudio-controles" data-form="marca" novalidate>
                    <section class="estudio-secao" aria-labelledby="marca-sec-identidade">
                        <h2 id="marca-sec-identidade" class="estudio-titulo"><span class="estudio-passo" aria-hidden="true">1</span>${t('marca.secIdentidade')}</h2>
                        <div class="campo">
                            <span class="campo-rotulo" id="marca-logo-rotulo">${t('marca.logo')}</span>
                            <label class="soltar" data-soltar>
                                <span class="soltar-logo" data-logo-atual>${marcaTopo({ ...empresa, ...m }, {})}</span>
                                <span class="soltar-texto">
                                    <strong>${icone('upload', 'icone icone--p')}${t('marca.logoEnviar')}</strong>
                                    <span>${t('marca.logoDica')}</span>
                                </span>
                                <input class="sr-only" id="marca-logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" aria-labelledby="marca-logo-rotulo">
                            </label>
                            <div class="acoes acoes--p" data-logo-acoes>
                                <button type="button" class="botao botao--secundario botao--p" data-cor-logo ${m.logo ? '' : html`hidden`}>${icone('sparkle', 'icone icone--p')}${t('marca.corDoLogo')}</button>
                                <button type="button" class="botao botao--fantasma botao--p" data-remover-logo ${m.logo ? '' : html`hidden`}>${t('marca.logoRemover')}</button>
                            </div>
                        </div>
                        <div class="campo">
                            <label for="marca-academia">${t('marca.academia')}</label>
                            <input id="marca-academia" name="academia" value="${m.academia}" maxlength="60" placeholder="${t('marca.academiaExemplo', { empresa: empresa.nome })}" aria-describedby="marca-academia-dica">
                            <p id="marca-academia-dica" class="campo-dica">${t('marca.academiaDica')}</p>
                        </div>
                    </section>

                    <section class="estudio-secao" aria-labelledby="marca-sec-cores">
                        <h2 id="marca-sec-cores" class="estudio-titulo"><span class="estudio-passo" aria-hidden="true">2</span>${t('marca.secCores')}</h2>
                        <fieldset class="escolhas">
                            <legend>${t('marca.corPrincipal')}</legend>
                            <div class="cores">
                                ${SUGESTOES.map((cor) => html`<button type="button" class="cor-sugestao" data-sugestao="${cor}" data-cor-amostra="${cor}" aria-label="${t('marca.usarCor', { cor })}" aria-pressed="${m.cor === cor ? 'true' : 'false'}"></button>`)}
                                <label class="cor-propria" title="${t('marca.corPropria')}">
                                    <input type="color" name="corSeletor" value="${m.cor ?? '#0f4c5c'}" aria-label="${t('marca.corPropria')}">
                                    ${icone('palette', 'icone icone--p')}
                                </label>
                                <input class="cor-hex-campo" name="cor" value="${m.cor ?? ''}" maxlength="7" spellcheck="false" autocomplete="off" placeholder="#0f4c5c" aria-label="${t('marca.corHex')}" aria-describedby="marca-cor-situacao">
                            </div>
                            <p id="marca-cor-situacao" class="estudio-situacao" data-situacao aria-live="polite">${situacaoCor(m.cor)}</p>
                        </fieldset>
                        <div class="campo">
                            <label class="campo-check">
                                <input type="checkbox" name="usarSecundaria" ${m.corSecundaria ? html`checked` : ''}>
                                <span>${t('marca.usarSecundaria')}</span>
                            </label>
                            <div class="cor-linha" data-secundaria ${m.corSecundaria ? '' : html`hidden`}>
                                <input type="color" name="corSecundaria" value="${m.corSecundaria ?? '#0b2238'}" aria-label="${t('marca.corSecundaria')}" aria-describedby="marca-secundaria-dica">
                                <span class="codigo" data-secundaria-hex>${m.corSecundaria ?? '#0b2238'}</span>
                            </div>
                            <p id="marca-secundaria-dica" class="campo-dica">${t('marca.secundariaDica')}</p>
                        </div>
                    </section>

                    <section class="estudio-secao" aria-labelledby="marca-sec-estilo">
                        <h2 id="marca-sec-estilo" class="estudio-titulo"><span class="estudio-passo" aria-hidden="true">3</span>${t('marca.secEstilo')}</h2>
                        ${escolhas('estiloMenu', ESTILOS_MENU, m.estiloMenu, t('marca.estiloMenu'), miniaturaMenu)}
                        ${escolhas('cantos', CANTOS, m.cantos, t('marca.cantos'), miniaturaCantos)}
                        ${escolhas('fonte', FONTES, m.fonte, t('marca.fonte'), miniaturaFonte)}
                        <label class="interruptor">
                            <input type="checkbox" name="capasMarca" role="switch" ${m.capasMarca ? html`checked` : ''}>
                            <span class="interruptor-trilho" aria-hidden="true"></span>
                            <span><strong>${t('marca.capasMarca')}</strong><span class="campo-dica">${t('marca.capasMarcaDica')}</span></span>
                        </label>
                    </section>

                    <section class="estudio-secao" aria-labelledby="marca-sec-boas">
                        <h2 id="marca-sec-boas" class="estudio-titulo"><span class="estudio-passo" aria-hidden="true">4</span>${t('marca.secBoasVindas')}</h2>
                        <div class="campo">
                            <label for="marca-mensagem">${t('empresas.mensagem')}</label>
                            <textarea id="marca-mensagem" name="mensagem" rows="3" maxlength="300" aria-describedby="marca-mensagem-dica">${m.mensagem}</textarea>
                            <p id="marca-mensagem-dica" class="campo-dica">${t('marca.mensagemDica')}</p>
                        </div>
                    </section>

                    <p class="campo-erro" data-resumo-erro role="alert" hidden></p>
                    <div class="estudio-rodape">
                        <span class="selo selo--aviso-p" data-pendente hidden>${t('marca.naoSalvo')}</span>
                        <button type="button" class="botao botao--fantasma" data-padrao>${t('marca.restaurarPadrao')}</button>
                        <button type="submit" class="botao botao--primario">${icone('check', 'icone icone--p')}${t('marca.salvar')}</button>
                    </div>
                </form>

                <aside class="estudio-previa" aria-labelledby="marca-previa-titulo">
                    <div class="estudio-previa-topo">
                        <h2 id="marca-previa-titulo" class="estudio-titulo">${icone('eye', 'icone icone--p')}${t('marca.previa')}</h2>
                        <div class="segmentado" role="group" aria-label="${t('marca.dispositivo')}">
                            <button type="button" data-dispositivo="computador" aria-pressed="true">${t('marca.computador')}</button>
                            <button type="button" data-dispositivo="celular" aria-pressed="false">${t('marca.celular')}</button>
                        </div>
                    </div>
                    ${previaApp({ ...empresa, ...m })}
                    <p class="campo-dica">${t('marca.previaDica')}</p>
                    ${empresa.ativa ? html`<a class="secao-link" href="#/e/${empresa.identificador}">${icone('external', 'icone icone--p')}${t('marca.verPagina')}</a>` : ''}
                </aside>
            </div>`,

        montar(raiz) {
            const form = raiz.querySelector('[data-form="marca"]');
            const previa = raiz.querySelector('[data-previa-app]');

            raiz.querySelector('[data-form="empresa"]')?.addEventListener('submit', (evento) => {
                evento.preventDefault();
                window.location.hash = `#/marca/${evento.target.empresa.value}`;
            });

            const pintarAmostras = () => raiz.querySelectorAll('[data-cor-amostra]').forEach((el) => el.style.setProperty('--cor', el.dataset.corAmostra));

            const atualizar = ({ marcaTopoTambem = false } = {}) => {
                const comoEmpresa = { ...empresa, ...estado };
                pintarMarca(previa, comoEmpresa);
                if (marcaTopoTambem) {
                    desenharEm(raiz.querySelector('[data-previa-marca]'), marcaTopo(comoEmpresa, { inverso: true }));
                    desenharEm(raiz.querySelector('[data-previa-marca-celular]'), marcaTopo(comoEmpresa));
                    desenharEm(raiz.querySelector('[data-logo-atual]'), marcaTopo(comoEmpresa));
                    raiz.querySelector('[data-cor-logo]').hidden = !estado.logo;
                    raiz.querySelector('[data-remover-logo]').hidden = !estado.logo;
                }
                desenharEm(raiz.querySelector('[data-situacao]'), situacaoCor(estado.cor));
                pintarAmostras();
                raiz.querySelectorAll('[data-sugestao]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sugestao === estado.cor)));
                raiz.querySelector('[data-pendente]').hidden = JSON.stringify(estado) === JSON.stringify(salvo);
            };

            const definirCor = (cor) => {
                estado.cor = cor;
                form.cor.value = cor ?? '';
                if (cor) form.corSeletor.value = cor;
                atualizar({ marcaTopoTambem: !estado.logo });
            };

            form.addEventListener('input', (evento) => {
                const campo = evento.target;
                switch (campo.name) {
                    case 'academia':
                        estado.academia = campo.value;
                        atualizar({ marcaTopoTambem: true });
                        break;
                    case 'mensagem':
                        estado.mensagem = campo.value;
                        atualizar();
                        break;
                    case 'corSeletor':
                        definirCor(campo.value);
                        break;
                    case 'cor': {
                        const valor = campo.value.trim().startsWith('#') ? campo.value.trim() : `#${campo.value.trim()}`;
                        if (corValida(valor)) definirCor(valor.toLowerCase());
                        else if (!campo.value.trim()) definirCor(null);
                        break;
                    }
                    case 'corSecundaria':
                        estado.corSecundaria = campo.value;
                        raiz.querySelector('[data-secundaria-hex]').textContent = campo.value;
                        atualizar();
                        break;
                    default:
                        break;
                }
            });

            form.addEventListener('change', (evento) => {
                const campo = evento.target;
                if (campo.type === 'radio') estado[campo.name] = campo.value;
                if (campo.name === 'capasMarca') estado.capasMarca = campo.checked;
                if (campo.name === 'usarSecundaria') {
                    estado.corSecundaria = campo.checked ? form.corSecundaria.value : null;
                    raiz.querySelector('[data-secundaria]').hidden = !campo.checked;
                }
                atualizar();
            });

            raiz.querySelectorAll('[data-sugestao]').forEach((botao) => {
                botao.addEventListener('click', () => definirCor(botao.dataset.sugestao));
            });

            // Logotipo: escolher ou arrastar; o arquivo é conferido pelo conteúdo (dados.lerLogo).
            const receberLogo = async (arquivo) => {
                if (!arquivo) return;
                limparErros(form);
                try {
                    estado.logo = await dados.lerLogo(arquivo);
                    atualizar({ marcaTopoTambem: true });
                    const sugerida = await corDoLogo(estado.logo);
                    if (sugerida && !estado.cor) definirCor(sugerida);
                    anunciar(t('marca.logoPronto'));
                } catch (erro) {
                    form.logo.value = '';
                    mostrarErro(erro, form);
                }
            };
            form.logo.addEventListener('change', () => receberLogo(form.logo.files[0]));
            const soltar = raiz.querySelector('[data-soltar]');
            soltar.addEventListener('dragover', (evento) => {
                evento.preventDefault();
                soltar.dataset.arrastando = '';
            });
            soltar.addEventListener('dragleave', () => delete soltar.dataset.arrastando);
            soltar.addEventListener('drop', (evento) => {
                evento.preventDefault();
                delete soltar.dataset.arrastando;
                receberLogo(evento.dataTransfer.files[0]);
            });
            raiz.querySelector('[data-remover-logo]').addEventListener('click', () => {
                estado.logo = null;
                form.logo.value = '';
                atualizar({ marcaTopoTambem: true });
                anunciar(t('marca.logoRemovido'));
                form.logo.focus();
            });
            raiz.querySelector('[data-cor-logo]').addEventListener('click', async () => {
                const sugerida = estado.logo ? await corDoLogo(estado.logo) : null;
                if (!sugerida) {
                    anunciar(t('marca.corDoLogoFalhou'), 'erro');
                    return;
                }
                definirCor(sugerida);
                anunciar(t('marca.corDoLogoOk', { cor: sugerida }));
            });

            raiz.querySelector('[data-padrao]').addEventListener('click', () => {
                Object.assign(estado, { cor: null, corSecundaria: null, estiloMenu: 'escuro', cantos: 'suave', fonte: 'marcante', capasMarca: false });
                form.cor.value = '';
                form.usarSecundaria.checked = false;
                raiz.querySelector('[data-secundaria]').hidden = true;
                form.capasMarca.checked = false;
                ['estiloMenu', 'cantos', 'fonte'].forEach((nome) => {
                    form.querySelector(`[name="${nome}"][value="${estado[nome]}"]`).checked = true;
                });
                atualizar({ marcaTopoTambem: true });
                anunciar(t('marca.padraoAplicado'));
            });

            const botoesDispositivo = [...raiz.querySelectorAll('.segmentado [data-dispositivo]')];
            const verEm = (dispositivo) => {
                previa.dataset.dispositivo = dispositivo;
                botoesDispositivo.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.dispositivo === dispositivo)));
            };
            botoesDispositivo.forEach((botao) => botao.addEventListener('click', () => verEm(botao.dataset.dispositivo)));
            // No celular, a prévia já abre no formato de celular.
            if (window.matchMedia('(max-width: 640px)').matches) verEm('celular');

            form.addEventListener('submit', async (evento) => {
                evento.preventDefault();
                const botao = form.querySelector('[type="submit"]');
                botao.disabled = true;
                try {
                    await dados.salvarMarca(usuario, empresa.id, estado);
                    anunciar(t('marca.salva'));
                    await recarregar();
                } catch (erro) {
                    mostrarErro(erro, form);
                } finally {
                    botao.disabled = false;
                }
            });

            atualizar();
        },
    };
}
