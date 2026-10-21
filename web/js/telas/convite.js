// Aceite do convite (#/convite/código): perfil, empresa e e-mail vêm do convite.

import * as dados from '../dados.js';
import { t } from '../textos.js';
import { html, anunciar, irPara, mostrarErro } from '../app.js';

export async function tela({ parametros }) {
    const codigo = parametros[0] ?? '';
    const convite = await dados.obterConvite(codigo);

    if (!convite) {
        return {
            titulo: t('convite.invalidoTitulo'),
            conteudo: html`<div class="login">
                <header class="cabecalho">
                    <h1 class="titulo" tabindex="-1">${t('convite.invalidoTitulo')}</h1>
                    <p class="subtitulo">${t('convite.invalidoTexto')}</p>
                </header>
                <a class="botao botao--secundario" href="#/login">${t('convite.irLogin')}</a>
            </div>`,
        };
    }

    return {
        titulo: t('convite.titulo'),
        empresa: convite.empresa,
        conteudo: html`<div class="login">
            <header class="cabecalho">
                <h1 class="titulo" tabindex="-1">${t('convite.heading')}</h1>
                <p class="subtitulo">${t('convite.sub')}</p>
            </header>
            <dl class="ficha">
                <div><dt>${t('comum.email')}</dt><dd>${convite.email}</dd></div>
                <div><dt>${t('comum.perfil')}</dt><dd>${t(`perfis.${convite.perfil}`)}</dd></div>
                <div><dt>${t('comum.empresa')}</dt><dd>${convite.empresa?.nome ?? t('convite.equipe')}</dd></div>
            </dl>
            <form class="formulario" data-form="aceite" novalidate>
                <div class="campo">
                    <label for="aceite-nome">${t('convite.nome')}</label>
                    <input id="aceite-nome" name="nome" maxlength="120" required autocomplete="name">
                </div>
                <div class="campo">
                    <label for="aceite-senha">${t('convite.senha')}</label>
                    <input id="aceite-senha" name="senha" type="password" minlength="${dados.SENHA_MINIMA}" required autocomplete="new-password" aria-describedby="aceite-dica">
                    <p id="aceite-dica" class="campo-dica">${t('convite.senhaDica', { min: dados.SENHA_MINIMA })}</p>
                </div>
                <p class="campo-erro" data-resumo-erro role="alert" hidden></p>
                <button type="submit" class="botao botao--primario botao--largo">${t('convite.aceitar')}</button>
            </form>
        </div>`,
        montar(raiz) {
            const form = raiz.querySelector('[data-form="aceite"]');
            form.addEventListener('submit', async (evento) => {
                evento.preventDefault();
                const enviar = form.querySelector('[type="submit"]');
                enviar.disabled = true;
                try {
                    const usuario = await dados.aceitarConvite(codigo, form.nome.value, form.senha.value);
                    anunciar(t('convite.aceito', { nome: usuario.nome }));
                    irPara('painel');
                } catch (erro) {
                    mostrarErro(erro, form);
                } finally {
                    enviar.disabled = false;
                }
            });
        },
    };
}
