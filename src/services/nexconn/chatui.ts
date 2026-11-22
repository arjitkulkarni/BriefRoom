/**
 * Seller inbox: Nexconn Chat UI (channel list across every order of the shop).
 * Chat UI is initialised on top of NCEngine BEFORE connect, registers the BR:* custom
 * message types (forwarded to NCEngine) and renders them with one Web Component.
 * Chat UI's components use a fixed light palette (no theming API) — documented in design.md §11.
 */
import { BR_REGISTRATIONS, type BrPayload } from '@shared/messages';
import { api } from '@/lib/api';
import { connect, initEngine } from './client';

type ChatUIApp = import('@nexconn/chatui').NCChatUIApplication;
let app: ChatUIApp | null = null;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const parse = (c: unknown): BrPayload | null => {
  try {
    const v = typeof c === 'string' ? JSON.parse(c) : (c as Record<string, unknown>);
    return v && (v as { v?: number }).v === 1 ? (v as unknown as BrPayload) : null;
  } catch {
    return null;
  }
};
/** Only same-origin asset paths are rendered, whatever the message claims. */
const safeImage = (u: string) => {
  try {
    const url = new URL(u, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith('/api/assets/') ? url.pathname + url.search : null;
  } catch {
    return null;
  }
};

class BrActivityElement extends HTMLElement {
  private m: { content?: unknown } | null = null;
  set message(m: { content?: unknown }) {
    this.m = m;
    this.render();
  }
  connectedCallback() {
    this.render();
  }
  private render() {
    if (!this.m) return;
    const p = parse(this.m.content);
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    if (!p) {
      root.innerHTML = '<p style="font:13px system-ui;color:#64625c;margin:8px">BriefRoom update</p>';
      return;
    }
    const img = p.crop ? safeImage(p.crop.imageUrl) : null;
    const w = Math.max(p.crop?.w ?? 1, 0.02);
    const h = Math.max(p.crop?.h ?? 1, 0.02);
    const pos = p.crop ? `${w >= 1 ? 0 : (p.crop.x / (1 - w)) * 100}% ${h >= 1 ? 0 : (p.crop.y / (1 - h)) * 100}%` : '0 0';
    root.innerHTML = `<style>
      :host{display:block}
      .c{font-family:Manrope,system-ui,sans-serif;width:260px;border:1px solid #e2dfd7;border-radius:12px;overflow:hidden;background:#fbfaf7;color:#17161a}
      .h{padding:7px 12px;font-size:11px;font-weight:700;color:#64625c;border-bottom:1px solid #ebe8e1}
      .crop{height:96px;background-repeat:no-repeat;background-color:#f1efea}
      .b{padding:9px 12px;font-size:13px;line-height:1.45}
      ul{margin:6px 0 0;padding-left:16px;color:#64625c;font-size:12px}
      a{display:inline-block;margin-top:8px;font-weight:700;font-size:12px;color:#17161a}
      .hash{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#64625c;margin-top:4px}
    </style>
    <div class="c">
      <div class="h">${esc(p.actor.name)} · ${esc(p.actor.role)}</div>
      ${img ? `<div class="crop" style="background-image:url('${esc(img)}');background-size:${100 / w}% ${100 / h}%;background-position:${pos}"></div>` : ''}
      <div class="b"><div>${esc(p.summary)}</div>
        ${p.lines?.length ? `<ul>${p.lines.slice(0, 4).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
        ${p.snapshotHash ? `<div class="hash">#${esc(p.snapshotHash.slice(0, 12))}</div>` : ''}
        <a href="/o/${encodeURIComponent(p.orderId)}">Open order →</a>
      </div>
    </div>`;
  }
}

export async function initInbox(shopId: string, key: string): Promise<ChatUIApp> {
  if (app) return app;
  await initEngine('chatui', async () => {
    const { NCChatUIApplication, ChatUICommand } = await import('@nexconn/chatui');
    const names = new Map<string, string>();
    const created = NCChatUIApplication.initialize({
      language: 'en_US',
      hooks: {
        async reqUserProfiles(ids: string[]) {
          const missing = ids.filter((id) => !names.has(id));
          if (missing.length) (await api.profiles(shopId, key, missing).catch(() => ({ profiles: [] }))).profiles.forEach((p) => names.set(p.userId, p.name));
          return ids.map((userId) => ({ userId, name: names.get(userId) ?? 'Customer' }));
        },
        async reqGroupProfiles(ids: string[]) {
          return (await api.groups(shopId, key, ids).catch(() => ({ groups: ids.map((groupId) => ({ groupId, name: 'Order', memberCount: 2 })) }))).groups;
        },
        async reqGroupMembers(groupId: string) {
          return (await api.members(shopId, key, groupId).catch(() => ({ members: [] }))).members;
        },
        async reqSystemProfiles(ids: string[]) {
          return ids.map((systemId) => ({ systemId, name: 'BriefRoom' }));
        },
        getDefaultUserProfile: (userId: string) => ({ userId, name: 'Customer' }),
      } as never,
    });
    if (!created) throw new Error('Nexconn Chat UI failed to initialise');
    const reg = created.registerCustomMessages(
      BR_REGISTRATIONS.map((r) => ({
        ...r,
        digest: (m: { content?: unknown }) => parse(m.content)?.summary ?? 'BriefRoom update',
        component: { tagName: 'br-activity', elementClass: BrActivityElement as never, disableDefaultBubblePadding: true },
      })) as never,
    );
    if (!reg.isOk) console.warn('[chatui] registerCustomMessages failed', reg.code);
    created.setCommandSwitch(ChatUICommand.MESSAGE_REACTION_ENABLED, true);
    created.setCommandSwitch(ChatUICommand.SHOW_MESSAGE_STATE, true);
    created.setChannelBarSwitch(true);
    created.setChannelBarTitle('Customer conversations');
    created.ready();
    app = created;
  });
  await connect(async (refresh) => {
    const t = await api.nexconnToken({ shopId, refresh }, key);
    return { token: t.token, userId: t.userId };
  });
  return app!;
}

export const getInboxApp = () => app;
