// Único módulo que lê e grava dados.
//
// Hoje: dados FICTÍCIOS no localStorage deste navegador (só demonstração).
// Amanhã: o Supabase entra aqui, mantendo os mesmos nomes e retornos, e
// nenhuma tela precisa mudar. Todas as funções já são assíncronas por isso.
// As permissões checadas aqui imitam o que o servidor fará (RLS); no navegador
// elas NÃO protegem nada — qualquer pessoa pode alterar o localStorage.
// Não guardamos senhas nem dados pessoais reais.

import {
    ehEquipe, ehDaEmpresa, podeEstudar, pode, podeConvidar, filtrarVisiveis, convitePendente,
    VALIDADE_CONVITE_DIAS, corValida, corLegivel, contrasteComBranco, emailValido, identificadorValido,
    gerarIdentificador, codigoYoutube, notaAvaliacao, cursoCompleto, PONTOS, DESAFIO_SEMANAL,
    nivelPorPontos, sequenciaDias,
} from './regras.js';

const CHAVE_DADOS = 'mjc-demo:dados';
const CHAVE_SESSAO = 'mjc-demo:sessao';
const CHAVE_PREFERENCIAS = 'mjc-demo:preferencias';
const VERSAO = 2;

/** Senha única da demonstração. Não é segredo e não fica gravada em lugar nenhum. */
export const SENHA_DEMO = 'demo';

export const LOGO_MAX_BYTES = 200 * 1024;

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

// ------------------------------------------------------------ armazenamento --

const memoria = new Map(); // sem localStorage (aba privada), a demo segue na memória da aba
let banco = null;

function ler(chave) {
    try {
        const bruto = localStorage.getItem(chave);
        return bruto === null ? memoria.get(chave) ?? null : JSON.parse(bruto);
    } catch {
        return memoria.get(chave) ?? null;
    }
}

function gravar(chave, valor) {
    memoria.set(chave, valor);
    try {
        localStorage.setItem(chave, JSON.stringify(valor));
    } catch {
        // sem localStorage ou cheio: fica na memória desta aba
    }
}

function apagar(chave) {
    memoria.delete(chave);
    try {
        localStorage.removeItem(chave);
    } catch {
        // idem
    }
}

const copia = (valor) => (valor === undefined ? undefined : structuredClone(valor));

function carregar() {
    if (banco) return banco;
    const salvo = ler(CHAVE_DADOS);
    banco = salvo && salvo.versao === VERSAO ? salvo : semente();
    if (banco !== salvo) gravar(CHAVE_DADOS, banco);
    return banco;
}

function persistir() {
    gravar(CHAVE_DADOS, banco);
}

