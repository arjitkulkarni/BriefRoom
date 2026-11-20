/**
 * Mounts Nexconn Chat UI (<nc-chat-ui-app-provider>).
 *  - "room":  one order conversation (group channel), channel list hidden
 *  - "inbox": seller sees every order conversation in the built-in channel list
 */
import { useEffect, useRef } from 'react';
import { GroupChannelIdentifier } from '@nexconn/chat';
import { getChatUI } from '../lib/nexconn';

export default function ChatUIPanel({ mode, channelId }: { mode: 'room' | 'inbox'; channelId?: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const app = getChatUI();
    if (!app || !host.current) return;
    if (mode === 'inbox') {
      app.setChannelBarSwitch(true);
      app.setChannelBarTitle('Customer conversations');
    } else {
      app.setChannelBarSwitch(false);
      app.setChannelDetailBackSwitch(false);
    }
    if (!host.current.querySelector('nc-chat-ui-app-provider')) host.current.appendChild(document.createElement('nc-chat-ui-app-provider'));
    if (mode === 'room' && channelId) {
      app.openChannel(new GroupChannelIdentifier(channelId), false).catch((e) => console.warn('openChannel failed', e));
    }
  }, [mode, channelId]);
  return <div ref={host} className="chatui-host" />;
}
