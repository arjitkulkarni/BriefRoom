import { ErrorPage } from '../components/ui';

export default function NotFound() {
  return (
    <ErrorPage title="Page not found">
      <a href="/">Go to BriefRoom home</a>
    </ErrorPage>
  );
}
