// Único módulo que lê e grava dados — agora no Supabase.
//
// Leituras: API REST, filtrada no servidor pelo RLS (cada perfil só recebe o que pode ver).
// Escritas: só por funções do banco (RPC), que conferem a permissão e gravam a auditoria.
// A estrutura do banco está em supabase/schema.sql.
// As checagens de permissão daqui servem só para a interface; quem decide é o servidor.

import * as sb from './supabase.js';
import {
    ehEquipe, podeEstudar, pode, filtrarVisiveis, convitePendente,
    emailValido, gerarIdentificador, codigoYoutube, nivelPorPontos, sequenciaDias, marcaDe, DESAFIO_SEMANAL,
} from './regras.js';

const CHAVE_PREFERENCIAS = 'mjc:preferencias';
export const LOGO_MAX_BYTES = 200 * 1024;
export const SENHA_MINIMA = 8;

export class ErroDados extends Error {
    /**
     * @param {string} codigo 'credenciais' | 'proibido' | 'nao-encontrado' | 'inativo' | 'validacao'
     * @param {Record<string, string>} campos   campo → chave de mensagem (em erros.campos.*)
     * @param {Record<string, string|number>} params valores para as mensagens
     */
    constructor(codigo, campos = {}, params = {}) {
        super(codigo);
        this.codigo = codigo;
        this.campos = campos;
        this.params = params;
    }
}

// ----------------------------------------------------------------- acesso --

const CODIGOS = new Set(['proibido', 'nao-encontrado', 'inativo', 'validacao', 'credenciais']);

/** Converte o erro do Supabase no ErroDados que as telas já sabem mostrar. */
function converter(erro) {
    if (!(erro instanceof sb.ErroSupabase)) return erro;
    if (CODIGOS.has(erro.codigo)) {
        let campos = {};
        try { campos = erro.detalhe ? JSON.parse(erro.detalhe) : {}; } catch { /* sem campos */ }
        return new ErroDados(erro.codigo, campos);
    }
    if (erro.status === 401 || erro.status === 403) return new ErroDados('proibido');
    return erro;
}

async function rpc(funcao, argumentos) {
    try {
        return await sb.rpc(funcao, argumentos);
    } catch (erro) {
        throw converter(erro);
    }
}

async function ler(tabela, consulta) {
    try {
        return await sb.ler(tabela, consulta);
    } catch (erro) {
        throw converter(erro);
    }
}

const valor = (v) => encodeURIComponent(v);

/** Linha do banco (snake_case) → objeto das telas (camelCase). Só o primeiro nível. */
function camel(linha) {
    if (!linha) return linha;
    return Object.fromEntries(Object.entries(linha).map(([k, v]) => [k.replace(/_([a-z])/g, (_, l) => l.toUpperCase()), v]));
}

function curso(linha, gabarito = null) {
    const { questoes, ...resto } = camel(linha);
    return { ...resto, avaliacao: { questoes: gabarito ? questoes.map((q) => ({ ...q, correta: gabarito[q.id] ?? 0 })) : questoes } };
}

function texto(valorBruto, maximo) {
    return String(valorBruto ?? '').trim().slice(0, maximo);
}

function exigir(condicao, codigo = 'proibido') {
    if (!condicao) throw new ErroDados(codigo);
}

// ------------------------------------------------------------------ sessão --

let eu = null; // perfil de quem está logado (conferido pelo servidor ao entrar e ao abrir o site)

/** Usuário logado; as telas passam `usuario` por compatibilidade, mas o servidor usa o token. */
function atual() {
    exigir(eu);
    return eu;
}

export async function iniciar() {
    if (!sb.temSessao()) return;
    try {
        eu = camel(await sb.rpc('meu_perfil'));
    } catch {
        eu = null;
    }
    if (!eu) await sb.sair();
}

export async function usuarioAtual() {
    return eu ? { ...eu } : null;
}

export async function entrar(email, senha) {
    try {
        await sb.entrarComSenha(texto(email, 255).toLowerCase(), String(senha ?? ''));
    } catch {
        throw new ErroDados('credenciais');
    }
    eu = camel(await rpc('registrar_acesso'));
    if (!eu) {
        await sb.sair();
        throw new ErroDados('credenciais');
    }
    return { ...eu };
}

export async function sair() {
    eu = null;
    await sb.sair();
}

/** Vitrine da tela de entrada: as empresas ativas com a marca delas. */
export async function listarEmpresasPublicas() {
    return (await rpc('listar_empresas_publicas')).map((linha) => {
        const e = camel(linha);
        return { id: e.id, nome: e.nome, identificador: e.identificador, ...marcaDe(e) };
    });
}

// ------------------------------------------------------------ preferências --
// Idioma e tema são preferências deste navegador (não são dados da plataforma).

