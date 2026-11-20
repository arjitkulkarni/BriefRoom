/**
 * Nexconn bootstrap - one connection per page load:
 *  1. NCEngine.initialize (Chat SDK) with app key + data center
 *  2. NCChatUIApplication.initialize (Chat UI) with ServiceHooks backed by our API
 *  3. registerCustomMessages -> BriefRoom card bubbles (forwarded to NCEngine too)
 *  4. message menu: "Add to brief" on image messages; reactions + editing switched on
 *  5. app.ready(), then NCEngine.connect({ token }) with a server-issued token
 */
import { AreaCode, GroupChannelIdentifier, LogLevel, MessageType, NCEngine, SendMessageParams } from '@nexconn/chat';
import {
  ChatUICommand,
  ChatUIEvents,
  NCChatUIApplication,
  type ChatUICustomMessageRegistration,
  type ChatUIMessageModel,
} from '@nexconn/chatui';
import { MSG } from '../../shared/types';
import { api, getConfig } from './api';
import { CARD_ELEMENTS } from './cards';

let chatUI: NCChatUIApplication | null = null;
let initP: Promise<NCChatUIApplication> | null = null;
let connectP: Promise<string> | null = null;
let connectedAs: string | null = null;

const AREAS: Record<string, AreaCode> = { SG: AreaCode.SG, NA: AreaCode.NA, SA: AreaCode.SA, OM: AreaCode.OM };
export const ADD_TO_BRIEF = 'message.menu.item.briefroom.add';

type AddToBrief = (imageUrl: string, channelId: string) => void;
let addToBriefHandler: AddToBrief | null = null;
export const onAddToBrief = (fn: AddToBrief | null) => (addToBriefHandler = fn);

type ChannelSelected = (channelId: string | null) => void;
let channelSelectedHandler: ChannelSelected | null = null;
export const onChannelSelected = (fn: ChannelSelected | null) => (channelSelectedHandler = fn);

const ICON_PIN =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e4572e" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12h8M12 8v8"/></svg>',
  );

const card = (messageType: string, tagName: string, elementClass: CustomElementConstructor, digest: string): ChatUICustomMessageRegistration => ({
  messageType,
  isPersisted: true,
  isCounted: true,
  digest: () => digest,
  component: { tagName, elementClass: elementClass as any, disableDefaultBubblePadding: true },
});

