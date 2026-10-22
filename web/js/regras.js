// Regras de negócio da plataforma.
//
// Quem decide de verdade é o banco (RLS e funções em supabase/schema.sql). As regras
// daqui espelham as do servidor só para a interface mostrar ou esconder o que cabe a
// cada perfil; burlá-las no navegador não dá acesso a nada.

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
        case 'personalizar-marca':
            if (ehEquipe(perfil)) return true;
            return perfil === 'company_admin'
                && (alvo.empresaId === undefined || alvo.empresaId === usuario.empresaId);
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
        case 'ver-cultura':
        case 'ver-kaizen':
        case 'ver-ranking':
            return ehEquipe(perfil) || Boolean(usuario.empresaId);
        case 'gerir-diagnosticos':
            return ehEquipe(perfil) || perfil === 'company_admin';
        case 'gerir-modelos':
        case 'ver-panorama':
        case 'liberar-curso':
            return ehEquipe(perfil);
        case 'definir-area':
            return podeGerirPessoa(usuario, alvo.pessoa) || (perfil === 'company_admin' && alvo.pessoa?.id === usuario.id);
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

function hexDe(canais) {
    return `#${canais.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')}`;
}

function misturar(hex, alvo, fracao) {
    const a = rgb(hex);
    const b = rgb(alvo);
    return hexDe(a.map((c, i) => c + (b[i] - c) * fracao));
}

export function contraste(hexA, hexB) {
    const [claro, escuro] = [luminancia(hexA), luminancia(hexB)].sort((x, y) => y - x);
    return (claro + 0.05) / (escuro + 0.05);
}

/** Leva a cor aos poucos na direção de `rumo` até ter contraste `minimo` com `fundo`. */
function ajustarAte(hex, fundo, minimo, rumo) {
    for (let passo = 0; passo <= 50; passo += 1) {
        const cor = misturar(hex, rumo, passo / 50);
        if (contraste(cor, fundo) >= minimo) return cor;
    }
    return rumo;
}

const TEXTO_ESCURO = '#111a1f';
const FUNDO_ESCURO = '#10191d';

/**
 * Paleta da marca a partir de UMA cor qualquer (a empresa não precisa saber de contraste):
 * - acao/onAcao: fundo e texto dos botões. Mantém o tom; escurece o mínimo para o texto
 *   branco ficar legível, e em cores muito claras (amarelo, verde-limão) usa texto escuro;
 * - tinta / tintaEscura: a cor para textos e links no fundo claro e no tema escuro;
 * - ajustada: true quando o botão precisou de um tom levemente diferente.
 */
export function paletaMarca(hex) {
    const base = corValida(hex) ? hex.toLowerCase() : COR_PADRAO;
    let acao = base;
    let onAcao = '#ffffff';
    if (contrasteComBranco(base) < 4.5) {
        if (contrasteComBranco(base) >= 2.2) acao = ajustarAte(base, '#ffffff', 4.5, '#000000');
        else onAcao = TEXTO_ESCURO;
    }
    return {
        base,
        acao,
        onAcao,
        tinta: ajustarAte(base, '#ffffff', 4.5, '#000000'),
        tintaEscura: ajustarAte(base, FUNDO_ESCURO, 4.5, '#ffffff'),
        ajustada: acao !== base,
    };
}

/** Cor para fundos com texto branco (avatares, selos): o tom da empresa, escurecido se preciso. */
export function corSegura(hex) {
    if (!corValida(hex)) return COR_PADRAO;
    return corLegivel(hex) ? hex.toLowerCase() : ajustarAte(hex.toLowerCase(), '#ffffff', 4.5, '#000000');
}

// ---------------------------------------------------------------- marca --

export const ESTILOS_MENU = ['escuro', 'marca', 'claro'];
export const CANTOS = ['suave', 'reto', 'redondo'];
export const FONTES = ['marcante', 'classica', 'neutra'];

