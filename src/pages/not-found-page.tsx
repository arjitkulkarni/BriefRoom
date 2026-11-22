import { Link } from 'react-router-dom';
import { FullPageMessage } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <FullPageMessage title="Page not found" action={<Button asChild><Link to="/">Go home</Link></Button>}>
      The link may be incomplete. Private order links must include their key — ask the sender to resend it.
    </FullPageMessage>
  );
}