export async function lerPreferencias() {
    try {
        return { idioma: null, tema: null, ...(JSON.parse(localStorage.getItem(CHAVE_PREFERENCIAS)) ?? {}) };
    } catch {
        return { idioma: null, tema: null };
    }
}

export async function salvarPreferencias(mudancas) {
    try {
        localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify({ ...(await lerPreferencias()), ...mudancas }));
    } catch {
        // sem localStorage: vale só até recarregar
    }
}

export async function definirIdiomaDaConta(_usuarioId, idioma) {
    if (!eu) return;
    await rpc('definir_idioma', { p_idioma: idioma });
    eu.idioma = idioma;
}

export async function atualizarConta(_usuario, { nome, idioma }) {
    atual();
    eu = camel(await rpc('atualizar_conta', { p_nome: nome ?? '', p_idioma: idioma ?? '' }));
    return { ...eu };
}

// ---------------------------------------------------------------- empresas --

export async function obterEmpresa(id) {
    if (!id) return null;
    const [linha] = await ler('empresas', `select=*&id=eq.${valor(id)}`);
    return camel(linha) ?? null;
}

/** Página pública da empresa: só empresa ativa. */
export async function obterEmpresaPublica(identificador) {
    return camel(await rpc('obter_empresa_publica', { p_identificador: identificador })) ?? null;
}

export async function listarEmpresas(_usuario, { busca = '', situacao = 'todas' } = {}) {
    exigir(pode(atual(), 'ver-empresas'));
    const termo = busca.trim().toLowerCase();
    const [empresas, pessoas] = await Promise.all([
        ler('empresas', 'select=*&order=nome'),
        ler('perfis', 'select=empresa_id&ativo=eq.true&empresa_id=not.is.null'),
    ]);
    return empresas.map(camel)
        .filter((e) => !termo || e.nome.toLowerCase().includes(termo) || e.identificador.includes(termo))
        .filter((e) => situacao === 'todas' || (situacao === 'ativas' ? e.ativa : !e.ativa))
        .map((e) => ({ ...e, pessoasAtivas: pessoas.filter((p) => p.empresa_id === e.id).length }));
}

/** Logo: confere o conteúdo real do arquivo (assinatura dos bytes), não só o nome. */
export async function lerLogo(arquivo) {
    if (arquivo.size > LOGO_MAX_BYTES) throw new ErroDados('validacao', { logo: 'logoTamanho' });
    const bytes = new Uint8Array(await arquivo.slice(0, 12).arrayBuffer());
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    const tipo = hex.startsWith('89504e47') ? 'image/png'
        : hex.startsWith('ffd8ff') ? 'image/jpeg'
            : hex.startsWith('52494646') && hex.slice(16, 24) === '57454250' ? 'image/webp' : null;
    if (!tipo) throw new ErroDados('validacao', { logo: 'logoTipo' });

    const dataUrl = await new Promise((resolver, rejeitar) => {
        const leitor = new FileReader();
        leitor.onload = () => resolver(String(leitor.result).replace(/^data:[^;]*;/, `data:${tipo};`));
        leitor.onerror = () => rejeitar(new ErroDados('validacao', { logo: 'logoTipo' }));
        leitor.readAsDataURL(arquivo);
    });
    const { largura, altura } = await new Promise((resolver) => {
        const imagem = new Image();
        imagem.onload = () => resolver({ largura: imagem.naturalWidth, altura: imagem.naturalHeight });
        imagem.onerror = () => resolver({ largura: 0, altura: 0 });
        imagem.src = dataUrl;
    });
    if (largura < 32 || altura < 32 || largura > 2000 || altura > 2000) throw new ErroDados('validacao', { logo: 'logoDimensoes' });
    return dataUrl;
}

export async function salvarEmpresa(_usuario, entrada) {
    exigir(pode(atual(), 'gerir-empresas'));
    let identificador = texto(entrada.identificador, 60).toLowerCase();
    if (!identificador && !entrada.id && texto(entrada.nome, 150)) {
        const usados = new Set((await ler('empresas', 'select=identificador')).map((e) => e.identificador));
        const base = gerarIdentificador(entrada.nome);
        identificador = base;
        for (let i = 2; usados.has(identificador); i++) identificador = `${base}-${i}`;
    }
    return camel(await rpc('salvar_empresa', {
        entrada: {
            id: entrada.id || null,
            nome: entrada.nome ?? '',
            identificador,
            mensagem: entrada.mensagem ?? '',
            ativa: Boolean(entrada.ativa),
            solicitacoesAtivas: Boolean(entrada.solicitacoesAtivas),
            aprovador: entrada.aprovador,
        },
    }));
}

