import { JornadaDetail } from './components/jornada-detail';

export default async function JornadaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JornadaDetail jornadaId={id} />;
}
