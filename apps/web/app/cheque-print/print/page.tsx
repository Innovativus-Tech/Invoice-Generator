import PrintPageClient from '@/components/cheque-print/PrintPageClient';

export default function ChequePrintOutputPage() {
  return (
    <main
      className="print-route"
      style={{
        width: '90mm',
        height: '200mm',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      <PrintPageClient />
    </main>
  );
}