/** Estúdio de marca: o gestor da empresa (só a dele) ou a equipe da consultoria. */
export async function salvarMarca(_usuario, empresaId, entrada) {
    exigir(pode(atual(), 'personalizar-marca', { empresaId }));
    const marca = {
        cor: entrada.cor ?? '', corSecundaria: entrada.corSecundaria ?? '', logo: entrada.logo ?? null,
        academia: entrada.academia ?? '', estiloMenu: entrada.estiloMenu, cantos: entrada.cantos, fonte: entrada.fonte,
        capasMarca: Boolean(entrada.capasMarca),
    };
    if (entrada.mensagem !== undefined) marca.mensagem = entrada.mensagem;
    return camel(await rpc('salvar_marca', { p_empresa: empresaId, entrada: marca }));
}

// ------------------------------------------------------------------ pessoas --

export async function listarPessoas(_usuario, empresaId, { busca = '', situacao = 'todas' } = {}) {
    const usuario = atual();
    exigir(pode(usuario, 'ver-pessoas', { empresaId }));
    const termo = busca.trim().toLowerCase();
    const pessoas = (await ler('perfis', `select=*&empresa_id=eq.${valor(empresaId)}&order=nome`)).map(camel);
    return filtrarVisiveis(usuario, pessoas)
        .filter((u) => !termo || u.nome.toLowerCase().includes(termo) || u.email.includes(termo))
        .filter((u) => situacao === 'todas' || (situacao === 'ativas' ? u.ativo : !u.ativo));
}

export async function listarEquipe() {
    exigir(pode(atual(), 'ver-equipe'));
    return (await ler('perfis', 'select=*&perfil=in.(admin,consultant)&order=nome')).map(camel);
}

export async function definirSituacaoPessoa(_usuario, pessoaId, ativo) {
    atual();
    return camel(await rpc('definir_situacao_pessoa', { p_pessoa: pessoaId, p_ativo: Boolean(ativo) }));
}

export async function definirPerfilPessoa(_usuario, pessoaId, perfil) {
    atual();
    return camel(await rpc('definir_perfil_pessoa', { p_pessoa: pessoaId, p_perfil: perfil }));
}

export async function renomearPessoa(_usuario, pessoaId, nome) {
    atual();
    return camel(await rpc('renomear_pessoa', { p_pessoa: pessoaId, p_nome: nome ?? '' }));
}

// ------------------------------------------------------------------ convites --

function conviteParaTela(linha) {
    const convite = camel(linha);
    return {
        ...convite,
        pendente: convitePendente(convite),
        expirado: !convite.aceitoEm && !convite.canceladoEm && !convitePendente(convite),
        convidadoPorNome: convite.convidadoPorNome ?? convite.convidado?.nome ?? null,
    };
}

export async function listarConvites(_usuario, empresaId) {
    const usuario = atual();
    if (empresaId) exigir(pode(usuario, 'ver-pessoas', { empresaId }));
    else exigir(pode(usuario, 'ver-equipe'));
    const daEmpresa = empresaId ? `empresa_id=eq.${valor(empresaId)}` : 'empresa_id=is.null';
    const linhas = await ler('convites', `select=*,convidado:convidado_por(nome)&${daEmpresa}&aceito_em=is.null&cancelado_em=is.null&order=criado_em.desc`);
    return linhas.map(conviteParaTela);
}

export async function criarConvite(_usuario, { email, perfil, empresaId }) {
    atual();
    return conviteParaTela(await rpc('criar_convite', { p_email: email ?? '', p_perfil: perfil, p_empresa: empresaId || null }));
}

/** Convite em lote: analisa as linhas ("Nome; e-mail" ou só o e-mail) antes de criar. */
export async function analisarLote(_usuario, _empresaId, conteudo) {
    atual();
    const linhas = String(conteudo || '').split(/\r?\n/).map((linha, i) => ({ linha, numero: i + 1 }))
        .filter(({ linha }) => linha.trim())
        .slice(0, 200)
        .map(({ linha, numero }) => {
            const partes = linha.split(/[;,\t]/).map((p) => p.trim()).filter(Boolean);
            return { numero, nome: partes.find((p) => !p.includes('@')) ?? '', email: (partes.find((p) => p.includes('@')) ?? '').toLowerCase() };
        });
    const validos = [...new Set(linhas.map((l) => l.email).filter(emailValido))];
    const bloqueios = validos.length ? await rpc('emails_bloqueados', { p_emails: validos }) : {};
    const vistos = new Set();
    return linhas.map((l) => {
        let motivo = emailValido(l.email) ? bloqueios[l.email] ?? null : 'email';
        if (!motivo && vistos.has(l.email)) motivo = 'duplicadoNaLista';
        vistos.add(l.email);
        return { ...l, ok: !motivo, motivo };
    });
}

