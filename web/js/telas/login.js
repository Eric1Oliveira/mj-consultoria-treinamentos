// Login demonstrativo: escolher um perfil ou usar uma conta de exemplo.
// Nada é enviado a lugar nenhum e nenhuma senha verdadeira é usada.

import * as dados from '../dados.js';
import { t } from '../textos.js';
import { html, avatar, irPara, anunciar } from '../app.js';

export async function tela() {
    const perfis = await dados.listarPerfisDemo();

    return {
        titulo: t('login.titulo'),
        conteudo: html`
            <div class="login">
                <header class="cabecalho cabecalho--login">
                    <h1 class="titulo" tabindex="-1">${t('login.heading')}</h1>
                    <p class="subtitulo">${t('login.sub')}</p>
                </header>

                <section aria-labelledby="login-perfis">
                    <h2 id="login-perfis" class="bloco-titulo">${t('login.perfisTitulo')}</h2>
                    <ul class="perfis" role="list">
                        ${perfis.map((p) => html`
                            <li>
                                <button type="button" class="perfil" data-entrar-como="${p.id}"
                                        aria-label="${t('login.entrarComo', { nome: p.nome, perfil: t(`perfis.${p.perfil}`) })}">
                                    ${avatar(p.nome, p.empresa?.cor)}
                                    <span class="perfil-texto">
                                        <span class="perfil-papel">${t(`perfis.${p.perfil}`)}</span>
                                        <span class="perfil-nome">${p.nome}</span>
                                        ${p.empresa ? html`<span class="perfil-empresa">${p.empresa.nome}</span>` : ''}
                                        <span class="perfil-descricao">${t(`perfisDescricao.${p.perfil}`)}</span>
                                    </span>
                                </button>
                            </li>`)}
                    </ul>
                </section>

                <section class="login-form" aria-labelledby="login-form-titulo">
                    <h2 id="login-form-titulo" class="divisor"><span>${t('login.formTitulo')}</span></h2>
                    <form data-form="login" novalidate>
                        <div class="campo">
                            <label for="login-email">${t('login.email')}</label>
                            <input id="login-email" name="email" type="email" autocomplete="username" required spellcheck="false" autocapitalize="none">
                        </div>
                        <div class="campo">
                            <label for="login-senha">${t('login.senha')}</label>
                            <input id="login-senha" name="senha" type="password" autocomplete="current-password" required aria-describedby="login-senha-dica">
                            <p id="login-senha-dica" class="campo-dica">${t('login.senhaDica')}</p>
                        </div>
                        <p id="login-erro" class="campo-erro" role="alert" hidden></p>
                        <button type="submit" class="botao botao--primario botao--largo">${t('login.entrar')}</button>
                    </form>
                </section>
            </div>`,

        montar(raiz) {
            raiz.querySelectorAll('[data-entrar-como]').forEach((botao) => {
                botao.addEventListener('click', async () => {
                    botao.disabled = true;
                    const usuario = await dados.entrarComo(botao.dataset.entrarComo);
                    anunciar(t('demo.trocadoPara', { nome: usuario.nome }));
                    irPara('painel');
                });
            });

            const form = raiz.querySelector('[data-form="login"]');
            const erro = raiz.querySelector('#login-erro');
            const email = raiz.querySelector('#login-email');
            form.addEventListener('submit', async (evento) => {
                evento.preventDefault();
                const enviar = form.querySelector('[type="submit"]');
                enviar.disabled = true;
                try {
                    const valores = new FormData(form);
                    await dados.entrar(valores.get('email'), valores.get('senha'));
                    irPara('painel');
                } catch {
                    erro.textContent = t('login.erro');
                    erro.hidden = false;
                    email.setAttribute('aria-invalid', 'true');
                    email.setAttribute('aria-describedby', 'login-erro');
                    email.focus();
                } finally {
                    enviar.disabled = false;
                }
            });
        },
    };
}