const agora = () => new Date().toISOString();
const novoId = (prefixo) => `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const codigoAleatorio = (n = 24) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');

function exigir(condicao, codigo = 'proibido') {
    if (!condicao) throw new ErroDados(codigo);
}

function registrar(acao, autorId, empresaId, alvo) {
    banco.auditoria.push({ id: novoId('aud'), em: agora(), autorId, acao, empresaId: empresaId ?? null, alvo: alvo ?? null });
}

function texto(valor, maximo) {
    return String(valor ?? '').trim().slice(0, maximo);
}

// ---------------------------------------------------------- dados de exemplo --

function ha(minutos) {
    return new Date(Date.now() - minutos * 60_000).toISOString();
}

function daqui(dias) {
    return new Date(Date.now() + dias * 86_400_000).toISOString();
}

/** Tudo fictício. Os e-mails usam o domínio reservado .test, que não existe. */
function semente() {
    const empresas = [
        { id: 'emp-alfa', nome: 'Alfa Logística', identificador: 'alfa-logistica', cor: '#1d4f7a', logo: null, ativa: true, mensagem: 'Bem-vindos ao programa de capacitação da Alfa.', solicitacoesAtivas: true, aprovador: 'empresa', criadoEm: ha(60 * 24 * 60) },
        { id: 'emp-verde', nome: 'Verde Agro', identificador: 'verde-agro', cor: '#2e6136', logo: null, ativa: true, mensagem: 'Aprender juntos faz a colheita render.', solicitacoesAtivas: true, aprovador: 'consultoria', criadoEm: ha(60 * 24 * 50) },
        { id: 'emp-nimbus', nome: 'Nimbus Varejo', identificador: 'nimbus-varejo', cor: '#7a2e5c', logo: null, ativa: true, mensagem: '', solicitacoesAtivas: false, aprovador: 'empresa', criadoEm: ha(60 * 24 * 40) },
        { id: 'emp-orion', nome: 'Orion Serviços', identificador: 'orion-servicos', cor: null, logo: null, ativa: false, mensagem: '', solicitacoesAtivas: false, aprovador: 'empresa', criadoEm: ha(60 * 24 * 90) },
    ];

    const pessoa = (id, nome, email, perfil, empresaId, extra = {}) => ({
        id, nome, email, perfil, empresaId, ativo: true, idioma: 'pt-BR', ultimoAcesso: null, criadoEm: ha(60 * 24 * 40), ...extra,
    });

    const usuarios = [
        pessoa('usr-ana', 'Ana Ribeiro', 'ana.admin@mjc-demo.test', 'admin', null, { ultimoAcesso: ha(30) }),
        pessoa('usr-carla', 'Carla Mendes', 'carla.consultora@mjc-demo.test', 'consultant', null, { ultimoAcesso: ha(55) }),
        pessoa('usr-bruno', 'Bruno Alves', 'bruno.consultor@mjc-demo.test', 'consultant', null, { ultimoAcesso: ha(60 * 26) }),
        pessoa('usr-rafael', 'Rafael Souza', 'rafael.gestor@alfa-demo.test', 'company_admin', 'emp-alfa', { ultimoAcesso: ha(90) }),
        pessoa('usr-bianca', 'Bianca Lima', 'bianca@alfa-demo.test', 'student', 'emp-alfa', { ultimoAcesso: ha(15) }),
        pessoa('usr-diego', 'Diego Torres', 'diego@alfa-demo.test', 'student', 'emp-alfa', { ultimoAcesso: ha(60 * 24 * 9) }),
        pessoa('usr-paula', 'Paula Nunes', 'paula@alfa-demo.test', 'student', 'emp-alfa', { ativo: false }),
        pessoa('usr-helena', 'Helena Prado', 'helena.gestora@verde-demo.test', 'company_admin', 'emp-verde', { ultimoAcesso: ha(60 * 5) }),
        pessoa('usr-igor', 'Igor Ramos', 'igor@verde-demo.test', 'student', 'emp-verde', { ultimoAcesso: ha(60 * 24 * 12) }),
        pessoa('usr-julia', 'Júlia Costa', 'julia@verde-demo.test', 'student', 'emp-verde', { ultimoAcesso: ha(60 * 30) }),
        pessoa('usr-otavio', 'Otávio Reis', 'otavio.gestor@nimbus-demo.test', 'company_admin', 'emp-nimbus', { ultimoAcesso: ha(60 * 72) }),
        pessoa('usr-sofia', 'Sofia Martins', 'sofia@nimbus-demo.test', 'student', 'emp-nimbus', { ultimoAcesso: ha(60 * 8) }),
    ];

    const convite = (id, email, perfil, empresaId, convidadoPor, criadoMin, expiraDias) => ({
        id, email, perfil, empresaId, convidadoPor, codigo: codigoAleatorio(), criadoEm: ha(criadoMin), expiraEm: daqui(expiraDias), aceitoEm: null, canceladoEm: null,
    });

    const convites = [
        convite('cnv-1', 'novo.colaborador@alfa-demo.test', 'student', 'emp-alfa', 'usr-rafael', 60 * 20, 6),
        convite('cnv-2', 'lider.campo@verde-demo.test', 'company_admin', 'emp-verde', 'usr-carla', 60 * 3, 7),
        convite('cnv-3', 'antigo@nimbus-demo.test', 'student', 'emp-nimbus', 'usr-otavio', 60 * 24 * 9, -2),
    ];

    const solicitacoes = [
        { id: 'sol-1', empresaId: 'emp-alfa', nome: 'Marcos Vieira', email: 'marcos@alfa-demo.test', mensagem: 'Entrei no setor de expedição este mês.', situacao: 'pendente', criadoEm: ha(60 * 6), decididoPor: null, decididoEm: null, motivo: null },
        { id: 'sol-2', empresaId: 'emp-verde', nome: 'Renata Dias', email: 'renata@verde-demo.test', mensagem: '', situacao: 'pendente', criadoEm: ha(60 * 30), decididoPor: null, decididoEm: null, motivo: null },
    ];

    // Conteúdo dos cursos fica no idioma original (a interface não traduz conteúdo).
    const video = 'aqz-KE-bpKQ'; // vídeo público de exemplo (Blender Foundation), só para a demonstração
    const aula = (id, titulo, tipo, minutos, conteudo, videoId = null) => ({ id, titulo, tipo, minutos, conteudo, videoId: tipo === 'video' ? videoId ?? video : null });
    const questao = (id, enunciado, alternativas, correta) => ({ id, enunciado, alternativas, correta });

    const cursos = [
        {
            id: 'cur-integracao', titulo: 'Integração: boas-vindas', descricao: 'Primeiros passos na empresa: cultura, ferramentas e a quem recorrer.',
            cargaHoraria: 2, notaMinima: 70, tentativas: 3, ativo: true, avancoAutomatico: true, empresas: ['emp-alfa', 'emp-verde', 'emp-nimbus'], criadoEm: ha(60 * 24 * 45),
            modulos: [
                { id: 'mod-int-1', titulo: 'Nossa cultura', aulas: [
                    aula('aul-int-1', 'Mensagem de boas-vindas', 'video', 10, 'Assista à mensagem de abertura do programa.'),
                    aula('aul-int-2', 'Missão, visão e valores', 'texto', 15, 'Nossa missão é desenvolver pessoas. Valores: respeito, clareza e aprendizado contínuo.'),
                ] },
                { id: 'mod-int-2', titulo: 'No dia a dia', aulas: [
                    aula('aul-int-3', 'Ferramentas de trabalho', 'texto', 20, 'E-mail, agenda e a plataforma de treinamentos: onde encontrar cada coisa.'),
                    aula('aul-int-4', 'A quem pedir ajuda', 'video', 15, 'Conheça os canais de suporte e o papel do gestor.'),
                ] },
            ],
            avaliacao: { questoes: [
                questao('q-int-1', 'Qual é a missão apresentada no curso?', ['Vender mais', 'Desenvolver pessoas', 'Reduzir custos', 'Abrir filiais'], 1),
                questao('q-int-2', 'Quem é o primeiro contato para dúvidas do dia a dia?', ['O gestor', 'A diretoria', 'Ninguém', 'Um cliente'], 0),
                questao('q-int-3', 'Qual destes é um dos valores citados?', ['Pressa', 'Clareza', 'Sigilo absoluto', 'Competição'], 1),
            ] },
        },
        {
            id: 'cur-seguranca', titulo: 'Segurança da informação', descricao: 'Senhas, golpes por e-mail e cuidados com dados da empresa.',
            cargaHoraria: 4, notaMinima: 70, tentativas: 2, ativo: true, avancoAutomatico: false, empresas: ['emp-alfa', 'emp-nimbus'], criadoEm: ha(60 * 24 * 30),
            modulos: [
                { id: 'mod-seg-1', titulo: 'Fundamentos', aulas: [
                    aula('aul-seg-1', 'Senhas fortes', 'texto', 20, 'Use frases longas, um gerenciador de senhas e verificação em duas etapas.'),
                    aula('aul-seg-2', 'Reconhecendo golpes', 'video', 25, 'Remetente estranho, urgência e links encurtados são sinais de alerta.'),
                    aula('aul-seg-3', 'Dispositivos e redes', 'texto', 20, 'Bloqueie a tela, atualize o sistema e evite redes abertas.'),
                ] },
                { id: 'mod-seg-2', titulo: 'Na prática', aulas: [
                    aula('aul-seg-4', 'Incidentes: o que fazer', 'texto', 15, 'Avise a área responsável imediatamente; não tente resolver sozinho.'),
                    aula('aul-seg-5', 'Estudo de caso', 'video', 30, 'Um ataque real explicado passo a passo.'),
                ] },
            ],
            avaliacao: { questoes: [
                questao('q-seg-1', 'Qual é a senha mais forte?', ['123456', 'nomedocachorro', 'Uma frase longa e única', 'Data de nascimento'], 2),
                questao('q-seg-2', 'Um e-mail urgente pede seus dados. O que fazer?', ['Responder rápido', 'Desconfiar e verificar', 'Encaminhar a todos', 'Clicar para ver'], 1),
                questao('q-seg-3', 'Ao perceber um incidente, você deve:', ['Ignorar', 'Avisar a área responsável', 'Apagar tudo', 'Postar nas redes'], 1),
                questao('q-seg-4', 'Rede Wi-Fi aberta é:', ['Sempre segura', 'Um risco', 'Obrigatória', 'Mais rápida'], 1),
            ] },
        },
        {
            id: 'cur-lgpd', titulo: 'LGPD no dia a dia', descricao: 'O que a lei de proteção de dados muda na rotina de cada equipe.',
            cargaHoraria: 3, notaMinima: 80, tentativas: 3, ativo: true, avancoAutomatico: true, empresas: ['emp-verde', 'emp-alfa'], criadoEm: ha(60 * 24 * 20),
            modulos: [
                { id: 'mod-lgpd-1', titulo: 'Conceitos', aulas: [
                    aula('aul-lgpd-1', 'Dados pessoais e sensíveis', 'texto', 20, 'Dado pessoal identifica alguém; dado sensível exige cuidado redobrado.'),
                    aula('aul-lgpd-2', 'Bases legais', 'video', 25, 'Consentimento é uma das bases, não a única.'),
                    aula('aul-lgpd-3', 'Direitos do titular', 'texto', 15, 'Acesso, correção, exclusão e portabilidade.'),
                ] },
            ],
            avaliacao: { questoes: [
                questao('q-lgpd-1', 'Dado sensível inclui:', ['Cor favorita', 'Origem racial ou saúde', 'Nome da empresa', 'CEP comercial'], 1),
                questao('q-lgpd-2', 'O consentimento é:', ['A única base legal', 'Uma das bases legais', 'Proibido', 'Desnecessário'], 1),
                questao('q-lgpd-3', 'O titular pode pedir:', ['Nada', 'Só acesso', 'Acesso, correção e exclusão', 'Pagamento'], 2),
            ] },
        },
        {
            id: 'cur-lideranca', titulo: 'Liderança de equipes', descricao: 'Feedback, delegação e reuniões que funcionam. (Em preparação.)',
            cargaHoraria: 6, notaMinima: 70, tentativas: 3, ativo: false, avancoAutomatico: true, empresas: [], criadoEm: ha(60 * 24 * 3),
            modulos: [{ id: 'mod-lid-1', titulo: 'Feedback', aulas: [aula('aul-lid-1', 'Feedback que ajuda', 'texto', 20, 'Fale do fato, do impacto e combine o próximo passo.')] }],
            avaliacao: { questoes: [] },
        },
    ];

    const auditoria = [];
    const pontos = [];
    const matriculas = [];
    const certificados = [];
    const curso = (id) => cursos.find((c) => c.id === id);
    const aulasDe = (id) => curso(id).modulos.flatMap((m) => m.aulas.map((a) => a.id));

    /** Matrícula de exemplo coerente com pontos, auditoria e certificado. */
    function matricula(usuarioId, cursoId, feitas, inicioMin, notas = []) {
        const usuario = usuarios.find((u) => u.id === usuarioId);
        const ids = aulasDe(cursoId).slice(0, feitas);
        const passo = Math.max(30, Math.floor(inicioMin / (feitas + notas.length + 1)));
        let minuto = inicioMin;
        const m = { id: `mat-${usuarioId}-${cursoId}`, cursoId, usuarioId, criadoEm: ha(minuto), aulasConcluidas: [], tentativas: [], ultimaAtividade: ha(minuto), concluidoEm: null, certificadoId: null };
        ids.forEach((aulaId) => {
            minuto -= passo;
            m.aulasConcluidas.push(aulaId);
            m.ultimaAtividade = ha(minuto);
            pontos.push({ usuarioId, tipo: 'aula', ref: aulaId, valor: PONTOS.aula, em: ha(minuto) });
            auditoria.push({ id: `aud-s-${usuarioId}-${aulaId}`, em: ha(minuto), autorId: usuarioId, acao: 'aula.concluida', empresaId: usuario.empresaId, alvo: curso(cursoId).modulos.flatMap((x) => x.aulas).find((a) => a.id === aulaId).titulo });
        });
        notas.forEach((nota, i) => {
            minuto -= passo;
            const aprovado = nota >= curso(cursoId).notaMinima;
            m.tentativas.push({ em: ha(minuto), nota, aprovado });
            m.ultimaAtividade = ha(minuto);
            auditoria.push({ id: `aud-s-${usuarioId}-${cursoId}-av${i}`, em: ha(minuto), autorId: usuarioId, acao: aprovado ? 'avaliacao.aprovada' : 'avaliacao.reprovada', empresaId: usuario.empresaId, alvo: curso(cursoId).titulo });
            if (aprovado) {
                pontos.push({ usuarioId, tipo: 'avaliacao', ref: cursoId, valor: PONTOS.avaliacao, em: ha(minuto) });
                if (nota === 100) pontos.push({ usuarioId, tipo: 'notaMaxima', ref: cursoId, valor: PONTOS.notaMaxima, em: ha(minuto) });
            }
        });
        if (cursoCompleto(curso(cursoId), m)) {
            m.concluidoEm = ha(minuto);
            m.certificadoId = `cer-${usuarioId}-${cursoId}`;
            certificados.push({ id: m.certificadoId, cursoId, usuarioId, emitidoEm: ha(minuto), codigo: `MJC-${cursoId.slice(4, 8).toUpperCase()}-${usuarioId.slice(4, 8).toUpperCase()}` });
            pontos.push({ usuarioId, tipo: 'curso', ref: cursoId, valor: PONTOS.curso, em: ha(minuto) });
            auditoria.push({ id: `aud-s-${usuarioId}-${cursoId}-fim`, em: ha(minuto), autorId: usuarioId, acao: 'curso.concluido', empresaId: usuario.empresaId, alvo: curso(cursoId).titulo });
        }
        matriculas.push(m);
    }

    matricula('usr-bianca', 'cur-integracao', 4, 60 * 24 * 10, [100]);
    matricula('usr-bianca', 'cur-seguranca', 2, 60 * 2);
    matricula('usr-diego', 'cur-integracao', 3, 60 * 24 * 12);
    matricula('usr-rafael', 'cur-integracao', 1, 60 * 24 * 4);
    matricula('usr-igor', 'cur-lgpd', 0, 60 * 24 * 14);
    matricula('usr-julia', 'cur-lgpd', 3, 60 * 24 * 3, [66]);
    matricula('usr-helena', 'cur-lgpd', 1, 60 * 24 * 2);
    matricula('usr-sofia', 'cur-integracao', 4, 60 * 24 * 8, [100]);
    matricula('usr-sofia', 'cur-seguranca', 5, 60 * 24 * 4, [50, 75]);

    // Desafio da semana já cumprido por quem fez 3 aulas nos últimos 7 dias (como faria concluirAula).
    const semana = Math.floor(Date.now() / (7 * 86_400_000));
    for (const usuario of usuarios) {
        const recentes = pontos.filter((p) => p.usuarioId === usuario.id && p.tipo === 'aula' && Date.now() - new Date(p.em).getTime() <= DESAFIO_SEMANAL.dias * 86_400_000);
        if (recentes.length >= DESAFIO_SEMANAL.aulas) {
            pontos.push({ usuarioId: usuario.id, tipo: 'desafio', ref: `semana-${semana}`, valor: PONTOS.desafio, em: recentes[DESAFIO_SEMANAL.aulas - 1].em });
        }
    }

    const evento = (minutos, autorId, acao, empresaId, alvo) => ({ id: `aud-${minutos}-${acao}`, em: ha(minutos), autorId, acao, empresaId, alvo });
    auditoria.push(
        evento(55, 'usr-carla', 'empresa.atualizada', 'emp-nimbus', 'Nimbus Varejo'),
        evento(180, 'usr-carla', 'convite.criado', 'emp-verde', 'lider.campo@verde-demo.test'),
        evento(360, 'usr-helena', 'pessoa.reativada', 'emp-verde', 'Júlia Costa'),
        evento(60 * 20, 'usr-rafael', 'convite.criado', 'emp-alfa', 'novo.colaborador@alfa-demo.test'),
        evento(60 * 26, 'usr-ana', 'equipe.convidada', null, 'bruno.consultor@mjc-demo.test'),
        evento(60 * 48, 'usr-carla', 'curso.atualizado', null, 'Segurança da informação'),
        evento(60 * 24 * 3, 'usr-carla', 'curso.criado', null, 'Liderança de equipes'),
        evento(60 * 24 * 40, 'usr-carla', 'empresa.criada', 'emp-nimbus', 'Nimbus Varejo'),
    );

    return { versao: VERSAO, criadoEm: agora(), empresas, usuarios, convites, solicitacoes, cursos, matriculas, certificados, pontos, auditoria };
}

// ------------------------------------------------------------------ sessão --

export async function iniciar() {
    carregar();
}

/** Volta aos dados de exemplo (preferências de idioma e tema ficam). */
export async function restaurarExemplo() {
    banco = semente();
    persistir();
    apagar(CHAVE_SESSAO);
}

function empresaDe(id) {
    return carregar().empresas.find((e) => e.id === id) ?? null;
}

function usuarioDe(id) {
    return carregar().usuarios.find((u) => u.id === id) ?? null;
}

function podeEntrar(usuario) {
    if (!usuario.ativo) return false;
    return !usuario.empresaId || empresaDe(usuario.empresaId)?.ativa === true;
}

/** Usuário da sessão, conferido de novo a cada chamada (como faria o servidor). */
function atual(usuario) {
    const real = usuario ? usuarioDe(usuario.id) : null;
    exigir(real && podeEntrar(real));
    return real;
}

export async function usuarioAtual() {
    const id = ler(CHAVE_SESSAO);
    const usuario = id ? usuarioDe(id) : null;
    return usuario && podeEntrar(usuario) ? copia(usuario) : null;
}

function abrirSessao(usuario) {
    usuario.ultimoAcesso = agora();
    persistir();
    gravar(CHAVE_SESSAO, usuario.id);
    return copia(usuario);
}

/** Login demonstrativo: e-mail de uma conta de exemplo + a senha da demo. */
export async function entrar(email, senha) {
    const alvo = texto(email, 255).toLowerCase();
    const usuario = carregar().usuarios.find((u) => u.email === alvo);
    if (!usuario || senha !== SENHA_DEMO || !podeEntrar(usuario)) throw new ErroDados('credenciais');
    return abrirSessao(usuario);
}

export async function entrarComo(usuarioId) {
    const usuario = usuarioDe(usuarioId);
    if (!usuario) throw new ErroDados('nao-encontrado');
    if (!podeEntrar(usuario)) throw new ErroDados('inativo');
    return abrirSessao(usuario);
}

export async function sair() {
    apagar(CHAVE_SESSAO);
}

/** Uma conta de cada perfil para o seletor de demonstração. */
export async function listarPerfisDemo() {
    return ['usr-ana', 'usr-carla', 'usr-rafael', 'usr-bianca']
        .map(usuarioDe).filter(Boolean)
        .map((u) => copia({ ...u, empresa: empresaDe(u.empresaId) }));
}

// ------------------------------------------------------------ preferências --

export async function lerPreferencias() {
    return { idioma: null, tema: null, ...(ler(CHAVE_PREFERENCIAS) ?? {}) };
}

export async function salvarPreferencias(mudancas) {
    gravar(CHAVE_PREFERENCIAS, { ...(await lerPreferencias()), ...mudancas });
}

export async function definirIdiomaDaConta(usuarioId, idioma) {
    const usuario = usuarioDe(usuarioId);
    if (!usuario) return;
    usuario.idioma = idioma;
    persistir();
}

export async function atualizarConta(usuario, { nome, idioma }) {
    const eu = atual(usuario);
    const novoNome = texto(nome, 120);
    if (!novoNome) throw new ErroDados('validacao', { nome: 'obrigatorio' });
    eu.nome = novoNome;
    if (idioma) eu.idioma = idioma;
    registrar('conta.atualizada', eu.id, eu.empresaId, eu.nome);
    persistir();
    return copia(eu);
}

// ---------------------------------------------------------------- empresas --

export async function obterEmpresa(id) {
    return copia(empresaDe(id));
}

/** Página pública da empresa: só empresa ativa (inexistente e inativa dão o mesmo "não encontrada"). */
export async function obterEmpresaPublica(identificador) {
    const empresa = carregar().empresas.find((e) => e.identificador === identificador && e.ativa);
    if (!empresa) return null;
    const pessoas = carregar().usuarios
        .filter((u) => u.empresaId === empresa.id && u.ativo)
        .sort((a, b) => (a.perfil === b.perfil ? a.nome.localeCompare(b.nome) : a.perfil === 'company_admin' ? -1 : 1))
        .map(({ id, nome, perfil }) => ({ id, nome, perfil }));
    return copia({ ...empresa, pessoasDemo: pessoas });
}

export async function listarEmpresas(usuario, { busca = '', situacao = 'todas' } = {}) {
    exigir(pode(atual(usuario), 'ver-empresas'));
    const termo = busca.trim().toLowerCase();
    const { empresas, usuarios } = carregar();
    return copia(empresas
        .filter((e) => !termo || e.nome.toLowerCase().includes(termo) || e.identificador.includes(termo))
        .filter((e) => situacao === 'todas' || (situacao === 'ativas' ? e.ativa : !e.ativa))
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map((e) => ({ ...e, pessoasAtivas: usuarios.filter((u) => u.empresaId === e.id && u.ativo).length })));
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

export async function salvarEmpresa(usuario, entrada) {
    const eu = atual(usuario);
    exigir(pode(eu, 'gerir-empresas'));
    const dados = carregar();
    const existente = entrada.id ? dados.empresas.find((e) => e.id === entrada.id) : null;
    if (entrada.id) exigir(existente, 'nao-encontrado');

    const nome = texto(entrada.nome, 150);
    let identificador = texto(entrada.identificador, 60).toLowerCase();
    const cor = texto(entrada.cor, 7);
    const erros = {};
    const params = {};
    if (!nome) erros.nome = 'obrigatorio';
    if (!identificador && !existente) {
        const base = gerarIdentificador(nome);
        identificador = base;
        for (let i = 2; dados.empresas.some((e) => e.identificador === identificador); i++) identificador = `${base}-${i}`;
    }
    if (!identificadorValido(identificador)) erros.identificador = 'identificador';
    else if (dados.empresas.some((e) => e.identificador === identificador && e.id !== existente?.id)) erros.identificador = 'identificadorEmUso';
    if (cor && !corValida(cor)) erros.cor = 'corFormato';
    else if (cor && !corLegivel(cor)) {
        erros.cor = 'corContraste';
        params.razao = contrasteComBranco(cor).toFixed(1);
    }
    if (Object.keys(erros).length) throw new ErroDados('validacao', erros, params);

    const valores = {
        nome,
        identificador,
        cor: cor ? cor.toLowerCase() : null,
        mensagem: texto(entrada.mensagem, 300),
        ativa: existente ? Boolean(entrada.ativa) : true,
        solicitacoesAtivas: Boolean(entrada.solicitacoesAtivas),
        aprovador: entrada.aprovador === 'consultoria' ? 'consultoria' : 'empresa',
        logo: entrada.logo === undefined ? existente?.logo ?? null : entrada.logo,
    };
    let empresa;
    if (existente) {
        empresa = Object.assign(existente, valores);
        registrar('empresa.atualizada', eu.id, empresa.id, empresa.nome);
    } else {
        empresa = { id: novoId('emp'), criadoEm: agora(), ...valores };
        dados.empresas.push(empresa);
        registrar('empresa.criada', eu.id, empresa.id, empresa.nome);
    }
    persistir();
    return copia(empresa);
}

// ------------------------------------------------------------------ pessoas --

export async function listarPessoas(usuario, empresaId, { busca = '', situacao = 'todas' } = {}) {
    const eu = atual(usuario);
    exigir(pode(eu, 'ver-pessoas', { empresaId }));
    const termo = busca.trim().toLowerCase();
    return copia(filtrarVisiveis(eu, carregar().usuarios)
        .filter((u) => u.empresaId === empresaId)
        .filter((u) => !termo || u.nome.toLowerCase().includes(termo) || u.email.includes(termo))
        .filter((u) => situacao === 'todas' || (situacao === 'ativas' ? u.ativo : !u.ativo))
        .sort((a, b) => a.nome.localeCompare(b.nome)));
}

export async function listarEquipe(usuario) {
    exigir(pode(atual(usuario), 'ver-equipe'));
    return copia(carregar().usuarios.filter((u) => ehEquipe(u.perfil)).sort((a, b) => a.nome.localeCompare(b.nome)));
}

export async function definirSituacaoPessoa(usuario, pessoaId, ativo) {
    const eu = atual(usuario);
    const pessoa = usuarioDe(pessoaId);
    exigir(pessoa, 'nao-encontrado');
    exigir(pode(eu, 'gerir-pessoa', { pessoa }));
    pessoa.ativo = Boolean(ativo);
    registrar(ativo ? 'pessoa.reativada' : 'pessoa.desativada', eu.id, pessoa.empresaId, pessoa.nome);
    persistir();
    return copia(pessoa);
}

export async function definirPerfilPessoa(usuario, pessoaId, perfil) {
    const eu = atual(usuario);
    const pessoa = usuarioDe(pessoaId);
    exigir(pessoa, 'nao-encontrado');
    exigir(pode(eu, 'mudar-perfil', { pessoa }) && ehDaEmpresa(perfil));
    pessoa.perfil = perfil;
    registrar('pessoa.perfil', eu.id, pessoa.empresaId, pessoa.nome);
    persistir();
    return copia(pessoa);
}

export async function renomearPessoa(usuario, pessoaId, nome) {
    const eu = atual(usuario);
    const pessoa = usuarioDe(pessoaId);
    exigir(pessoa, 'nao-encontrado');
    exigir(pode(eu, 'gerir-pessoa', { pessoa }));
    const novo = texto(nome, 120);
    if (!novo) throw new ErroDados('validacao', { nome: 'obrigatorio' });
    pessoa.nome = novo;
    registrar('pessoa.editada', eu.id, pessoa.empresaId, novo);
    persistir();
    return copia(pessoa);
}

// ------------------------------------------------------------------ convites --

function conviteParaTela(convite) {
    const { usuarios } = carregar();
    return {
        ...convite,
        pendente: convitePendente(convite),
        expirado: !convite.aceitoEm && !convite.canceladoEm && !convitePendente(convite),
        convidadoPorNome: usuarios.find((u) => u.id === convite.convidadoPor)?.nome ?? null,
    };
}

export async function listarConvites(usuario, empresaId) {
    const eu = atual(usuario);
    if (empresaId) exigir(pode(eu, 'ver-pessoas', { empresaId }));
    else exigir(pode(eu, 'ver-equipe'));
    return copia(carregar().convites
        .filter((c) => c.empresaId === (empresaId ?? null) && !c.aceitoEm && !c.canceladoEm)
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
        .map(conviteParaTela));
}

/** Motivo de não poder convidar este e-mail (ou null se pode). */
function bloqueioDeEmail(email) {
    const { usuarios, convites } = carregar();
    if (!emailValido(email)) return 'email';
    if (usuarios.some((u) => u.email === email)) return 'contaExiste';
    if (convites.some((c) => c.email === email && convitePendente(c))) return 'convitePendente';
    return null;
}

function novoConvite(eu, email, perfil, empresa) {
    const convite = {
        id: novoId('cnv'), email, perfil, empresaId: empresa?.id ?? null, convidadoPor: eu.id, codigo: codigoAleatorio(),
        criadoEm: agora(), expiraEm: new Date(Date.now() + VALIDADE_CONVITE_DIAS * 86_400_000).toISOString(), aceitoEm: null, canceladoEm: null,
    };
    carregar().convites.push(convite);
    registrar(empresa ? 'convite.criado' : 'equipe.convidada', eu.id, empresa?.id, email);
    return convite;
}

export async function criarConvite(usuario, { email, perfil, empresaId }) {
    const eu = atual(usuario);
    const empresa = empresaId ? empresaDe(empresaId) : null;
    exigir(podeConvidar(eu, perfil, empresa));
    const alvo = texto(email, 255).toLowerCase();
    const bloqueio = bloqueioDeEmail(alvo);
    if (bloqueio) throw new ErroDados('validacao', { email: bloqueio });
    const convite = novoConvite(eu, alvo, perfil, empresa);
    persistir();
    return copia(conviteParaTela(convite));
}

/** Convite em lote: analisa as linhas ("Nome; e-mail" ou só o e-mail) antes de criar. */
export async function analisarLote(usuario, empresaId, conteudo) {
    exigir(podeConvidar(atual(usuario), 'student', empresaDe(empresaId)));
    const vistos = new Set();
    return String(conteudo || '').split(/\r?\n/).map((linha, i) => ({ linha, numero: i + 1 }))
        .filter(({ linha }) => linha.trim())
        .slice(0, 200)
        .map(({ linha, numero }) => {
            const partes = linha.split(/[;,\t]/).map((p) => p.trim()).filter(Boolean);
            const email = (partes.find((p) => p.includes('@')) ?? '').toLowerCase();
            const nome = partes.find((p) => !p.includes('@')) ?? '';
            let motivo = bloqueioDeEmail(email);
            if (!motivo && vistos.has(email)) motivo = 'duplicadoNaLista';
            vistos.add(email);
            return { numero, nome, email, ok: !motivo, motivo };
        });
}

export async function criarConvitesEmLote(usuario, empresaId, emails) {
    const eu = atual(usuario);
    const empresa = empresaDe(empresaId);
    exigir(podeConvidar(eu, 'student', empresa));
    const criados = [];
    for (const email of new Set(emails.map((e) => String(e).toLowerCase()))) {
        if (!bloqueioDeEmail(email)) criados.push(novoConvite(eu, email, 'student', empresa));
    }
    persistir();
    return copia(criados.map(conviteParaTela));
}

function conviteGerivel(eu, conviteId) {
    const convite = carregar().convites.find((c) => c.id === conviteId);
    exigir(convite, 'nao-encontrado');
    exigir(podeConvidar(eu, convite.perfil, empresaDe(convite.empresaId)));
    exigir(!convite.aceitoEm && !convite.canceladoEm, 'nao-encontrado');
    return convite;
}

/** Gera link novo (o anterior deixa de valer) e renova a validade. */
export async function renovarConvite(usuario, conviteId) {
    const eu = atual(usuario);
    const convite = conviteGerivel(eu, conviteId);
    convite.codigo = codigoAleatorio();
    convite.expiraEm = new Date(Date.now() + VALIDADE_CONVITE_DIAS * 86_400_000).toISOString();
    registrar('convite.renovado', eu.id, convite.empresaId, convite.email);
    persistir();
    return copia(conviteParaTela(convite));
}

export async function cancelarConvite(usuario, conviteId) {
    const eu = atual(usuario);
    const convite = conviteGerivel(eu, conviteId);
    convite.canceladoEm = agora();
    registrar('convite.cancelado', eu.id, convite.empresaId, convite.email);
    persistir();
}

/** Página pública do convite. */
export async function obterConvite(codigo) {
    const convite = carregar().convites.find((c) => c.codigo === codigo);
    if (!convite || !convitePendente(convite)) return null;
    const empresa = empresaDe(convite.empresaId);
    if (convite.empresaId && !empresa?.ativa) return null;
    return copia({ email: convite.email, perfil: convite.perfil, empresa: empresa ? { nome: empresa.nome, cor: empresa.cor } : null });
}

/** Aceite: perfil, empresa e e-mail vêm do convite. Cria a conta e entra. */
export async function aceitarConvite(codigo, nome) {
    const dados = carregar();
    const convite = dados.convites.find((c) => c.codigo === codigo);
    if (!convite || !convitePendente(convite)) throw new ErroDados('nao-encontrado');
    const novoNome = texto(nome, 120);
    if (!novoNome) throw new ErroDados('validacao', { nome: 'obrigatorio' });
    if (dados.usuarios.some((u) => u.email === convite.email)) throw new ErroDados('nao-encontrado');

    const usuario = {
        id: novoId('usr'), nome: novoNome, email: convite.email, perfil: convite.perfil, empresaId: convite.empresaId,
        ativo: true, idioma: 'pt-BR', ultimoAcesso: null, criadoEm: agora(),
    };
    dados.usuarios.push(usuario);
    convite.aceitoEm = agora();
    registrar('convite.aceito', usuario.id, usuario.empresaId, usuario.email);
    return abrirSessao(usuario);
}

// -------------------------------------------------------------- solicitações --

/**
 * Pedido de acesso pela página da empresa. Quem pede recebe sempre a mesma
 * resposta (gravou, repetido, conta existente…): ninguém descobre dados de terceiros.
 */
export async function enviarSolicitacao(identificador, { nome, email, mensagem }) {
    const empresa = carregar().empresas.find((e) => e.identificador === identificador && e.ativa && e.solicitacoesAtivas);
    if (!empresa) throw new ErroDados('nao-encontrado');
    const alvo = texto(email, 255).toLowerCase();
    const erros = {};
    if (!texto(nome, 120)) erros.nome = 'obrigatorio';
    if (!emailValido(alvo)) erros.email = 'email';
    if (Object.keys(erros).length) throw new ErroDados('validacao', erros);

    const { solicitacoes, usuarios, convites } = carregar();
    const silencioso = usuarios.some((u) => u.email === alvo)
        || convites.some((c) => c.email === alvo && convitePendente(c))
        || solicitacoes.some((s) => s.empresaId === empresa.id && s.email === alvo && s.situacao === 'pendente');
    if (silencioso) return;

    solicitacoes.push({
        id: novoId('sol'), empresaId: empresa.id, nome: texto(nome, 120), email: alvo, mensagem: texto(mensagem, 500),
        situacao: 'pendente', criadoEm: agora(), decididoPor: null, decididoEm: null, motivo: null,
    });
    registrar('solicitacao.criada', null, empresa.id, alvo);
    persistir();
}

export async function listarSolicitacoes(usuario, { empresaId = '', situacao = 'pendente' } = {}) {
    const eu = atual(usuario);
    exigir(pode(eu, 'ver-solicitacoes'));
    const { solicitacoes, usuarios } = carregar();
    return copia(solicitacoes
        .filter((s) => ehEquipe(eu.perfil) || s.empresaId === eu.empresaId)
        .filter((s) => !empresaId || s.empresaId === empresaId)
        .filter((s) => situacao === 'todas' || s.situacao === situacao)
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
        .map((s) => {
            const empresa = empresaDe(s.empresaId);
            return {
                ...s,
                empresaNome: empresa?.nome ?? '',
                podeDecidir: s.situacao === 'pendente' && pode(eu, 'decidir-solicitacao', { empresa }),
                decididoPorNome: usuarios.find((u) => u.id === s.decididoPor)?.nome ?? null,
            };
        }));
}

function solicitacaoDecidivel(eu, id) {
    const solicitacao = carregar().solicitacoes.find((s) => s.id === id);
    exigir(solicitacao, 'nao-encontrado');
    exigir(pode(eu, 'decidir-solicitacao', { empresa: empresaDe(solicitacao.empresaId) }));
    if (solicitacao.situacao !== 'pendente') throw new ErroDados('validacao', { solicitacao: 'jaDecidida' });
    return solicitacao;
}

/** Aprovar gera um convite (mesmas regras de qualquer convite). */
export async function aprovarSolicitacao(usuario, id) {
    const eu = atual(usuario);
    const solicitacao = solicitacaoDecidivel(eu, id);
    const empresa = empresaDe(solicitacao.empresaId);
    const bloqueio = bloqueioDeEmail(solicitacao.email);
    if (bloqueio) throw new ErroDados('validacao', { solicitacao: bloqueio });
    // A equipe convida por qualquer empresa; o gestor, só alunos da própria.
    const convite = novoConvite(eu, solicitacao.email, 'student', empresa);
    Object.assign(solicitacao, { situacao: 'aprovada', decididoPor: eu.id, decididoEm: agora() });
    registrar('solicitacao.aprovada', eu.id, empresa.id, solicitacao.email);
    persistir();
    return copia(conviteParaTela(convite));
}

export async function recusarSolicitacao(usuario, id, motivo) {
    const eu = atual(usuario);
    const solicitacao = solicitacaoDecidivel(eu, id);
    const justificativa = texto(motivo, 300);
    if (!justificativa) throw new ErroDados('validacao', { motivo: 'obrigatorio' });
    Object.assign(solicitacao, { situacao: 'recusada', decididoPor: eu.id, decididoEm: agora(), motivo: justificativa });
    registrar('solicitacao.recusada', eu.id, solicitacao.empresaId, solicitacao.email);
    persistir();
}

// ------------------------------------------------------------------ cursos --

const aulasDoCurso = (curso) => curso.modulos.flatMap((m) => m.aulas);

function progressoDe(curso, matricula) {
    const aulas = aulasDoCurso(curso);
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
        tentativasRestantes: Math.max(0, curso.tentativas - matricula.tentativas.length),
        concluido: Boolean(matricula.concluidoEm),
        concluidoEm: matricula.concluidoEm,
        certificadoId: matricula.certificadoId,
    };
}

/** Curso visível para quem estuda: ativo e liberado para a empresa da pessoa. */
function cursoLiberado(curso, pessoa) {
    return curso.ativo && podeEstudar(pessoa.perfil) && curso.empresas.includes(pessoa.empresaId);
}

/** Versão do curso para quem estuda: sem o gabarito (como faria o servidor). */
function semGabarito(curso) {
    return { ...curso, avaliacao: { questoes: curso.avaliacao.questoes.map(({ correta, ...resto }) => resto) } };
}

export async function listarCursos(usuario, { busca = '' } = {}) {
    const eu = atual(usuario);
    const { cursos, matriculas } = carregar();
    const termo = busca.trim().toLowerCase();
    const filtrados = cursos
        .filter((c) => !termo || c.titulo.toLowerCase().includes(termo))
        .filter((c) => ehEquipe(eu.perfil) || cursoLiberado(c, eu));
    return copia(filtrados.map((c) => {
        const daTurma = matriculas.filter((m) => m.cursoId === c.id);
        const minha = matriculas.find((m) => m.cursoId === c.id && m.usuarioId === eu.id);
        return {
            id: c.id, titulo: c.titulo, descricao: c.descricao, cargaHoraria: c.cargaHoraria, ativo: c.ativo, empresas: c.empresas,
            modulos: c.modulos.length, aulas: aulasDoCurso(c).length,
            matriculados: daTurma.length, concluidos: daTurma.filter((m) => m.concluidoEm).length,
            progresso: podeEstudar(eu.perfil) ? progressoDe(c, minha) : null,
        };
    }).sort((a, b) => a.titulo.localeCompare(b.titulo)));
}

export async function obterCurso(usuario, cursoId) {
    const eu = atual(usuario);
    const curso = carregar().cursos.find((c) => c.id === cursoId);
    exigir(curso, 'nao-encontrado');
    exigir(ehEquipe(eu.perfil) || cursoLiberado(curso, eu));
    const matricula = carregar().matriculas.find((m) => m.cursoId === cursoId && m.usuarioId === eu.id);
    return copia({
        ...(ehEquipe(eu.perfil) ? curso : semGabarito(curso)),
        progresso: podeEstudar(eu.perfil) ? progressoDe(curso, matricula) : null,
        aulasConcluidas: matricula?.aulasConcluidas ?? [],
    });
}

/** Cria ou atualiza o curso inteiro (dados, módulos, aulas e avaliação). */
export async function salvarCurso(usuario, entrada) {
    const eu = atual(usuario);
    exigir(pode(eu, 'gerir-cursos'));
    const dados = carregar();
    const existente = entrada.id ? dados.cursos.find((c) => c.id === entrada.id) : null;
    if (entrada.id) exigir(existente, 'nao-encontrado');

    const erros = {};
    const titulo = texto(entrada.titulo, 150);
    if (!titulo) erros.titulo = 'obrigatorio';
    const numero = (valor, min, max, padrao) => {
        const n = Number(valor);
        return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : padrao;
    };
    const modulos = (entrada.modulos ?? []).map((m) => ({
        id: m.id || novoId('mod'),
        titulo: texto(m.titulo, 120) || '—',
        aulas: (m.aulas ?? []).map((a) => {
            const tipo = a.tipo === 'video' ? 'video' : 'texto';
            const videoId = tipo === 'video' ? codigoYoutube(a.video ?? a.videoId) : null;
            if (tipo === 'video' && !videoId) erros.video = 'video';
            return { id: a.id || novoId('aul'), titulo: texto(a.titulo, 150) || '—', tipo, minutos: numero(a.minutos, 0, 600, 10), conteudo: texto(a.conteudo, 4000), videoId };
        }),
    }));
    const questoes = (entrada.avaliacao?.questoes ?? []).map((q) => {
        const alternativas = (q.alternativas ?? []).map((alt) => texto(alt, 200)).filter(Boolean);
        if (!texto(q.enunciado, 400) || alternativas.length < 2) erros.questoes = 'questao';
        return { id: q.id || novoId('q'), enunciado: texto(q.enunciado, 400), alternativas, correta: numero(q.correta, 0, Math.max(0, alternativas.length - 1), 0) };
    });
    if (Object.keys(erros).length) throw new ErroDados('validacao', erros);

    const valores = {
        titulo,
        descricao: texto(entrada.descricao, 600),
        cargaHoraria: numero(entrada.cargaHoraria, 1, 400, 1),
        notaMinima: numero(entrada.notaMinima, 0, 100, 70),
        tentativas: numero(entrada.tentativas, 1, 10, 3),
        ativo: Boolean(entrada.ativo),
        avancoAutomatico: Boolean(entrada.avancoAutomatico),
        empresas: (entrada.empresas ?? []).filter((id) => empresaDe(id)),
        modulos,
        avaliacao: { questoes },
    };
    let curso;
    if (existente) {
        curso = Object.assign(existente, valores);
        registrar('curso.atualizado', eu.id, null, curso.titulo);
    } else {
        curso = { id: novoId('cur'), criadoEm: agora(), ...valores };
        dados.cursos.push(curso);
        registrar('curso.criado', eu.id, null, curso.titulo);
    }
    persistir();
    return copia(curso);
}

/** Pessoas que `usuario` pode matricular neste curso (para o seletor da equipe/gestor). */
export async function pessoasParaMatricular(usuario, cursoId) {
    const eu = atual(usuario);
    const curso = carregar().cursos.find((c) => c.id === cursoId);
    exigir(curso, 'nao-encontrado');
    const { usuarios, matriculas } = carregar();
    return copia(usuarios
        .filter((p) => p.id !== eu.id && cursoLiberado(curso, p) && p.ativo && pode(eu, 'matricular', { pessoa: p }))
        .filter((p) => !matriculas.some((m) => m.cursoId === cursoId && m.usuarioId === p.id))
        .map(({ id, nome, empresaId }) => ({ id, nome, empresaNome: empresaDe(empresaId)?.nome ?? '' }))
        .sort((a, b) => a.nome.localeCompare(b.nome)));
}

export async function matricular(usuario, cursoId, pessoaId = null) {
    const eu = atual(usuario);
    const curso = carregar().cursos.find((c) => c.id === cursoId);
    const pessoa = usuarioDe(pessoaId ?? eu.id);
    exigir(curso && pessoa, 'nao-encontrado');
    exigir(cursoLiberado(curso, pessoa) && pode(eu, 'matricular', { pessoa }));
    const { matriculas } = carregar();
    let matricula = matriculas.find((m) => m.cursoId === cursoId && m.usuarioId === pessoa.id);
    if (!matricula) {
        matricula = { id: novoId('mat'), cursoId, usuarioId: pessoa.id, criadoEm: agora(), aulasConcluidas: [], tentativas: [], ultimaAtividade: agora(), concluidoEm: null, certificadoId: null };
        matriculas.push(matricula);
        registrar('matricula.criada', eu.id, pessoa.empresaId, `${pessoa.nome} — ${curso.titulo}`);
        persistir();
    }
    return copia(progressoDe(curso, matricula));
}

function somarPontos(usuarioId, tipo, ref, valor) {
    const { pontos } = carregar();
    if (pontos.some((p) => p.usuarioId === usuarioId && p.tipo === tipo && p.ref === ref)) return 0; // não soma duas vezes
    pontos.push({ usuarioId, tipo, ref, valor, em: agora() });
    return valor;
}

function verificarDesafio(usuarioId) {
    const limite = Date.now() - DESAFIO_SEMANAL.dias * 86_400_000;
    const recentes = carregar().pontos.filter((p) => p.usuarioId === usuarioId && p.tipo === 'aula' && new Date(p.em).getTime() >= limite).length;
    if (recentes < DESAFIO_SEMANAL.aulas) return 0;
    const semana = Math.floor(Date.now() / (7 * 86_400_000));
    return somarPontos(usuarioId, 'desafio', `semana-${semana}`, PONTOS.desafio);
}

function concluirSePossivel(curso, matricula, pessoa) {
    if (matricula.concluidoEm || !cursoCompleto(curso, matricula)) return;
    matricula.concluidoEm = agora();
    const certificado = {
        id: novoId('cer'), cursoId: curso.id, usuarioId: pessoa.id, emitidoEm: matricula.concluidoEm,
        codigo: `MJC-${codigoAleatorio(4).toUpperCase()}-${codigoAleatorio(4).toUpperCase()}`,
    };
    carregar().certificados.push(certificado);
    matricula.certificadoId = certificado.id;
    somarPontos(pessoa.id, 'curso', curso.id, PONTOS.curso);
    registrar('curso.concluido', pessoa.id, pessoa.empresaId, curso.titulo);
    registrar('certificado.emitido', pessoa.id, pessoa.empresaId, curso.titulo);
}

function minhaMatricula(eu, cursoId) {
    const curso = carregar().cursos.find((c) => c.id === cursoId);
    exigir(curso, 'nao-encontrado');
    exigir(cursoLiberado(curso, eu));
    const matricula = carregar().matriculas.find((m) => m.cursoId === cursoId && m.usuarioId === eu.id);
    exigir(matricula);
    return { curso, matricula };
}

/** Marca a aula como concluída (uma vez só), soma pontos e confere conclusão do curso. */
export async function concluirAula(usuario, cursoId, aulaId) {
    const eu = atual(usuario);
    const { curso, matricula } = minhaMatricula(eu, cursoId);
    const aula = aulasDoCurso(curso).find((a) => a.id === aulaId);
    exigir(aula, 'nao-encontrado');
    let ganhos = 0;
    if (!matricula.aulasConcluidas.includes(aulaId)) {
        matricula.aulasConcluidas.push(aulaId);
        ganhos += somarPontos(eu.id, 'aula', aulaId, PONTOS.aula);
        ganhos += verificarDesafio(eu.id);
        registrar('aula.concluida', eu.id, eu.empresaId, aula.titulo);
    }
    matricula.ultimaAtividade = agora();
    concluirSePossivel(curso, matricula, eu);
    persistir();
    return copia({ ...progressoDe(curso, matricula), pontosGanhos: ganhos });
}

/** Corrige no "servidor": as respostas chegam, o gabarito nunca sai daqui. */
export async function enviarAvaliacao(usuario, cursoId, respostas) {
    const eu = atual(usuario);
    const { curso, matricula } = minhaMatricula(eu, cursoId);
    const questoes = curso.avaliacao.questoes;
    exigir(questoes.length > 0, 'nao-encontrado');
    if (aulasDoCurso(curso).some((a) => !matricula.aulasConcluidas.includes(a.id))) throw new ErroDados('validacao', { avaliacao: 'aulasPendentes' });
    if (matricula.tentativas.some((t) => t.aprovado)) throw new ErroDados('validacao', { avaliacao: 'jaAprovado' });
    if (matricula.tentativas.length >= curso.tentativas) throw new ErroDados('validacao', { avaliacao: 'semTentativas' });
    if (questoes.some((q) => respostas[q.id] === undefined || respostas[q.id] === '')) throw new ErroDados('validacao', { avaliacao: 'respondaTodas' });

    const nota = notaAvaliacao(questoes, respostas);
    const aprovado = nota >= curso.notaMinima;
    matricula.tentativas.push({ em: agora(), nota, aprovado });
    matricula.ultimaAtividade = agora();
    let ganhos = 0;
    if (aprovado) {
        ganhos += somarPontos(eu.id, 'avaliacao', curso.id, PONTOS.avaliacao);
        if (nota === 100) ganhos += somarPontos(eu.id, 'notaMaxima', curso.id, PONTOS.notaMaxima);
    }
    registrar(aprovado ? 'avaliacao.aprovada' : 'avaliacao.reprovada', eu.id, eu.empresaId, curso.titulo);
    concluirSePossivel(curso, matricula, eu);
    persistir();
    return copia({
        nota, aprovado, notaMinima: curso.notaMinima, pontosGanhos: ganhos,
        correcao: questoes.map((q) => ({ id: q.id, acertou: Number(respostas[q.id]) === q.correta })),
        progresso: progressoDe(curso, matricula),
    });
}

/** Certificado: dono, gestor da empresa ou equipe podem ver. */
export async function obterCertificado(usuario, certificadoId) {
    const eu = atual(usuario);
    const certificado = carregar().certificados.find((c) => c.id === certificadoId);
    exigir(certificado, 'nao-encontrado');
    const dono = usuarioDe(certificado.usuarioId);
    exigir(dono.id === eu.id || ehEquipe(eu.perfil) || (eu.perfil === 'company_admin' && dono.empresaId === eu.empresaId));
    const curso = carregar().cursos.find((c) => c.id === certificado.cursoId);
    return copia({ ...certificado, nome: dono.nome, curso: curso.titulo, cargaHoraria: curso.cargaHoraria, empresa: empresaDe(dono.empresaId)?.nome ?? '' });
}

// ------------------------------------------------------------- gamificação --

export async function perfilGamificacao(usuario) {
    const eu = atual(usuario);
    const { pontos, matriculas } = carregar();
    const meus = pontos.filter((p) => p.usuarioId === eu.id);
    const total = meus.reduce((soma, p) => soma + p.valor, 0);
    const minhasMatriculas = matriculas.filter((m) => m.usuarioId === eu.id);
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
export async function rankingEmpresa(usuario) {
    const eu = atual(usuario);
    exigir(eu.empresaId);
    const { usuarios, pontos } = carregar();
    return copia(usuarios
        .filter((u) => u.empresaId === eu.empresaId && u.ativo && podeEstudar(u.perfil))
        .map((u) => ({ id: u.id, nome: u.nome, pontos: pontos.filter((p) => p.usuarioId === u.id).reduce((s, p) => s + p.valor, 0) }))
        .sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome))
        .slice(0, 10)
        .map((linha, i) => ({ ...linha, posicao: i + 1, voce: linha.id === eu.id })));
}

// ------------------------------------------------------------------- painel --

export async function resumoPainel(usuario) {
    const eu = atual(usuario);
    const { empresas, usuarios, solicitacoes, matriculas, certificados, cursos } = carregar();
    const daEmpresa = (id) => usuarios.find((u) => u.id === id)?.empresaId === eu.empresaId;

    if (ehEquipe(eu.perfil)) {
        return {
            empresasAtivas: empresas.filter((e) => e.ativa).length,
            alunosAtivos: usuarios.filter((u) => u.ativo && u.empresaId).length,
            cursosAtivos: cursos.filter((c) => c.ativo).length,
            matriculas: matriculas.length,
            certificados: certificados.length,
            solicitacoesPendentes: solicitacoes.filter((s) => s.situacao === 'pendente').length,
        };
    }
    if (eu.perfil === 'company_admin') {
        const daCasa = matriculas.filter((m) => daEmpresa(m.usuarioId));
        return {
            funcionariosAtivos: usuarios.filter((u) => u.empresaId === eu.empresaId && u.ativo).length,
            taxaConclusao: daCasa.length ? daCasa.filter((m) => m.concluidoEm).length / daCasa.length : 0,
            certificados: certificados.filter((c) => daEmpresa(c.usuarioId)).length,
            solicitacoesPendentes: solicitacoes.filter((s) => s.empresaId === eu.empresaId && s.situacao === 'pendente').length,
        };
    }
    return {};
}

/** Atividade que o perfil pode ver (admin: tudo; consultora: empresas + as próprias; gestor: a empresa; aluno: as suas). */
function auditoriaVisivel(eu) {
    return carregar().auditoria.filter((evento) => {
        if (eu.perfil === 'admin') return true;
        if (eu.perfil === 'consultant') return evento.empresaId !== null || evento.autorId === eu.id || evento.acao.startsWith('curso.');
        if (eu.perfil === 'company_admin') return evento.empresaId === eu.empresaId;
        return evento.autorId === eu.id;
    });
}

function comNomes(eventos) {
    const { usuarios, empresas } = carregar();
    return eventos.map((evento) => ({
        ...evento,
        autor: usuarios.find((u) => u.id === evento.autorId)?.nome ?? null,
        empresa: empresas.find((e) => e.id === evento.empresaId)?.nome ?? null,
    }));
}

export async function atividadeRecente(usuario, limite = 6) {
    const eu = atual(usuario);
    return copia(comNomes(auditoriaVisivel(eu).sort((a, b) => b.em.localeCompare(a.em)).slice(0, limite)));
}

// ---------------------------------------------------------------- auditoria --

export const CATEGORIAS_AUDITORIA = ['empresa', 'pessoa', 'convite', 'equipe', 'solicitacao', 'curso', 'matricula', 'aula', 'avaliacao', 'certificado', 'conta'];

export async function listarAuditoria(usuario, { de = '', ate = '', empresaId = '', categoria = '', pessoa = '' } = {}, pagina = 1, porPagina = 15) {
    const eu = atual(usuario);
    exigir(pode(eu, 'ver-auditoria'));
    const inicio = de ? new Date(`${de}T00:00:00`).getTime() : -Infinity;
    const fim = ate ? new Date(`${ate}T23:59:59.999`).getTime() : Infinity;
    const termo = pessoa.trim().toLowerCase();
    const filtrados = comNomes(auditoriaVisivel(eu))
        .filter((e) => {
            const quando = new Date(e.em).getTime();
            return quando >= inicio && quando <= fim;
        })
        .filter((e) => !empresaId || e.empresaId === empresaId)
        .filter((e) => !categoria || e.acao.startsWith(`${categoria}.`))
        .filter((e) => !termo || (e.autor ?? '').toLowerCase().includes(termo) || String(e.alvo ?? '').toLowerCase().includes(termo))
        .sort((a, b) => b.em.localeCompare(a.em));
    const paginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
    const atualPagina = Math.min(Math.max(1, pagina), paginas);
    return copia({ itens: filtrados.slice((atualPagina - 1) * porPagina, atualPagina * porPagina), total: filtrados.length, pagina: atualPagina, paginas });
}

// --------------------------------------------------------------- relatórios --

const DIAS_ATRASO = 7;

export async function relatorio(usuario, { empresaId = '', cursoId = '' } = {}) {
    const eu = atual(usuario);
    exigir(pode(eu, 'ver-relatorios'));
    const escopoEmpresa = ehEquipe(eu.perfil) ? empresaId : eu.empresaId;
    const { matriculas, usuarios, cursos, certificados } = carregar();
    const limiteAtraso = Date.now() - DIAS_ATRASO * 86_400_000;

    const linhas = matriculas
        .map((m) => ({ m, pessoa: usuarios.find((u) => u.id === m.usuarioId), curso: cursos.find((c) => c.id === m.cursoId) }))
        .filter(({ pessoa, curso }) => pessoa && curso)
        .filter(({ pessoa }) => !escopoEmpresa || pessoa.empresaId === escopoEmpresa)
        .filter(({ curso }) => !cursoId || curso.id === cursoId)
        .map(({ m, pessoa, curso }) => {
            const p = progressoDe(curso, m);
            const atrasado = !m.concluidoEm && new Date(m.ultimaAtividade).getTime() < limiteAtraso;
            return {
                pessoa: pessoa.nome, empresa: empresaDe(pessoa.empresaId)?.nome ?? '', curso: curso.titulo, cursoId: curso.id,
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
            matriculados: doCurso.length,
            concluidos: doCurso.filter((l) => l.concluido).length,
            taxa: doCurso.filter((l) => l.concluido).length / doCurso.length,
            notaMedia: notasCurso.length ? Math.round(notasCurso.reduce((s, n) => s + n, 0) / notasCurso.length) : null,
        };
    }).sort((a, b) => b.matriculados - a.matriculados);

    const visiveis = new Set(linhas.map((l) => `${l.pessoa}|${l.cursoId}`));
    return copia({
        indicadores: {
            matriculas: linhas.length,
            emAndamento: linhas.filter((l) => l.situacao === 'andamento').length,
            concluidas: linhas.filter((l) => l.concluido).length,
            taxaConclusao: linhas.length ? linhas.filter((l) => l.concluido).length / linhas.length : 0,
            aprovacoes: linhas.filter((l) => l.aprovado).length,
            reprovacoes: linhas.reduce((s, l) => s + l.reprovacoes, 0),
            notaMedia: notas.length ? Math.round(notas.reduce((s, n) => s + n, 0) / notas.length) : null,
            certificados: certificados.filter((c) => {
                const dono = usuarios.find((u) => u.id === c.usuarioId);
                const curso = cursos.find((x) => x.id === c.cursoId);
                return dono && curso && visiveis.has(`${dono.nome}|${curso.id}`);
            }).length,
            atrasados: linhas.filter((l) => l.situacao === 'atrasado').length,
        },
        porCurso,
        linhas,
        diasAtraso: DIAS_ATRASO,
    });
}
