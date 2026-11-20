/**
 * Chat UI custom message bubbles (Web Components). Chat UI sets `.message` (ChatUIMessageModel)
 * on each element; tags are registered as nc-c-<tagName>.
 * Buttons dispatch a window event `briefroom:focus` that the Brief workspace listens to.
 */
import { PIN_KINDS, type DecisionContent, type PinContent, type RefContent, type SpecContent, type StartContent, type VersionContent } from '../../shared/types';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const who = (r: string) => (r === 'seller' ? 'Seller' : 'Customer');
const money = (n: unknown) => (typeof n === 'number' ? `₹${n.toLocaleString('en-IN')}` : 'price pending');

const BASE_CSS = `
  :host{display:block}
  .c{font-family:'Inter',system-ui,sans-serif;min-width:230px;max-width:300px;border-radius:12px;overflow:hidden;
     border:1px solid #ece6df;background:#fff;color:#1f1a17}
  .h{display:flex;align-items:center;gap:6px;padding:8px 12px;font-size:11px;font-weight:700;letter-spacing:.05em;
     text-transform:uppercase;background:#faf6f1;color:#8a5a44;border-bottom:1px solid #f0e8df}
  .b{padding:10px 12px;font-size:13.5px;line-height:1.45}
  .t{font-weight:700;font-size:14.5px;margin-bottom:4px}
  ul{margin:6px 0 0;padding-left:18px} li{margin:2px 0}
  .m{color:#7a6f68;font-size:12px;margin-top:6px}
  button{margin-top:10px;width:100%;border:0;border-radius:9px;padding:8px 10px;font-weight:700;font-size:13px;
     cursor:pointer;background:#e4572e;color:#fff}
  button.g{background:#f4eee8;color:#4a3b33}
  .crop{width:100%;height:120px;background-repeat:no-repeat;background-color:#f4eee8;position:relative}
  .swatch{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-2px;margin-right:4px;border:1px solid #0002}
  .ok{color:#15803d} .warn{color:#b45309}
  .hash{font-family:ui-monospace,monospace;font-size:11px;color:#7a6f68}
`;

function focus(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('briefroom:focus', { detail }));
}

abstract class Card<T> extends HTMLElement {
  private _m: any;
  set message(m: any) {
    this._m = m;
    this.paint();
  }
  get message() {
    return this._m;
  }
  connectedCallback() {
    this.paint();
  }
  protected abstract html(c: T): string;
  protected bind(_root: ShadowRoot, _c: T) {}
  private paint() {
    if (!this._m) return;
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    const c = (this._m.content ?? {}) as T;
    root.innerHTML = `<style>${BASE_CSS}</style>${this.html(c)}`;
    this.bind(root, c);
  }
}

class StartCard extends Card<StartContent> {
  html(c: StartContent) {
    return `<div class="c"><div class="h">📋 Brief room opened</div><div class="b"><div class="t">${esc(c.title)}</div>
      Add reference photos, mark exactly what to keep or change, and agree on one version together.</div></div>`;
  }
}

class RefCard extends Card<RefContent> {
  html(c: RefContent) {
    return `<div class="c"><div class="h">🖼 Reference added · ${who(c.by)}</div>
      <div class="crop" style="background-image:url('${esc(c.url)}');background-size:cover;background-position:center"></div>
      <div class="b">${c.caption ? esc(c.caption) : '<span class="m">New reference image in the brief</span>'}<button class="g">Open in brief</button></div></div>`;
  }
  bind(root: ShadowRoot, c: RefContent) {
    root.querySelector('button')?.addEventListener('click', () => focus({ refId: c.refId }));
  }
}

class PinCard extends Card<PinContent> {
  html(c: PinContent) {
    const k = PIN_KINDS[c.kind] ?? PIN_KINDS.change;
    // Show only the pinned region: scale background so the region fills the box.
    const sx = 100 / Math.max(c.w, 0.02);
    const sy = 100 / Math.max(c.h, 0.02);
    const px = c.w >= 1 ? 0 : (c.x / (1 - c.w)) * 100;
    const py = c.h >= 1 ? 0 : (c.y / (1 - c.h)) * 100;
    return `<div class="c"><div class="h" style="color:${k.color}">${k.emoji} Pin #${c.n} · ${esc(k.label)}</div>
      <div class="crop" style="background-image:url('${esc(c.url)}');background-size:${sx}% ${sy}%;background-position:${px}% ${py}%"></div>
      <div class="b">${c.color ? `<span class="swatch" style="background:${esc(c.color)}"></span><b>${esc(c.color)}</b> · ` : ''}${esc(c.note) || '<span class="m">No note</span>'}
      <div class="m">by ${who(c.by)}</div><button class="g">Show on image</button></div></div>`;
  }
  bind(root: ShadowRoot, c: PinContent) {
    root.querySelector('button')?.addEventListener('click', () => focus({ pinId: c.pinId }));
  }
}

class SpecCard extends Card<SpecContent> {
  html(c: SpecContent) {
    const items = (c.changes ?? []).slice(0, 6);
    const more = (c.changes?.length ?? 0) - items.length;
    return `<div class="c"><div class="h">✏️ Details updated · ${who(c.by)}</div><div class="b"><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${more > 0 ? `<div class="m">+${more} more</div>` : ''}</div></div>`;
  }
}

class VersionCard extends Card<VersionContent> {
  html(c: VersionContent) {
    const items = (c.changes ?? []).slice(0, 5);
    return `<div class="c"><div class="h">📄 Version ${c.n} proposed · ${who(c.by)}</div><div class="b">
      <div class="t">${money(c.price)}</div>${c.note ? `<div>“${esc(c.note)}”</div>` : ''}
      ${items.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <div class="hash">#${esc(String(c.hash).slice(0, 10))}</div><button>Review version ${c.n}</button></div></div>`;
  }
  bind(root: ShadowRoot, c: VersionContent) {
    root.querySelector('button')?.addEventListener('click', () => focus({ version: c.n }));
  }
}

class DecisionCard extends Card<DecisionContent> {
  html(c: DecisionContent) {
    if (c.decision === 'agreed')
      return `<div class="c" style="border-color:#86efac"><div class="h" style="background:#f0fdf4;color:#15803d">🤝 Brief agreed · version ${c.n}</div>
        <div class="b"><div class="t">Both sides approved the same version.</div>${money(c.price)} · locked<div class="hash">#${esc(String(c.hash ?? '').slice(0, 10))}</div>
        <button>Open work order</button></div></div>`;
    if (c.decision === 'approve')
      return `<div class="c"><div class="h ok">✅ ${who(c.by)} approved version ${c.n}</div><div class="b">Waiting for the other side to approve the same version.</div></div>`;
    if (c.decision === 'reopen')
      return `<div class="c"><div class="h warn">🔓 Brief reopened by seller</div><div class="b">Version ${c.n} stays on record. Changes will become a new version.</div></div>`;
    return `<div class="c"><div class="h warn">↩️ Changes requested on v${c.n} · ${who(c.by)}</div><div class="b">${esc(c.reason)}</div></div>`;
  }
  bind(root: ShadowRoot, c: DecisionContent) {
    root.querySelector('button')?.addEventListener('click', () => focus({ workOrder: c.n }));
  }
}

export const CARD_ELEMENTS = { StartCard, RefCard, PinCard, SpecCard, VersionCard, DecisionCard };
