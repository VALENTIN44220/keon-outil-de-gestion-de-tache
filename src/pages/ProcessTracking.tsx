import { PageHeader } from '@/components/layout/PageHeader';

export default function ProcessTracking() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Suivi des processus" />
      <main className="p-6">
        <div className="flex items-center justify-center min-h-[400px] border-2 border-dashed border-border rounded-xl">
          <p className="text-muted-foreground text-lg">
            Les écrans de suivi par processus apparaîtront ici.
          </p>
        </div>
      </main>
    </div>
  );
}
