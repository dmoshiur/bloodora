// Optional offline copies of the EXACT existing CDN packages. Only test traffic
// is intercepted; application requests and auth/session logic are untouched.
import path from 'node:path';
import { readFileSync } from 'node:fs';
export async function offlineAssets(context) {
  if (!process.env.BLOODORA_OFFLINE_ASSETS) return;
  await context.route('https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/**',r=>r.fulfill({path:path.resolve('node_modules/bootstrap',new URL(r.request().url()).pathname.split('bootstrap@5.3.3/')[1])}));
  await context.route('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/**',r=>r.fulfill({path:path.resolve('node_modules/@fortawesome/fontawesome-free',new URL(r.request().url()).pathname.split('6.5.2/')[1])}));
  const fontCss=['hind-siliguri','noto-serif-bengali','inter','cormorant-garamond'].flatMap(font=>[400,700].map(weight=>readFileSync(`node_modules/@fontsource/${font}/${weight}.css`,'utf8').replaceAll('./files/',`https://fonts.gstatic.com/test-font/${font}/`))).join('\n');
  await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:fontCss}));
  await context.route('https://fonts.gstatic.com/test-font/**',r=>{
    const [font,file]=new URL(r.request().url()).pathname.split('/test-font/')[1].split('/');
    return r.fulfill({path:path.resolve(`node_modules/@fontsource/${font}/files`,file)});
  });
  await context.route('https://ui-avatars.com/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#e31b23"/><text x="20" y="42" fill="white">T</text></svg>'}));
}