export async function criarConvitesEmLote(_usuario, empresaId, emails) {
    atual();
    return (await rpc('criar_convites_lote', { p_empresa: empresaId, p_emails: emails.map(String) })).map(conviteParaTela);
}

/** Gera link novo (o anterior deixa de valer) e renova a validade. */
export async function renovarConvite(_usuario, conviteId) {
    atual();
    return conviteParaTela(await rpc('renovar_convite', { p_id: conviteId }));
}

export async function cancelarConvite(_usuario, conviteId) {
    atual();
    await rpc('cancelar_convite', { p_id: conviteId });
}

/** Página pública do convite. */
export async function obterConvite(codigo) {
    const convite = await rpc('obter_convite', { p_codigo: codigo });
    if (!convite) return null;
    const empresa = convite.empresa ? camel(convite.empresa) : null;
    return { email: convite.email, perfil: convite.perfil, empresa: empresa ? { id: empresa.id, nome: empresa.nome, mensagem: empresa.mensagem, ...marcaDe(empresa) } : null };
}

/** Aceite: cria a conta de acesso (e-mail do convite + senha escolhida) e o perfil. */
export async function aceitarConvite(codigo, nome, senha) {
    const convite = await obterConvite(codigo);
    if (!convite) throw new ErroDados('nao-encontrado');
    const erros = {};
    if (!texto(nome, 120)) erros.nome = 'obrigatorio';
    if (String(senha ?? '').length < SENHA_MINIMA) erros.senha = 'senhaCurta';
    if (Object.keys(erros).length) throw new ErroDados('validacao', erros, { min: SENHA_MINIMA });

    try {
        const comSessao = await sb.cadastrar(convite.email, senha);
        if (!comSessao) await sb.entrarComSenha(convite.email, senha);
    } catch (erro) {
        // Conta de acesso já existe (aceite interrompido antes): entra com a mesma senha.
        try {
            await sb.entrarComSenha(convite.email, senha);
        } catch {
            throw erro instanceof sb.ErroSupabase && erro.status === 422 && !/already/i.test(erro.message)
                ? new ErroDados('validacao', { senha: 'senhaFraca' }, { min: SENHA_MINIMA })
                : new ErroDados('validacao', { senha: 'senhaConta' });
        }
    }
    eu = camel(await rpc('aceitar_convite', { p_codigo: codigo, p_nome: nome }));
    return { ...eu };
}

// -------------------------------------------------------------- solicitações --

/** Pedido de acesso pela página da empresa (resposta sempre igual, sem expor terceiros). */
export async function enviarSolicitacao(identificador, { nome, email, mensagem }) {
    await rpc('enviar_solicitacao', { p_identificador: identificador, p_nome: nome ?? '', p_email: email ?? '', p_mensagem: mensagem ?? '' });
}

export async function listarSolicitacoes(_usuario, { empresaId = '', situacao = 'pendente' } = {}) {
    const usuario = atual();
    exigir(pode(usuario, 'ver-solicitacoes'));
    const filtros = ['select=*,empresa:empresa_id(id,nome,aprovador,ativa),decisor:decidido_por(nome)', 'order=criado_em.desc'];
    if (empresaId) filtros.push(`empresa_id=eq.${valor(empresaId)}`);
    if (situacao !== 'todas') filtros.push(`situacao=eq.${valor(situacao)}`);
    return (await ler('solicitacoes', filtros.join('&'))).map((linha) => {
        const s = camel(linha);
        return {
            ...s,
            empresaNome: s.empresa?.nome ?? '',
            podeDecidir: s.situacao === 'pendente' && pode(usuario, 'decidir-solicitacao', { empresa: s.empresa }),
            decididoPorNome: s.decisor?.nome ?? null,
        };
    });
}

/** Aprovar gera um convite (mesmas regras de qualquer convite). */
export async function aprovarSolicitacao(_usuario, id) {
    atual();
    return conviteParaTela(await rpc('aprovar_solicitacao', { p_id: id }));
}

export async function recusarSolicitacao(_usuario, id, motivo) {
    atual();
    await rpc('recusar_solicitacao', { p_id: id, p_motivo: motivo ?? '' });
}

// ------------------------------------------------------------------ cursos --

const aulasDoCurso = (c) => c.modulos.flatMap((m) => m.aulas);

