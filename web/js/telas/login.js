// Login com e-mail e senha (Supabase Auth). Contas novas entram por convite.

import * as dados from '../dados.js';
import { t } from '../textos.js';
import { html, icone, irPara, marcaTopo, pintarMarca } from '../app.js';

export async function tela() {
    const empresas = await dados.listarEmpresasPublicas();

    return {
        titulo: t('login.titulo'),
        conteudo: html`
            <div class="login">
                <header class="cabecalho cabecalho--login">
                    <h1 class="titulo" tabindex="-1">${t('login.heading')}</h1>
                    <p class="subtitulo">${t('login.sub')}</p>
                </header>


                ${empresas.length ? html`<section class="vitrine" aria-labelledby="login-vitrine">
                    <h2 id="login-vitrine" class="bloco-titulo">${t('login.vitrineTitulo')}</h2>
                    <p class="bloco-nota">${t('login.vitrineNota')}</p>
                    <ul class="vitrine-lista" role="list">
                        ${empresas.map((e) => html`<li>
                            <a class="vitrine-item escopo-marca" href="#/e/${e.identificador}" data-vitrine="${e.id}">
                                ${marcaTopo(e, { inverso: true })}
                                ${icone('arrow', 'icone icone--p')}
                            </a>
                        </li>`)}
                    </ul>
                </section>` : ''}

                <section class="login-form" aria-labelledby="login-form-titulo">
                    <h2 id="login-form-titulo" class="divisor"><span>${t('login.formTitulo')}</span></h2>
                    <form data-form="login" novalidate>
                        <div class="campo">
                            <label for="login-email">${t('login.email')}</label>
                            <input id="login-email" name="email" type="email" autocomplete="username" required spellcheck="false" autocapitalize="none">
                        </div>
                        <div class="campo">
                            <label for="login-senha">${t('login.senha')}</label>
                            <input id="login-senha" name="senha" type="password" autocomplete="current-password" required>
                        </div>
                        <p id="login-erro" class="campo-erro" role="alert" hidden></p>
                        <button type="submit" class="botao botao--primario botao--largo">${t('login.entrar')}</button>
                    </form>
                </section>
            </div>`,

        montar(raiz) {
            // Cada cartão da vitrine já aparece com a marca da empresa.
            raiz.querySelectorAll('[data-vitrine]').forEach((el) => pintarMarca(el, empresas.find((e) => e.id === el.dataset.vitrine)));

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
