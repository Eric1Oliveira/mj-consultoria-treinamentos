// Página de divulgação (divulgacao.html): o contato de WhatsApp vem da configuração que o
// administrador mantém na plataforma (tela Divulgação). Sem conexão com o banco, fica o
// contato escrito no próprio HTML.

import { rpc } from './supabase.js';
import { formatarWhatsapp, linkWhatsapp } from './regras.js';

try {
    const c = await rpc('obter_configuracao');
    if (c?.whatsapp) {
        document.querySelectorAll('[data-whatsapp]').forEach((link) => {
            link.href = linkWhatsapp(c.whatsapp, c.whatsapp_mensagem);
        });
        document.querySelectorAll('[data-telefone]').forEach((el) => {
            el.textContent = formatarWhatsapp(c.whatsapp);
        });
    }
} catch {
    // fica o contato escrito na página
}
