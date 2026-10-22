// Validação pública de certificado (#/validar ou #/validar/CÓDIGO): qualquer pessoa
// (um RH, um cliente) confere se o certificado é autêntico pelo código impresso nele.

import * as dados from '../dados.js';
import { t, formatarData } from '../textos.js';
import { html, icone } from '../app.js';

function resultado(codigo, c) {
    if (!codigo) return '';
    if (!c) {
        return html`<div class="validacao validacao--invalida" role="status">
            ${icone('alert')}
            <div><p class="validacao-titulo">${t('validar.invalidoTitulo')}</p><p>${t('validar.invalidoTexto', { codigo })}</p></div>
        </div>`;
    }
    return html`<div class="validacao validacao--valida" role="status">
        ${icone('escudo')}
        <div>
            <p class="validacao-titulo">${t('validar.validoTitulo')}</p>
            <dl class="ficha ficha--solta">
                <div><dt>${t('validar.titular')}</dt><dd>${c.nome}</dd></div>
                <div><dt>${t('validar.curso')}</dt><dd>${c.curso}</dd></div>
                <div><dt>${t('validar.carga')}</dt><dd>${t('comum.horas', { n: c.cargaHoraria })}</dd></div>
                ${c.empresa ? html`<div><dt>${t('comum.empresa')}</dt><dd>${c.empresa}</dd></div>` : ''}
                <div><dt>${t('validar.emitido')}</dt><dd>${formatarData(c.emitidoEm)}</dd></div>
                <div><dt>${t('validar.codigo')}</dt><dd class="codigo">${c.codigo}</dd></div>
            </dl>
        </div>
    </div>`;
}

export async function tela({ parametros }) {
    const codigo = (parametros[0] ?? '').toUpperCase();
    const certificado = codigo ? await dados.validarCertificado(codigo).catch(() => null) : null;
    return {
        titulo: t('validar.titulo'),
        conteudo: html`<div class="login">
            <header class="cabecalho">
                <h1 class="titulo" tabindex="-1">${t('validar.titulo')}</h1>
                <p class="subtitulo">${t('validar.sub')}</p>
            </header>
            <form class="formulario" data-form="validar" novalidate>
                <div class="campo">
                    <label for="validar-codigo">${t('validar.codigo')}</label>
                    <input id="validar-codigo" name="codigo" value="${codigo}" maxlength="20" required autocomplete="off" spellcheck="false" autocapitalize="characters" placeholder="MJC-0000-0000">
                </div>
                <button type="submit" class="botao botao--primario botao--largo">${t('validar.conferir')}</button>
            </form>
            <div data-resultado aria-live="polite">${resultado(codigo, certificado)}</div>
            <p class="login-rodape"><a href="#/login">${t('convite.irLogin')}</a></p>
        </div>`,
        montar(raiz) {
            const form = raiz.querySelector('[data-form="validar"]');
            form.addEventListener('submit', (evento) => {
                evento.preventDefault();
                const valor = form.codigo.value.trim().toUpperCase();
                if (valor) window.location.hash = `#/validar/${encodeURIComponent(valor)}`;
            });
        },
    };
}