export function initNexconn(): Promise<NCChatUIApplication> {
  if (initP) return initP;
  initP = (async () => {
    const c = await getConfig();
    if (!c.nexconnReady || !c.appKey) throw new Error('Nexconn is not configured on the server yet. Add NEXCONN_APP_KEY and NEXCONN_APP_SECRET to .env.');
    NCEngine.initialize({ appKey: c.appKey, areaCode: AREAS[c.area] ?? AreaCode.SG, logLevel: import.meta.env.DEV ? LogLevel.INFO : LogLevel.WARN });

    const names = new Map<string, string>();
    const app = NCChatUIApplication.initialize({
      language: 'en_US',
      hooks: {
        async reqUserProfiles(ids) {
          const missing = ids.filter((id) => !names.has(id));
          if (missing.length) {
            try {
              (await api.profiles(missing)).profiles.forEach((p) => names.set(p.userId, p.name));
            } catch {
              /* defaults below */
            }
          }
          return ids.map((userId) => ({ userId, name: names.get(userId) ?? 'User', avatarUrl: avatarFor(userId, names.get(userId) ?? 'U') }));
        },
        async reqGroupProfiles(ids) {
          try {
            return (await api.groups(ids)).groups.map((g) => ({ ...g, avatarUrl: avatarFor(g.groupId, g.name.replace(/^\W+/, '') || 'O') }));
          } catch {
            return ids.map((groupId) => ({ groupId, name: 'Order', memberCount: 2 }));
          }
        },
        async reqGroupMembers(groupId) {
          try {
            return (await api.members(groupId)).members;
          } catch {
            return [];
          }
        },
        async reqSystemProfiles(ids) {
          return ids.map((systemId) => ({ systemId, name: 'BriefRoom' }));
        },
        getDefaultUserProfile: (userId) => ({ userId, name: 'User', avatarUrl: avatarFor(userId, 'U') }),
      },
    });
    if (!app) throw new Error('Nexconn Chat UI failed to initialize');

    const { StartCard, RefCard, PinCard, SpecCard, VersionCard, DecisionCard } = CARD_ELEMENTS;
    const reg = app.registerCustomMessages([
      card(MSG.START, 'br-start', StartCard, '[Brief room opened]'),
      card(MSG.REF, 'br-ref', RefCard, '[Reference image]'),
      card(MSG.PIN, 'br-pin', PinCard, '[Pin on image]'),
      card(MSG.SPEC, 'br-spec', SpecCard, '[Details updated]'),
      card(MSG.VERSION, 'br-version', VersionCard, '[New version to review]'),
      card(MSG.DECISION, 'br-decision', DecisionCard, '[Approval update]'),
    ]);
    if (!reg.isOk) console.warn('registerCustomMessages failed', reg.code);

    // "Add to brief" on image messages: a photo shared in chat becomes a reference in one tap.
    const menu = app.cloneMessageMenu();
    menu.unshift({ id: ADD_TO_BRIEF, icon: ICON_PIN, filter: (m: ChatUIMessageModel) => m.messageType === MessageType.IMAGE });
    app.setMessageMenu(menu);
    const en = app.cloneLanguageEntries('en_US');
    if (en) app.registerLanguagePack('en_US', { ...en, [ADD_TO_BRIEF]: 'Add to brief' });
    app.addEventListener(ChatUIEvents.MESSAGE_MENU_ITEM_CLICK, (evt: any) => {
      const { id, message } = evt.data ?? {};
      if (id !== ADD_TO_BRIEF) return;
      const url = message?.content?.remoteUrl;
      if (url && addToBriefHandler) addToBriefHandler(url, message.channelIdentifier.channelId);
    });
    app.addEventListener(ChatUIEvents.CHANNEL_SELECTED, (evt: any) => channelSelectedHandler?.(evt.data?.model?.channelId ?? null));

    app.setCommandSwitch(ChatUICommand.MESSAGE_REACTION_ENABLED, true);
    app.setCommandSwitch(ChatUICommand.MESSAGE_EDIT_ENABLED, true);
    app.setCommandSwitch(ChatUICommand.SHOW_MESSAGE_STATE, true);
    app.ready();
    chatUI = app;
    return app;
  })();
  initP.catch(() => (initP = null));
  return initP;
}

export function connectNexconn(token: string, userId: string): Promise<string> {
  if (connectedAs === userId) return Promise.resolve(userId);
  if (connectP) return connectP;
  connectP = (async () => {
    await initNexconn();
    const r = await NCEngine.connect({ token });
    if (!r.isOk || !r.data) throw new Error(`Could not connect to Nexconn (code ${r.code})`);
    connectedAs = r.data.userId;
    return connectedAs;
  })();
  connectP.catch(() => (connectP = null));
  return connectP;
}

export const getChatUI = () => chatUI;

/** Post a BriefRoom card into the order's group conversation through Chat UI (shows instantly). */
export async function postCard<T extends Record<string, any>>(channelId: string, type: string, content: T): Promise<void> {
  const app = chatUI;
  if (!app) return;
  const res = await app.sendMessage(new GroupChannelIdentifier(channelId), new SendMessageParams<T>(content, type));
  if (!res.isOk) console.warn('card send failed', type, res.code);
}

export function avatarFor(id: string, name: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const letter = (name.trim()[0] || 'U').toUpperCase().replace(/[<&>"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="32" fill="hsl(${h % 360} 55% 52%)"/><text x="50%" y="54%" font-family="Arial" font-size="28" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="middle">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
