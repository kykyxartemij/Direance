import ArtTitle from '@/components/ui/ArtTitle';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl py-8">
      <ArtTitle
        title="Upload"
        description="Upload an Excel file exported from Merit.ee or any other source. The file is parsed locally — it never leaves your browser."
      />
      {children}
    </div>
  );
}
