// Equipe da consultoria (só o administrador): pessoas, desativação e convites.

import * as dados from '../dados.js';
import { podeConvidar } from '../regras.js';
import { t } from '../textos.js';
import { html } from '../app.js';
import { blocoConvites, ligarConvites, listaPessoas, ligarPessoas } from './pessoas.js';

export async function tela({ usuario, recarregar }) {
    const [equipe, convites] = await Promise.all([dados.listarEquipe(usuario), dados.listarConvites(usuario, null)]);
    const perfis = ['admin', 'consultant'].filter((p) => podeConvidar(usuario, p, null));

    return {
        titulo: t('equipe.titulo'),
        conteudo: html`
            <header class="cabecalho">
                <h1 class="titulo" tabindex="-1">${t('equipe.titulo')}</h1>
                <p class="subtitulo">${t('equipe.sub')}</p>
            </header>
            <div class="painel-grade">
                <div class="painel-coluna">
                    <section class="painel-bloco" aria-labelledby="equipe-lista">
                        <h2 id="equipe-lista" class="sr-only">${t('equipe.titulo')}</h2>
                        ${listaPessoas(usuario, equipe, t('equipe.nenhuma'))}
                    </section>
                </div>
                <div class="painel-coluna painel-coluna--lateral">
                    ${blocoConvites({ perfis, convites, titulo: t('convites.tituloEquipe'), empresaId: null })}
                </div>
            </div>`,
        montar(raiz) {
            ligarPessoas(raiz, usuario, recarregar);
            ligarConvites(raiz, usuario, null, recarregar);
        },
    };
}