function progressoDe(c, matricula) {
    const aulas = aulasDoCurso(c);
    if (!matricula) return { matriculado: false, total: aulas.length, feitas: 0, percentual: 0 };
    const feitas = aulas.filter((a) => matricula.aulasConcluidas.includes(a.id)).length;
    const melhor = matricula.tentativas.reduce((max, t) => Math.max(max, t.nota), -1);
    return {
        matriculado: true,
        total: aulas.length,
        feitas,
        percentual: aulas.length ? Math.round((feitas / aulas.length) * 100) : 0,
        proximaAulaId: aulas.find((a) => !matricula.aulasConcluidas.includes(a.id))?.id ?? null,
        aprovado: matricula.tentativas.some((t) => t.aprovado),
        melhorNota: melhor >= 0 ? melhor : null,
        tentativasFeitas: matricula.tentativas.length,
        tentativasRestantes: Math.max(0, c.tentativas - matricula.tentativas.length),
        concluido: Boolean(matricula.concluidoEm),
        concluidoEm: matricula.concluidoEm,
        certificadoId: matricula.certificadoId,
    };
}

/** Curso visível para quem estuda: ativo e liberado para a empresa da pessoa. */
function cursoLiberado(c, pessoa) {
    return c.ativo && podeEstudar(pessoa.perfil) && c.empresas.includes(pessoa.empresaId);
}

async function lerCurso(cursoId, comGabarito = false) {
    const [linha] = await ler('cursos', `select=*&id=eq.${valor(cursoId)}`);
    exigir(linha, 'nao-encontrado');
    let gabarito = null;
    if (comGabarito) [{ respostas: gabarito } = { respostas: {} }] = await ler('cursos_gabarito', `select=respostas&curso_id=eq.${valor(cursoId)}`);
    return curso(linha, gabarito);
}

async function minhaMatriculaEm(cursoId) {
    const [linha] = await ler('matriculas', `select=*&curso_id=eq.${valor(cursoId)}&usuario_id=eq.${valor(eu.id)}`);
    return camel(linha) ?? null;
}

export async function listarCursos(_usuario, { busca = '' } = {}) {
    const usuario = atual();
    const termo = busca.trim().toLowerCase();
    const [cursos, matriculas] = await Promise.all([
        ler('cursos', 'select=*&order=titulo'),
        ler('matriculas', 'select=curso_id,usuario_id,aulas_concluidas,tentativas,concluido_em,certificado_id'),
    ]);
    return cursos.map((linha) => curso(linha))
        .filter((c) => !termo || c.titulo.toLowerCase().includes(termo))
        .filter((c) => ehEquipe(usuario.perfil) || cursoLiberado(c, usuario))
        .map((c) => {
            const daTurma = matriculas.filter((m) => m.curso_id === c.id).map(camel);
            const minha = daTurma.find((m) => m.usuarioId === usuario.id);
            return {
                id: c.id, titulo: c.titulo, descricao: c.descricao, cargaHoraria: c.cargaHoraria, ativo: c.ativo, empresas: c.empresas,
                modulos: c.modulos.length, aulas: aulasDoCurso(c).length,
                matriculados: daTurma.length, concluidos: daTurma.filter((m) => m.concluidoEm).length,
                progresso: podeEstudar(usuario.perfil) ? progressoDe(c, minha) : null,
            };
        });
}

export async function obterCurso(_usuario, cursoId) {
    const usuario = atual();
    const equipe = ehEquipe(usuario.perfil);
    const c = await lerCurso(cursoId, equipe);
    exigir(equipe || cursoLiberado(c, usuario));
    const matricula = await minhaMatriculaEm(cursoId);
    return {
        ...c,
        progresso: podeEstudar(usuario.perfil) ? progressoDe(c, matricula) : null,
        aulasConcluidas: matricula?.aulasConcluidas ?? [],
    };
}

