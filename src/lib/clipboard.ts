import { toast } from 'sonner';
import { copyText } from './utils';

/** Copy once; on failure (no clipboard permission) show the text so it can be copied by hand. */
export async function copyWithToast(text: string, success: string) {
  if (await copyText(text)) toast.success(success);
  else toast.message('Copy this link', { description: text, duration: 12000 });
}
