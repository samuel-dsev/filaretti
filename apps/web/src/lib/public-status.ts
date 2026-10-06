/** Standalone response for a status that must be known before React starts streaming. */
export function publicStatusHtml(status: 404 | 503, nonce?: string): string {
  const missing = status === 404;
  const title = missing ? 'Página não encontrada' : 'Conteúdo temporariamente indisponível';
  const description = missing
    ? 'Este endereço não está disponível. Explore as páginas institucionais ou volte ao início.'
    : 'Não foi possível carregar as informações agora. Tente novamente em alguns instantes.';
  const nonceAttribute =
    nonce && /^[A-Za-z\d+/]{20,80}={0,2}$/u.test(nonce) ? ` nonce="${nonce}"` : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title}</title><style${nonceAttribute}>
  *{box-sizing:border-box}body{margin:0;color:#141b1f;background:#faf7f1;font:16px/1.65 Arial,sans-serif}header{padding:24px max(16px,calc((100% - 1280px)/2));background:#faf7f1;border-bottom:1px solid #eee2ce}a{color:#141b1f}a:focus-visible{outline:3px solid #141b1f;outline-offset:4px}header a{display:inline-flex;min-height:44px;align-items:center;font:600 28px Georgia,serif;text-decoration:none}main{max-width:800px;margin:auto;padding:clamp(48px,10vw,120px) 24px}h1{color:#060708;font:600 clamp(40px,7vw,64px)/1.1 Georgia,serif;margin:0 0 24px}p{margin:0 0 32px}nav{display:flex;gap:16px;flex-wrap:wrap}nav a{display:inline-flex;align-items:center;min-height:44px;padding:10px 18px;background:#141b1f;color:#faf7f1;text-decoration:none;border-radius:4px}nav a+ a{background:#eee2ce;color:#060708}.skip{position:absolute;left:16px;top:8px;padding:12px;background:#faf7f1;transform:translateY(-200%)}.skip:focus{transform:none}.brand-logo{position:relative;display:block;width:154px;height:44px;overflow:hidden}.brand-logo img{position:absolute;top:-27px;left:30px;width:94px;height:94px}
  </style></head><body><a class="skip" href="#conteudo">Ir para o conteúdo</a><header><a href="/" aria-label="Página inicial"><span class="brand-logo"><img src="/brand/logomarca.jpg" alt="Ettori &amp; Filaretti Advogados" width="1254" height="1254"></span></a></header><main id="conteudo" tabindex="-1"><p>${status}</p><h1>${title}</h1><p>${description}</p><nav aria-label="Continuar navegando"><a href="/">Voltar ao início</a><a href="${missing ? '/areas-de-atuacao' : ''}">${missing ? 'Áreas de atuação' : 'Tentar novamente'}</a></nav></main></body></html>`;
}
