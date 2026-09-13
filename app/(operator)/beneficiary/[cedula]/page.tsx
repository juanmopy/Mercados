import { BeneficiaryDetail } from './components/beneficiary-detail';

export default async function BeneficiaryPage({ params }: { params: Promise<{ cedula: string }> }) {
  const { cedula } = await params;
  return <BeneficiaryDetail cedula={cedula} />;
}
