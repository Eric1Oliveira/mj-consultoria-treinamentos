// Senha: "esqueci minha senha" (#/recuperar) e a criação da nova senha depois do
// link do e-mail (#/nova-senha). O Supabase envia o e-mail e devolve a sessão no endereço.

import * as dados from '../dados.js';
import { t } from '../textos.js';
import { html, anunciar, irPara, mostrarErro } from '../app.js';

export async function tela({ consulta }) {
    const erroLink = consulta.get('erro');
    return {
        titulo: t('senha.recuperarTitulo'),
        conteudo: html`<div class="login">
            <header class="cabecalho">
                <h1 class="titulo" tabindex="-1">${t('senha.recuperarTitulo')}</h1>
                <p class="subtitulo">${t('senha.recuperarSub')}</p>
            </header>
            ${erroLink ? html`<p class="nota nota--aviso" role="alert">${t('senha.linkExpirado')}</p>` : ''}
            <form class="formulario" data-form="recuperar" novalidate>
                <div class="campo">
                    <label for="recuperar-email">${t('comum.email')}</label>
                    <input id="recuperar-email" name="email" type="email" autocomplete="username" required spellcheck="false" autocapitalize="none">
                </div>
                <p class="campo-erro" data-resumo-erro role="alert" hidden></p>
                <button type="submit" class="botao botao--primario botao--largo">${t('senha.enviarLink')}</button>
            </form>
            <p class="nota-sucesso" data-enviado role="status" hidden>${t('senha.enviado')}</p>
            <p class="login-rodape"><a href="#/login">${t('convite.irLogin')}</a></p>
        </div>`,
        montar(raiz) {
            const form = raiz.querySelector('[data-form="recuperar"]');
            form.addEventListener('submit', async (evento) => {
                evento.preventDefault();
                const botao = form.querySelector('[type="submit"]');
                botao.disabled = true;
                try {
                    await dados.recuperarSenha(form.email.value);
                    form.hidden = true;
                    const ok = raiz.querySelector('[data-enviado]');
                    ok.hidden = false;
                    ok.setAttribute('tabindex', '-1');
                    ok.focus();
                } catch (erro) {
                    mostrarErro(erro, form);
                } finally {
                    botao.disabled = false;
                }
            });
        },
    };
}

export async function telaNovaSenha() {
    const usuario = await dados.usuarioAtual();
    if (!usuario) {
        return {
            titulo: t('senha.novaTitulo'),
            conteudo: html`<div class="login">
                <header class="cabecalho">
                    <h1 class="titulo" tabindex="-1">${t('senha.novaTitulo')}</h1>
                    <p class="subtitulo">${t('senha.linkExpirado')}</p>
                </header>
                <a class="botao botao--primario botao--largo" href="#/recuperar">${t('senha.pedirNovoLink')}</a>
            </div>`,
        };
    }
    return {
        titulo: t('senha.novaTitulo'),
        conteudo: html`<div class="login">
            <header class="cabecalho">
                <h1 class="titulo" tabindex="-1">${t('senha.novaTitulo')}</h1>
                <p class="subtitulo">${t('senha.novaSub', { email: usuario.email })}</p>
            </header>
            ${formularioSenha('nova')}
        </div>`,
        montar(raiz) {
            ligarFormularioSenha(raiz, () => irPara('painel'));
        },
    };
}

/** Formulário de nova senha (usado aqui e em "Minha conta"). */
export function formularioSenha(prefixo) {
    return html`<form class="formulario" data-form="senha" novalidate>
        <div class="campo">
            <label for="${prefixo}-senha">${t('senha.nova')}</label>
            <input id="${prefixo}-senha" name="senha" type="password" autocomplete="new-password" minlength="${dados.SENHA_MINIMA}" required aria-describedby="${prefixo}-senha-dica">
            <p id="${prefixo}-senha-dica" class="campo-dica">${t('convite.senhaDica', { min: dados.SENHA_MINIMA })}</p>
        </div>
        <div class="campo">
            <label for="${prefixo}-confirmacao">${t('senha.confirmar')}</label>
            <input id="${prefixo}-confirmacao" name="confirmacao" type="password" autocomplete="new-password" required>
        </div>
        <p class="campo-erro" data-resumo-erro role="alert" hidden></p>
        <button type="submit" class="botao botao--primario">${t('senha.salvar')}</button>
    </form>`;
}

export function ligarFormularioSenha(raiz, depois) {
    const form = raiz.querySelector('[data-form="senha"]');
    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        const botao = form.querySelector('[type="submit"]');
        botao.disabled = true;
        try {
            await dados.trocarSenha(form.senha.value, form.confirmacao.value);
            form.reset();
            anunciar(t('senha.salva'));
            depois?.();
        } catch (erro) {
            mostrarErro(erro, form);
        } finally {
            botao.disabled = false;
        }
    });
}