/** Valores de marca de uma empresa, com os padrões preenchidos. */
export function marcaDe(empresa) {
    return {
        cor: corValida(empresa?.cor) ? empresa.cor : null,
        corSecundaria: corValida(empresa?.corSecundaria) ? empresa.corSecundaria : null,
        logo: empresa?.logo ?? null,
        academia: empresa?.academia ?? '',
        estiloMenu: ESTILOS_MENU.includes(empresa?.estiloMenu) ? empresa.estiloMenu : 'escuro',
        cantos: CANTOS.includes(empresa?.cantos) ? empresa.cantos : 'suave',
        fonte: FONTES.includes(empresa?.fonte) ? empresa.fonte : 'marcante',
        capasMarca: Boolean(empresa?.capasMarca),
    };
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

/** Pontos por ação (os mesmos do servidor). Cada ação vale uma única vez (reenviar não soma de novo). */
export const PONTOS = { aula: 10, avaliacao: 30, notaMaxima: 20, curso: 50, desafio: 25, kaizenIdeia: 10, kaizen: 60, diagnostico: 15 };

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

// --------------------------------------------------- cultura e maturidade --

/**
 * Nível de maturidade (0 a 4) a partir da nota 0–100: faixas de 20 pontos,
 * como os 5 níveis da autoavaliação da ISO 9004. Os nomes ficam em textos.js
 * (ou vêm do próprio modelo, ex.: a escada de Hudson).
 */
export function nivelMaturidade(nota) {
    if (nota === null || nota === undefined) return null;
    return Math.max(0, Math.min(4, Math.floor(Number(nota) / 20)));
}

/** Leitura de risco psicossocial por dimensão: nota alta = condição favorável = risco baixo. */
export function faixaRisco(nota) {
    if (nota === null || nota === undefined) return null;
    if (nota < 50) return 'alto';
    if (nota < 70) return 'moderado';
    return 'baixo';
}

/** Diferença entre a visão da liderança e a da equipe que vira "ponto cego". */
export const GAP_PONTO_CEGO = 15;

/** eNPS (de -100 a 100): zona de leitura usual do mercado. */
export function zonaEnps(score) {
    if (score === null || score === undefined) return null;
    if (score >= 50) return 'excelencia';
    if (score >= 10) return 'qualidade';
    if (score >= -10) return 'aperfeicoamento';
    return 'critica';
}

// ----------------------------------------------------------------- kaizen --

/** Etapas do quadro, na ordem do PDCA (planejar, executar, verificar, agir/padronizar). */
export const ETAPAS_KAIZEN = ['ideia', 'planejar', 'executar', 'verificar', 'concluido'];

export function codigoKaizen(numero) {
    return `KZ-${String(numero ?? 0).padStart(3, '0')}`;
}

/** Quem pode mexer no kaizen (o servidor confere de novo). Concluir fica com o gestor ou a consultoria. */
export function podeEditarKaizen(usuario, k) {
    if (!usuario?.ativo || !k) return false;
    if (ehEquipe(usuario.perfil)) return true;
    if (usuario.empresaId !== k.empresaId) return false;
    return usuario.perfil === 'company_admin' || [k.autorId, k.responsavelId, ...(k.membros ?? [])].includes(usuario.id);
}

// ------------------------------------------------------------- engajamento --

/**
 * Índice de engajamento da empresa (0–100), para comparar clientes:
 * 40% pessoas ativas nos últimos 30 dias, 30% taxa de conclusão dos cursos e
 * 30% ritmo de pontos (100 pontos por pessoa em 30 dias = nota cheia).
 */
export function indiceEngajamento({ pessoas = 0, ativos30 = 0, pontos30 = 0, matriculas = 0, concluidas = 0 } = {}) {
    if (!pessoas) return 0;
    const atividade = Math.min(1, ativos30 / pessoas);
    const conclusao = matriculas ? concluidas / matriculas : 0;
    const ritmo = Math.min(1, pontos30 / pessoas / 100);
    return Math.round((atividade * 0.4 + conclusao * 0.3 + ritmo * 0.3) * 100);
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