/** Cria ou atualiza o curso inteiro (dados, módulos, aulas e avaliação). O servidor separa o gabarito. */
export async function salvarCurso(_usuario, entrada) {
    exigir(pode(atual(), 'gerir-cursos'));
    const erros = {};
    if (!texto(entrada.titulo, 150)) erros.titulo = 'obrigatorio';
    const numero = (v, min, max, padrao) => {
        const n = Number(v);
        return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : padrao;
    };
    const novoId = () => crypto.randomUUID();
    const modulos = (entrada.modulos ?? []).map((m) => ({
        id: m.id || novoId(),
        titulo: texto(m.titulo, 120) || '—',
        aulas: (m.aulas ?? []).map((a) => {
            const tipo = a.tipo === 'video' ? 'video' : 'texto';
            const videoId = tipo === 'video' ? codigoYoutube(a.video ?? a.videoId) : null;
            if (tipo === 'video' && !videoId) erros.video = 'video';
            return { id: a.id || novoId(), titulo: texto(a.titulo, 150) || '—', tipo, minutos: numero(a.minutos, 0, 600, 10), conteudo: texto(a.conteudo, 4000), videoId };
        }),
    }));
    const questoes = (entrada.avaliacao?.questoes ?? []).map((q) => {
        const alternativas = (q.alternativas ?? []).map((alt) => texto(alt, 200)).filter(Boolean);
        if (!texto(q.enunciado, 400) || alternativas.length < 2) erros.questoes = 'questao';
        return { id: q.id || novoId(), enunciado: texto(q.enunciado, 400), alternativas, correta: numero(q.correta, 0, Math.max(0, alternativas.length - 1), 0) };
    });
    if (Object.keys(erros).length) throw new ErroDados('validacao', erros);

    const salvo = await rpc('salvar_curso', {
        entrada: {
            id: entrada.id || null,
            titulo: entrada.titulo,
            descricao: entrada.descricao ?? '',
            cargaHoraria: numero(entrada.cargaHoraria, 1, 400, 1),
            notaMinima: numero(entrada.notaMinima, 0, 100, 70),
            tentativas: numero(entrada.tentativas, 1, 10, 3),
            ativo: Boolean(entrada.ativo),
            avancoAutomatico: Boolean(entrada.avancoAutomatico),
            empresas: entrada.empresas ?? [],
            modulos,
            avaliacao: { questoes },
        },
    });
    return { ...curso(salvo), avaliacao: { questoes } };
}

