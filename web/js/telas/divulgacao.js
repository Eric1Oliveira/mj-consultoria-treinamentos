// Divulgação (só o administrador): o endereço do site (domínio) que todos os links usam, o
// contato de WhatsApp, os links prontos para copiar e o e-mail para novos clientes.
// O conteúdo do e-mail é para clientes do Brasil: fica em português, qualquer que seja o
// idioma da interface (como o conteúdo dos cursos). Só assunto, título e texto são editáveis.

import * as dados from '../dados.js';
import { formatarWhatsapp, linkWhatsapp } from '../regras.js';
import { t, formatarRelativo } from '../textos.js';
import { html, icone, anunciar, mostrarErro, limparErros, desenharEm, copiarTexto, enderecoDe, baixarArquivo } from '../app.js';

/** Valores de fábrica (os mesmos do banco), usados enquanto a configuração não existe. */
const PADRAO = {
    site: '',
    whatsapp: '5511978042160',
    whatsappMensagem: 'Olá! Quero conhecer a plataforma da MJ Alimentos Seguros.',
    emailAssunto: 'Conheça a plataforma da MJ Alimentos Seguros',
    emailTitulo: 'Em que nível está a cultura de segurança de alimentos da sua fábrica?',
    emailTexto: 'A MJ Alimentos Seguros tem uma plataforma, com a marca da sua empresa, para medir a cultura de qualidade e segurança de alimentos e transformar o resultado em ações acompanhadas no dia a dia:',
};

/** O que a plataforma entrega (lista fixa do e-mail). */
const ITENS_EMAIL = [
    ['Diagnóstico anônimo', 'nas 5 dimensões da GFSI, aberto por 30 dias.'],
    ['Relatório avaliado pela MJ', 'com o nível de maturidade e o que fazer em cada dimensão.'],
    ['Plano de ações', 'com aplicação por função, responsável, prazo e status.'],
    ['Treinamentos com certificado', 'DMQSA mensal, kaizen e ranking da equipe.'],
];

const LOGO_EMAIL = 'img/mj-alimentos-seguros-horizontal.png';

const ehLocal = (endereco) => /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(endereco);

// ------------------------------------------------------------------- e-mail --

/**
 * Corpo do e-mail (tabelas e estilos embutidos: é o que os leitores de e-mail entendem).
 * Os endereços são absolutos, montados com o endereço do site. Nunca entra na página do
 * site (a política de segurança bloquearia os estilos): só vai para a área de transferência
 * ou para o arquivo baixado.
 */
function corpoEmail(c, base) {
    const pagina = `${base}divulgacao.html`;
    const whatsapp = linkWhatsapp(c.whatsapp, c.whatsappMensagem);
    return html`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f5ec;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#1c2412;">
<tr><td style="padding:24px 32px;border-bottom:1px solid #dfe3cf;">
<img src="${base}${LOGO_EMAIL}" width="300" height="53" alt="MJ Alimentos Seguros · Consultoria em Segurança dos Alimentos" style="display:block;width:300px;max-width:100%;height:auto;border:0;font-size:16px;font-weight:700;color:#55652b;">
</td></tr>
<tr><td style="padding:32px 32px 8px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Olá, [Nome],</p>
<h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#1c2412;">${c.emailTitulo}</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#4e5743;">${c.emailTexto}</p>
</td></tr>
<tr><td style="padding:0 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;line-height:1.5;">
${ITENS_EMAIL.map(([forte, resto]) => html`<tr><td style="padding:8px 0;border-top:1px solid #dfe3cf;"><strong style="color:#55652b;">${forte}</strong> ${resto}</td></tr>
`)}</table>
</td></tr>
<tr><td style="padding:28px 32px 8px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="border-radius:999px;background:#55652b;"><a href="${pagina}" style="display:inline-block;padding:14px 26px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">Conhecer a plataforma</a></td>
</tr></table>
</td></tr>
<tr><td style="padding:16px 32px 32px;">
<p style="margin:0;font-size:15px;line-height:1.6;color:#4e5743;">Prefere conversar? Chame no WhatsApp <a href="${whatsapp}" style="color:#55652b;font-weight:700;">${formatarWhatsapp(c.whatsapp)}</a>.</p>
</td></tr>
<tr><td style="padding:16px 32px;background:#f6f7f1;border-top:1px solid #dfe3cf;font-size:12px;line-height:1.5;color:#5c6450;">
MJ Alimentos Seguros · MJ Consultoria<br>Baseado em GFSI, FSSC 22000, BRCGS, IFS e ISO 22000.
</td></tr>
</table>
</td></tr>
</table>`.texto;
}

