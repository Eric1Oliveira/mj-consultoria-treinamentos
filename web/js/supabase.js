// Cliente mínimo do Supabase (Auth + REST + RPC) com fetch, sem dependências.
// A chave publishable é pública por definição: quem protege os dados é o RLS do banco.

export const SUPABASE_URL = 'https://ehhksabwmdtpeyxxorwn.supabase.co';
const ANON = 'sb_publishable_7OEQ2a-yKHbPu8eePojkxQ_jl74WzcP';
const CHAVE_SESSAO = 'mjc:sessao';

/** Erro vindo do Supabase: `codigo` e `detalhe` são os que as funções do banco enviam. */
export class ErroSupabase extends Error {
    constructor(status, corpo) {
        super(corpo?.message || corpo?.msg || corpo?.error_description || `HTTP ${status}`);
        this.status = status;
        this.codigo = corpo?.message ?? corpo?.error_code ?? corpo?.error ?? null;
        this.detalhe = corpo?.details ?? null;
        this.corpo = corpo;
    }
}

let sessao = lerSessao();

function lerSessao() {
    try {
        return JSON.parse(localStorage.getItem(CHAVE_SESSAO)) ?? null;
    } catch {
        return null;
    }
}

function guardarSessao(nova) {
    sessao = nova ? { access_token: nova.access_token, refresh_token: nova.refresh_token, expires_at: nova.expires_at ?? Math.floor(Date.now() / 1000) + (nova.expires_in ?? 3600) } : null;
    try {
        if (sessao) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
        else localStorage.removeItem(CHAVE_SESSAO);
    } catch {
        // sem localStorage: a sessão vale só nesta aba
    }
}

async function chamar(caminho, { metodo = 'GET', corpo, token, cabecalhos = {} } = {}) {
    const resposta = await fetch(`${SUPABASE_URL}${caminho}`, {
        method: metodo,
        // A chave publishable vai só no apikey; Authorization leva apenas o token da sessão.
        headers: { apikey: ANON, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json', ...cabecalhos },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const textoResposta = await resposta.text();
    const dados = textoResposta ? JSON.parse(textoResposta) : null;
    if (!resposta.ok) throw new ErroSupabase(resposta.status, dados);
    return dados;
}

let renovando = null;

/** Token válido da sessão (renova sozinho perto de expirar) ou null. */
async function tokenAtual() {
    if (!sessao) return null;
    if (sessao.expires_at - 60 > Date.now() / 1000) return sessao.access_token;
    renovando ??= chamar('/auth/v1/token?grant_type=refresh_token', { metodo: 'POST', corpo: { refresh_token: sessao.refresh_token } })
        .then(guardarSessao)
        .catch(() => guardarSessao(null))
        .finally(() => { renovando = null; });
    await renovando;
    return sessao?.access_token ?? null;
}

export const temSessao = () => Boolean(sessao);

export async function entrarComSenha(email, senha) {
    guardarSessao(await chamar('/auth/v1/token?grant_type=password', { metodo: 'POST', corpo: { email, password: senha } }));
}

/** Cria a conta. Com "Confirm email" desligado no Supabase, já volta com a sessão. */
export async function cadastrar(email, senha) {
    const resposta = await chamar('/auth/v1/signup', { metodo: 'POST', corpo: { email, password: senha } });
    if (resposta?.access_token) guardarSessao(resposta);
    return Boolean(resposta?.access_token);
}

export async function sair() {
    const token = await tokenAtual();
    guardarSessao(null);
    if (token) await chamar('/auth/v1/logout', { metodo: 'POST', token }).catch(() => {});
}

/** Leitura de tabela pela API REST (filtrada pelo RLS). `consulta` = query string do PostgREST. */
export async function ler(tabela, consulta = 'select=*') {
    return chamar(`/rest/v1/${tabela}?${consulta}`, { token: await tokenAtual() });
}

export async function rpc(funcao, argumentos = {}) {
    return chamar(`/rest/v1/rpc/${funcao}`, { metodo: 'POST', corpo: argumentos, token: await tokenAtual() });
}