/** Pessoas que o usuário pode matricular neste curso (para o seletor da equipe/gestor). */
export async function pessoasParaMatricular(_usuario, cursoId) {
    const usuario = atual();
    const c = await lerCurso(cursoId);
    const [pessoas, matriculas, empresas] = await Promise.all([
        ler('perfis', 'select=*&ativo=eq.true&empresa_id=not.is.null'),
        ler('matriculas', `select=usuario_id&curso_id=eq.${valor(cursoId)}`),
        ler('empresas', 'select=id,nome'),
    ]);
    const jaMatriculados = new Set(matriculas.map((m) => m.usuario_id));
    return pessoas.map(camel)
        .filter((p) => p.id !== usuario.id && cursoLiberado(c, p) && pode(usuario, 'matricular', { pessoa: p }) && !jaMatriculados.has(p.id))
        .map(({ id, nome, empresaId }) => ({ id, nome, empresaNome: empresas.find((e) => e.id === empresaId)?.nome ?? '' }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function matricular(_usuario, cursoId, pessoaId = null) {
    atual();
    const [matricula, c] = await Promise.all([
        rpc('matricular', { p_curso: cursoId, p_pessoa: pessoaId }),
        lerCurso(cursoId),
    ]);
    return progressoDe(c, camel(matricula));
}

/** Marca a aula como concluída (uma vez só); pontos e conclusão são calculados no servidor. */
export async function concluirAula(_usuario, cursoId, aulaId) {
    atual();
    const resultado = await rpc('concluir_aula', { p_curso: cursoId, p_aula: aulaId });
    const c = await lerCurso(cursoId);
    return { ...progressoDe(c, camel(resultado.matricula)), pontosGanhos: resultado.pontosGanhos };
}

/** Corrigida no servidor: o gabarito nunca chega ao navegador de quem estuda. */
export async function enviarAvaliacao(_usuario, cursoId, respostas) {
    atual();
    const resultado = await rpc('enviar_avaliacao', {
        p_curso: cursoId,
        p_respostas: Object.fromEntries(Object.entries(respostas).map(([id, v]) => [id, String(v)])),
    });
    const c = await lerCurso(cursoId);
    const { matricula, ...resto } = resultado;
    return { ...resto, progresso: progressoDe(c, camel(matricula)) };
}

/** Certificado: dono, gestor da empresa ou equipe (o RLS decide). */
export async function obterCertificado(_usuario, certificadoId) {
    atual();
    const [linha] = await ler('certificados', `select=*&id=eq.${valor(certificadoId)}`);
    exigir(linha, 'nao-encontrado');
    const c = camel(linha);
    return { ...c, curso: c.cursoTitulo, empresa: c.empresaNome };
}

// ------------------------------------------------------------- gamificação --

export async function perfilGamificacao() {
    const usuario = atual();
    const [meus, minhasMatriculas] = await Promise.all([
        ler('pontos', `select=tipo,ref,valor,em&usuario_id=eq.${valor(usuario.id)}`),
        ler('matriculas', `select=aulas_concluidas,tentativas,concluido_em&usuario_id=eq.${valor(usuario.id)}`).then((l) => l.map(camel)),
    ]);
    const total = meus.reduce((soma, p) => soma + p.valor, 0);
    const aulas = minhasMatriculas.reduce((soma, m) => soma + m.aulasConcluidas.length, 0);
    const sequencia = sequenciaDias(meus.map((p) => p.em));
    const limite = Date.now() - DESAFIO_SEMANAL.dias * 86_400_000;
    const aulasSemana = meus.filter((p) => p.tipo === 'aula' && new Date(p.em).getTime() >= limite).length;
    return {
        pontos: total,
        ...nivelPorPontos(total),
        sequencia,
        conquistas: {
            primeira_aula: aulas >= 1,
            dez_aulas: aulas >= 10,
            primeiro_curso: minhasMatriculas.some((m) => m.concluidoEm),
            nota_maxima: minhasMatriculas.some((m) => m.tentativas.some((t) => t.nota === 100)),
            sequencia_3: sequencia >= 3,
        },
        desafio: {
            meta: DESAFIO_SEMANAL.aulas,
            feito: Math.min(aulasSemana, DESAFIO_SEMANAL.aulas),
            cumprido: meus.some((p) => p.tipo === 'desafio' && p.ref === `semana-${Math.floor(Date.now() / (7 * 86_400_000))}`),
        },
    };
}

/** Ranking só da própria empresa: nunca mostra pessoas de outras empresas. */
export async function rankingEmpresa() {
    const usuario = atual();
    exigir(usuario.empresaId);
    return (await rpc('ranking_empresa')).map((linha, i) => ({ ...linha, posicao: i + 1, voce: linha.id === usuario.id }));
}

// ------------------------------------------------------------------- painel --

export async function resumoPainel() {
    const usuario = atual();
    if (ehEquipe(usuario.perfil)) {
        const [empresas, pessoas, cursos, matriculas, certificados, solicitacoes] = await Promise.all([
            ler('empresas', 'select=id&ativa=eq.true'),
            ler('perfis', 'select=id&ativo=eq.true&empresa_id=not.is.null'),
            ler('cursos', 'select=id&ativo=eq.true'),
            ler('matriculas', 'select=id'),
            ler('certificados', 'select=id'),
            ler('solicitacoes', 'select=id&situacao=eq.pendente'),
        ]);
        return {
            empresasAtivas: empresas.length,
            alunosAtivos: pessoas.length,
            cursosAtivos: cursos.length,
            matriculas: matriculas.length,
            certificados: certificados.length,
            solicitacoesPendentes: solicitacoes.length,
        };
    }
    if (usuario.perfil === 'company_admin') {
        const empresa = valor(usuario.empresaId);
        const [pessoas, matriculas, certificados, solicitacoes] = await Promise.all([
            ler('perfis', `select=id&ativo=eq.true&empresa_id=eq.${empresa}`),
            ler('matriculas', 'select=concluido_em'),
            ler('certificados', 'select=id'),
            ler('solicitacoes', `select=id&situacao=eq.pendente&empresa_id=eq.${empresa}`),
        ]);
        return {
            funcionariosAtivos: pessoas.length,
            taxaConclusao: matriculas.length ? matriculas.filter((m) => m.concluido_em).length / matriculas.length : 0,
            certificados: certificados.length,
            solicitacoesPendentes: solicitacoes.length,
        };
    }
    return {};
}

function eventoParaTela(linha) {
    const { autorNome, empresa, ...resto } = camel(linha);
    return { ...resto, autor: autorNome ?? null, empresa: empresa?.nome ?? null };
}

/** Atividade que o perfil pode ver (o RLS da auditoria decide). */
export async function atividadeRecente(_usuario, limite = 6) {
    atual();
    return (await ler('auditoria', `select=*,empresa:empresa_id(nome)&order=em.desc&limit=${Number(limite) || 6}`)).map(eventoParaTela);
}

// ---------------------------------------------------------------- auditoria --

export const CATEGORIAS_AUDITORIA = ['empresa', 'pessoa', 'convite', 'equipe', 'solicitacao', 'curso', 'matricula', 'aula', 'avaliacao', 'certificado', 'conta'];

export async function listarAuditoria(_usuario, { de = '', ate = '', empresaId = '', categoria = '', pessoa = '' } = {}, pagina = 1, porPagina = 15) {
    exigir(pode(atual(), 'ver-auditoria'));
    const filtros = ['select=*,empresa:empresa_id(nome)', 'order=em.desc', 'limit=2000'];
    if (de) filtros.push(`em=gte.${valor(new Date(`${de}T00:00:00`).toISOString())}`);
    if (ate) filtros.push(`em=lte.${valor(new Date(`${ate}T23:59:59.999`).toISOString())}`);
    if (empresaId) filtros.push(`empresa_id=eq.${valor(empresaId)}`);
    if (CATEGORIAS_AUDITORIA.includes(categoria)) filtros.push(`acao=like.${categoria}.*`);
    const termo = pessoa.trim().replace(/[",()\\*]/g, ' ').trim();
    if (termo) filtros.push(`or=${valor(`(autor_nome.ilike."*${termo}*",alvo.ilike."*${termo}*")`)}`);

    const filtrados = (await ler('auditoria', filtros.join('&'))).map(eventoParaTela);
    const paginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
    const atualPagina = Math.min(Math.max(1, pagina), paginas);
    return { itens: filtrados.slice((atualPagina - 1) * porPagina, atualPagina * porPagina), total: filtrados.length, pagina: atualPagina, paginas };
}

// --------------------------------------------------------------- relatórios --

const DIAS_ATRASO = 7;

export async function relatorio(_usuario, { empresaId = '', cursoId = '' } = {}) {
    const usuario = atual();
    exigir(pode(usuario, 'ver-relatorios'));
    const escopoEmpresa = ehEquipe(usuario.perfil) ? empresaId : usuario.empresaId;
    const [matriculas, pessoas, cursos, certificados, empresas] = await Promise.all([
        ler('matriculas', 'select=*').then((l) => l.map(camel)),
        ler('perfis', 'select=id,nome,empresa_id').then((l) => l.map(camel)),
        ler('cursos', 'select=*').then((l) => l.map((c) => curso(c))),
        ler('certificados', 'select=usuario_id,curso_id').then((l) => l.map(camel)),
        ler('empresas', 'select=id,nome'),
    ]);
    const limiteAtraso = Date.now() - DIAS_ATRASO * 86_400_000;
    const nomeEmpresa = (id) => empresas.find((e) => e.id === id)?.nome ?? '';

    const linhas = matriculas
        .map((m) => ({ m, pessoa: pessoas.find((u) => u.id === m.usuarioId), curso: cursos.find((c) => c.id === m.cursoId) }))
        .filter(({ pessoa, curso: c }) => pessoa && c)
        .filter(({ pessoa }) => !escopoEmpresa || pessoa.empresaId === escopoEmpresa)
        .filter(({ curso: c }) => !cursoId || c.id === cursoId)
        .map(({ m, pessoa, curso: c }) => {
            const p = progressoDe(c, m);
            const atrasado = !m.concluidoEm && new Date(m.ultimaAtividade).getTime() < limiteAtraso;
            return {
                pessoa: pessoa.nome, pessoaId: pessoa.id, empresa: nomeEmpresa(pessoa.empresaId), curso: c.titulo, cursoId: c.id,
                progresso: p.percentual, nota: p.melhorNota, aprovado: p.aprovado, reprovacoes: m.tentativas.filter((t) => !t.aprovado).length,
                situacao: m.concluidoEm ? 'concluido' : atrasado ? 'atrasado' : p.feitas === 0 ? 'naoIniciado' : 'andamento',
                ultimaAtividade: m.ultimaAtividade, concluido: Boolean(m.concluidoEm),
            };
        })
        .sort((a, b) => a.pessoa.localeCompare(b.pessoa) || a.curso.localeCompare(b.curso));

    const notas = linhas.map((l) => l.nota).filter((n) => n !== null);
    const porCurso = [...new Set(linhas.map((l) => l.cursoId))].map((id) => {
        const doCurso = linhas.filter((l) => l.cursoId === id);
        const notasCurso = doCurso.map((l) => l.nota).filter((n) => n !== null);
        return {
            curso: doCurso[0].curso,
            cursoId: id,
            matriculados: doCurso.length,
            concluidos: doCurso.filter((l) => l.concluido).length,
            taxa: doCurso.filter((l) => l.concluido).length / doCurso.length,
            notaMedia: notasCurso.length ? Math.round(notasCurso.reduce((s, n) => s + n, 0) / notasCurso.length) : null,
        };
    }).sort((a, b) => b.matriculados - a.matriculados);

    const visiveis = new Set(linhas.map((l) => `${l.pessoaId}|${l.cursoId}`));
    return {
        indicadores: {
            matriculas: linhas.length,
            emAndamento: linhas.filter((l) => l.situacao === 'andamento').length,
            concluidas: linhas.filter((l) => l.concluido).length,
            taxaConclusao: linhas.length ? linhas.filter((l) => l.concluido).length / linhas.length : 0,
            aprovacoes: linhas.filter((l) => l.aprovado).length,
            reprovacoes: linhas.reduce((s, l) => s + l.reprovacoes, 0),
            notaMedia: notas.length ? Math.round(notas.reduce((s, n) => s + n, 0) / notas.length) : null,
            certificados: certificados.filter((c) => visiveis.has(`${c.usuarioId}|${c.cursoId}`)).length,
            atrasados: linhas.filter((l) => l.situacao === 'atrasado').length,
        },
        porCurso,
        linhas,
        diasAtraso: DIAS_ATRASO,
    };
}