/** Arquivo HTML completo (para ferramentas de e-mail marketing). */
function arquivoEmail(c, base) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${html`${c.emailAssunto}`.texto}</title>
</head>
<body style="margin:0;padding:0;background:#f3f5ec;">
${corpoEmail(c, base)}
</body>
</html>
`;
}

/** Versão só texto (vai junto na área de transferência, para quem cola sem formatação). */
function textoEmail(c, base) {
    return [
        'Olá, [Nome],', '', c.emailTitulo, '', c.emailTexto,
        ...ITENS_EMAIL.map(([forte, resto]) => `- ${forte} ${resto}`), '',
        `Conheça a plataforma: ${base}divulgacao.html`,
        `Prefere conversar? WhatsApp ${formatarWhatsapp(c.whatsapp)}: ${linkWhatsapp(c.whatsapp, c.whatsappMensagem)}`,
        '', 'MJ Alimentos Seguros · MJ Consultoria',
    ].join('\n');
}

/** Copia com a formatação (Gmail e Outlook colam o e-mail pronto); sem suporte, copia o texto. */
async function copiarEmail(c, base) {
    try {
        if (!window.ClipboardItem || !navigator.clipboard?.write) throw new Error('sem ClipboardItem');
        await navigator.clipboard.write([new ClipboardItem({
            'text/html': new Blob([corpoEmail(c, base)], { type: 'text/html' }),
            'text/plain': new Blob([textoEmail(c, base)], { type: 'text/plain' }),
        })]);
        anunciar(t('divulgacao.emailCopiado'));
    } catch {
        await copiarTexto(textoEmail(c, base), t('divulgacao.emailCopiadoTexto'));
    }
}

/** Prévia com o visual do site (o e-mail de verdade sai de corpoEmail). */
function previaEmail(c) {
    return html`<figure class="email-previa" aria-labelledby="email-previa-legenda">
        <figcaption id="email-previa-legenda" class="email-previa-assunto"><span>${t('divulgacao.assunto')}</span> ${c.emailAssunto}</figcaption>
        <div class="email-previa-corpo">
            <img class="email-previa-logo" src="${LOGO_EMAIL}" width="300" height="53" alt="MJ Alimentos Seguros">
            <p>Olá, [Nome],</p>
            <p class="email-previa-titulo">${c.emailTitulo}</p>
            <p>${c.emailTexto}</p>
            <ul class="email-previa-itens" role="list">${ITENS_EMAIL.map(([forte, resto]) => html`<li><strong>${forte}</strong> ${resto}</li>`)}</ul>
            <p><span class="email-previa-botao">Conhecer a plataforma</span></p>
            <p class="email-previa-contato">Prefere conversar? Chame no WhatsApp <strong>${formatarWhatsapp(c.whatsapp)}</strong>.</p>
        </div>
    </figure>`;
}

// -------------------------------------------------------------------- links --

function linhaLink(id, rotulo, dica, url) {
    return html`<li class="link-item">
        <p class="link-item-rotulo" id="${id}">${rotulo}</p>
        ${dica ? html`<p class="bloco-nota">${dica}</p>` : ''}
        <div class="caixa-link-linha">
            <input class="caixa-link-campo" value="${url}" readonly aria-labelledby="${id}" data-selecionar>
            <button type="button" class="botao botao--secundario botao--p" data-copiar="${url}">${icone('copy', 'icone icone--p')}${t('divulgacao.copiar')}<span class="sr-only"> – ${rotulo}</span></button>
            <a class="botao botao--fantasma botao--p" href="${url}" target="_blank" rel="noopener">${icone('external', 'icone icone--p')}${t('divulgacao.abrir')}<span class="sr-only"> – ${rotulo}</span></a>
        </div>
    </li>`;
}

function blocoLinks(c, empresas) {
    const base = dados.enderecoSite();
    return html`<section class="painel-bloco" aria-labelledby="dv-links">
        <h2 id="dv-links" class="bloco-titulo">${t('divulgacao.linksTitulo')}</h2>
        <p class="bloco-nota">${t('divulgacao.base')} <strong>${base}</strong>${c.site ? '' : html` (${t('divulgacao.baseAtual')})`}</p>
        <ul class="links-lista" role="list">
            ${linhaLink('dv-pagina', t('divulgacao.links.pagina'), t('divulgacao.links.paginaDica'), `${base}divulgacao.html`)}
            ${linhaLink('dv-login', t('divulgacao.links.login'), t('divulgacao.links.loginDica'), enderecoDe('login'))}
            ${linhaLink('dv-validar', t('divulgacao.links.validar'), t('divulgacao.links.validarDica'), enderecoDe('validar'))}
            ${linhaLink('dv-whatsapp', t('divulgacao.links.whatsapp'), t('divulgacao.links.whatsappDica'), linkWhatsapp(c.whatsapp, c.whatsappMensagem))}
        </ul>
        <h3 class="subbloco-titulo">${t('divulgacao.empresasTitulo')}</h3>
        ${empresas.length ? html`<ul class="links-lista" role="list">
            ${empresas.map((e) => linhaLink(`dv-e-${e.id}`, e.nome, '', enderecoDe(`e/${e.identificador}`)))}
        </ul>` : html`<p class="vazio">${t('divulgacao.semEmpresas')}</p>`}
    </section>`;
}

// --------------------------------------------------------------------- tela --

export async function tela({ usuario, recarregar }) {
    const [salva, empresas] = await Promise.all([
        dados.carregarConfiguracao(),
        dados.listarEmpresas(usuario, { situacao: 'ativas' }),
    ]);
    // Sem a tabela no banco (SQL ainda não rodado): mostra os valores de fábrica, sem salvar.
    const c = { ...PADRAO, ...(salva ?? {}) };
    const base = dados.enderecoSite();
    const semBanco = !salva;
    const bloqueio = semBanco ? html`disabled` : '';

    return {
        titulo: t('divulgacao.titulo'),
        conteudo: html`
            <header class="cabecalho">
                <h1 class="titulo" tabindex="-1">${t('divulgacao.titulo')}</h1>
                <p class="subtitulo">${t('divulgacao.sub')}</p>
            </header>
            ${semBanco ? html`<p class="nota nota--aviso" role="alert">${icone('alert', 'icone icone--p')}${t('divulgacao.semConfig')}</p>` : ''}
            ${ehLocal(base) ? html`<p class="nota nota--aviso">${icone('alert', 'icone icone--p')}${t('divulgacao.local')}</p>` : ''}
            <div class="painel-grade">
                <div class="painel-coluna">
                    ${blocoLinks(c, empresas)}

                    <section class="painel-bloco" aria-labelledby="dv-email">
                        <h2 id="dv-email" class="bloco-titulo">${t('divulgacao.secaoEmail')}</h2>
                        <p class="bloco-nota">${t('divulgacao.emailNota')}</p>
                        <div class="acoes acoes--p">
                            <button type="button" class="botao botao--primario botao--p" data-email="copiar">${icone('copy', 'icone icone--p')}${t('divulgacao.copiarEmail')}</button>
                            <button type="button" class="botao botao--secundario botao--p" data-email="assunto">${t('divulgacao.copiarAssunto')}</button>
                            <button type="button" class="botao botao--secundario botao--p" data-email="baixar">${icone('download', 'icone icone--p')}${t('divulgacao.baixarHtml')}</button>
                        </div>
                        <div data-previa>${previaEmail(c)}</div>
                        <form class="formulario formulario--compacto" data-form="email" novalidate>
                            <h3 class="subbloco-titulo">${t('divulgacao.editarEmail')}</h3>
                            <div class="campo">
                                <label for="dv-assunto">${t('divulgacao.campoAssunto')}</label>
                                <input id="dv-assunto" name="emailAssunto" maxlength="150" required value="${c.emailAssunto}">
                            </div>
                            <div class="campo">
                                <label for="dv-titulo">${t('divulgacao.campoTitulo')}</label>
                                <input id="dv-titulo" name="emailTitulo" maxlength="200" required value="${c.emailTitulo}">
                            </div>
                            <div class="campo">
                                <label for="dv-texto">${t('divulgacao.campoTexto')}</label>
                                <textarea id="dv-texto" name="emailTexto" rows="4" maxlength="800" required>${c.emailTexto}</textarea>
                            </div>
                            <p class="campo-erro" data-resumo-erro role="alert" hidden></p>
                            <div class="acoes acoes--p"><button type="submit" class="botao botao--primario" ${bloqueio}>${t('divulgacao.salvarEmail')}</button></div>
                        </form>
                    </section>
                </div>

                <div class="painel-coluna painel-coluna--lateral">
                    <form class="painel-bloco formulario" data-form="config" novalidate aria-labelledby="dv-config">
                        <h2 id="dv-config" class="bloco-titulo">${t('divulgacao.configTitulo')}</h2>
                        <div class="campo">
                            <label for="dv-site">${t('divulgacao.site')}</label>
                            <input id="dv-site" name="site" type="url" inputmode="url" maxlength="200" value="${c.site}" placeholder="https://www.seudominio.com.br" autocomplete="off" spellcheck="false" autocapitalize="none" aria-describedby="dv-site-dica">
                            <p id="dv-site-dica" class="campo-dica">${t('divulgacao.siteDica', { atual: new URL('./', window.location.href.split('#')[0]).href })}</p>
                        </div>
                        <div class="campo">
                            <label for="dv-whatsapp">${t('divulgacao.whatsapp')}</label>
                            <input id="dv-whatsapp" name="whatsapp" inputmode="numeric" maxlength="20" required value="${c.whatsapp}" autocomplete="off" aria-describedby="dv-whatsapp-dica">
                            <p id="dv-whatsapp-dica" class="campo-dica">${t('divulgacao.whatsappDica')}</p>
                        </div>
                        <div class="campo">
                            <label for="dv-whatsapp-msg">${t('divulgacao.whatsappMensagem')}</label>
                            <textarea id="dv-whatsapp-msg" name="whatsappMensagem" rows="2" maxlength="300" required>${c.whatsappMensagem}</textarea>
                        </div>
                        <p class="campo-erro" data-resumo-erro role="alert" hidden></p>
                        <div class="acoes acoes--p"><button type="submit" class="botao botao--primario" ${bloqueio}>${t('comum.salvar')}</button></div>
                        ${salva?.atualizadoEm ? html`<p class="bloco-nota">${t('divulgacao.atualizado', { quando: formatarRelativo(salva.atualizadoEm) })}</p>` : ''}
                    </form>

                    <section class="painel-bloco painel-bloco--sutil" aria-labelledby="dv-dominio">
                        <h2 id="dv-dominio" class="bloco-titulo">${t('divulgacao.dominioTitulo')}</h2>
                        <ol class="lista-marcada">${t('divulgacao.dominioPassos').map((passo) => html`<li>${passo}</li>`)}</ol>
                    </section>
                </div>
            </div>`,

        montar(raiz) {
            // Os dois formulários gravam a mesma configuração: cada um manda o seu pedaço junto com o resto.
            const salvar = async (form, mensagem) => {
                limparErros(form);
                const enviar = form.querySelector('[type="submit"]');
                enviar.disabled = true;
                try {
                    await dados.salvarConfiguracao({ ...c, ...Object.fromEntries(new FormData(form)) });
                    anunciar(mensagem);
                    await recarregar();
                } catch (erro) {
                    mostrarErro(erro, form);
                    enviar.disabled = false;
                }
            };
            const formConfig = raiz.querySelector('[data-form="config"]');
            const formEmail = raiz.querySelector('[data-form="email"]');
            formConfig.addEventListener('submit', (evento) => {
                evento.preventDefault();
                salvar(formConfig, t('divulgacao.salva'));
            });
            formEmail.addEventListener('submit', (evento) => {
                evento.preventDefault();
                salvar(formEmail, t('divulgacao.emailSalvo'));
            });
            // A prévia acompanha o texto enquanto se digita (o e-mail copiado usa o que está na tela).
            const atual = () => ({ ...c, ...Object.fromEntries(new FormData(formEmail)) });
            formEmail.addEventListener('input', () => desenharEm(raiz.querySelector('[data-previa]'), previaEmail(atual())));

            raiz.addEventListener('click', (evento) => {
                const copiar = evento.target.closest('[data-copiar]');
                if (copiar) {
                    copiarTexto(copiar.dataset.copiar);
                    return;
                }
                evento.target.closest('[data-selecionar]')?.select();
                const acao = evento.target.closest('[data-email]')?.dataset.email;
                if (acao === 'copiar') copiarEmail(atual(), base);
                if (acao === 'assunto') copiarTexto(atual().emailAssunto, t('divulgacao.assuntoCopiado'));
                if (acao === 'baixar') {
                    baixarArquivo('email-divulgacao.html', arquivoEmail(atual(), base), 'text/html;charset=utf-8');
                    anunciar(t('divulgacao.baixado'));
                }
            });
        },
    };
}
