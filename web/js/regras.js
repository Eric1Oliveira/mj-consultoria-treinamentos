// Regras de negócio da plataforma.
//
// ATENÇÃO: nesta versão sem backend as permissões são DEMONSTRATIVAS. Qualquer
// pessoa com as ferramentas do navegador consegue burlá-las. Quando o Supabase
// entrar, cada regra daqui vira política de acesso (RLS) no servidor; no
// navegador elas continuam só para mostrar ou esconder botões.

export const PERFIS = ['admin', 'consultant', 'company_admin', 'student'];

export const VALIDADE_CONVITE_DIAS = 7;

/** Equipe da plataforma (enxerga todas as empresas). */
export function ehEquipe(perfil) {
    return perfil === 'admin' || perfil === 'consultant';
}

export function ehDaEmpresa(perfil) {
    return perfil === 'company_admin' || perfil === 'student';
}

/** Gestor também é funcionário: faz cursos. */
export function podeEstudar(perfil) {
    return perfil === 'student' || perfil === 'company_admin';
}

/**
 * Quem pode fazer o quê. `alvo` traz o contexto (ex.: { empresaId }).
 * Mesma matriz aprovada no projeto Laravel (docs/perfis-e-permissoes.md).
 */
export function pode(usuario, acao, alvo = {}) {
    if (!usuario || !usuario.ativo) return false;
    const perfil = usuario.perfil;

    switch (acao) {
        case 'ver-empresas':
        case 'gerir-empresas':
        case 'ver-auditoria':
            return ehEquipe(perfil);
        case 'ver-equipe':
            return perfil === 'admin';
        case 'ver-pessoas':
            if (ehEquipe(perfil)) return true;
            return perfil === 'company_admin'
                && (alvo.empresaId === undefined || alvo.empresaId === usuario.empresaId);
        case 'ver-solicitacoes':
            return ehEquipe(perfil) || perfil === 'company_admin';
        case 'ver-relatorios':
            return ehEquipe(perfil) || perfil === 'company_admin';
        case 'estudar':
            return podeEstudar(perfil);
        case 'ver-cursos':
            return true;
        case 'gerir-cursos':
            return ehEquipe(perfil);
        case 'convidar':
            return podeConvidar(usuario, alvo.perfil, alvo.empresa ?? null);
        case 'gerir-pessoa':
            return podeGerirPessoa(usuario, alvo.pessoa);
        case 'mudar-perfil':
            return ehEquipe(perfil) && Boolean(alvo.pessoa) && ehDaEmpresa(alvo.pessoa.perfil) && alvo.pessoa.id !== usuario.id;
        case 'matricular':
            return podeMatricular(usuario, alvo.pessoa);
        case 'decidir-solicitacao':
            if (ehEquipe(perfil)) return true;
            return perfil === 'company_admin' && alvo.empresa?.id === usuario.empresaId && alvo.empresa?.aprovador === 'empresa';
        default:
            return false;
    }
}

/**
 * Desativar, reativar e editar pessoas:
 * - administrador: qualquer um; consultora: quem não é da equipe;
 * - gestor: só alunos da própria empresa; ninguém mexe em si mesmo por aqui.
 */
export function podeGerirPessoa(usuario, pessoa) {
    if (!usuario?.ativo || !pessoa || pessoa.id === usuario.id) return false;
    switch (usuario.perfil) {
        case 'admin':
            return true;
        case 'consultant':
            return !ehEquipe(pessoa.perfil);
        case 'company_admin':
            return pessoa.perfil === 'student' && pessoa.empresaId === usuario.empresaId;
        default:
            return false;
    }
}

/** Matricular: a própria pessoa, o gestor (funcionários da empresa) ou a equipe. */
export function podeMatricular(usuario, pessoa) {
    if (!usuario?.ativo || !pessoa?.ativo || !podeEstudar(pessoa.perfil)) return false;
    if (pessoa.id === usuario.id) return true;
    if (ehEquipe(usuario.perfil)) return true;
    return usuario.perfil === 'company_admin' && pessoa.empresaId === usuario.empresaId;
}

/**
 * Quem convida quem:
 * - administrador: qualquer perfil (equipe sem empresa; gestor/aluno com empresa);
 * - consultora: gestor e aluno, de qualquer empresa ativa;
 * - gestor: só aluno, só da própria empresa;
 * - aluno: ninguém.
 */
export function podeConvidar(usuario, perfil, empresa) {
    if (!usuario?.ativo || !PERFIS.includes(perfil)) return false;
    if (ehDaEmpresa(perfil) !== Boolean(empresa)) return false;
    if (empresa && !empresa.ativa) return false;

    switch (usuario.perfil) {
        case 'admin':
            return true;
        case 'consultant':
            return ehDaEmpresa(perfil);
        case 'company_admin':
            return perfil === 'student' && empresa?.id === usuario.empresaId;
        default:
            return false;
    }
}

