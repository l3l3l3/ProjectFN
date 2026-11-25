import { BondList } from "@/components/company/bond-list";

export default async function BondsPage({
  searchParams,
}: {
  searchParams: Promise<{ bond?: string }>;
}) {
  const { bond } = await searchParams;
  return <BondList selectedBond={bond} />;
}