/** Usuários que `usuario` pode enxergar. */
export function filtrarVisiveis(usuario, usuarios) {
    if (ehEquipe(usuario.perfil)) return usuarios;
    if (usuario.perfil === 'company_admin') return usuarios.filter((u) => u.empresaId === usuario.empresaId);
    return usuarios.filter((u) => u.id === usuario.id);
}

/** Um convite pode ser usado agora? */
export function convitePendente(convite, agora = Date.now()) {
    return !convite.aceitoEm && !convite.canceladoEm && new Date(convite.expiraEm).getTime() > agora;
}

// ---------------------------------------------------------------- cores --

export const COR_PADRAO = '#0f4c5c';

export function corValida(hex) {
    return typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex);
}

function canal(valor) {
    const c = valor / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function rgb(hex) {
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function luminancia(hex) {
    const [r, g, b] = rgb(hex);
    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Contraste do texto branco sobre a cor (WCAG 2.x). */
export function contrasteComBranco(hex) {
    return 1.05 / (luminancia(hex) + 0.05);
}

/** A cor só vale se o texto branco continuar legível (≥ 4,5:1). */
export function corLegivel(hex) {
    return corValida(hex) && contrasteComBranco(hex) >= 4.5;
}

/** Cor segura para usar na tela: inválida ou ilegível cai na cor da consultora. */
export function corSegura(hex) {
    return corLegivel(hex) ? hex.toLowerCase() : COR_PADRAO;
}

// ------------------------------------------------------------ validações --

export function emailValido(email) {
    return typeof email === 'string' && email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function identificadorValido(texto) {
    return typeof texto === 'string' && texto.length <= 60 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(texto);
}

/** "Alfa Logística S/A" → "alfa-logistica-s-a" */
export function gerarIdentificador(nome) {
    return String(nome || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        .slice(0, 55) || 'empresa';
}

/** Aceita o endereço do vídeo no YouTube ou só o código de 11 caracteres. */
export function codigoYoutube(texto) {
    const valor = String(texto || '').trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(valor)) return valor;
    const achado = valor.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
    return achado ? achado[1] : null;
}

// ---------------------------------------------------- cursos e avaliações --

/** Nota da avaliação em % (0–100), comparando as respostas com o gabarito. */
export function notaAvaliacao(questoes, respostas) {
    if (!questoes.length) return 0;
    const certas = questoes.filter((q) => Number(respostas[q.id]) === q.correta).length;
    return Math.round((certas / questoes.length) * 100);
}

/** Curso concluído = todas as aulas feitas e avaliação aprovada (quando há avaliação). */
export function cursoCompleto(curso, matricula) {
    const aulas = curso.modulos.flatMap((m) => m.aulas);
    const todasAulas = aulas.every((a) => matricula.aulasConcluidas.includes(a.id));
    const temAvaliacao = curso.avaliacao.questoes.length > 0;
    const aprovado = matricula.tentativas.some((tentativa) => tentativa.aprovado);
    return aulas.length > 0 && todasAulas && (!temAvaliacao || aprovado);
}

// ------------------------------------------------------------ gamificação --

/** Pontos por ação. Cada ação vale uma única vez (reenviar não soma de novo). */
export const PONTOS = { aula: 10, avaliacao: 30, notaMaxima: 20, curso: 50, desafio: 25 };

/** Pontos mínimos de cada nível (os nomes ficam em textos.js). */
export const NIVEIS = [0, 100, 250, 500, 1000];

export const DESAFIO_SEMANAL = { aulas: 3, dias: 7 };

export function nivelPorPontos(pontos) {
    let nivel = 0;
    NIVEIS.forEach((minimo, i) => {
        if (pontos >= minimo) nivel = i;
    });
    return { nivel, proximo: NIVEIS[nivel + 1] ?? null };
}

/** Dias seguidos com estudo, terminando hoje ou ontem. */
export function sequenciaDias(datasIso, agora = new Date()) {
    const dias = new Set(datasIso.map((iso) => new Date(iso).toDateString()));
    const dia = new Date(agora);
    if (!dias.has(dia.toDateString())) dia.setDate(dia.getDate() - 1);
    let total = 0;
    while (dias.has(dia.toDateString())) {
        total += 1;
        dia.setDate(dia.getDate() - 1);
    }
    return total;
}

// ------------------------------------------------------------- diversos --

export function iniciais(nome) {
    const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
    const primeira = partes[0]?.[0] ?? '';
    const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
    return (primeira + ultima).toUpperCase();
}

export function primeiroNome(nome) {
    return String(nome || '').trim().split(/\s+/)[0] ?? '';
}
