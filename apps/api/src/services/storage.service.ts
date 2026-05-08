import { supabase } from '../lib/supabase.js';

export class StorageService {
  private bucket = process.env.STORAGE_BUCKET || 'invoices';

  async uploadPdf(
    userId: string,
    invoiceId: string,
    pdfBuffer: Buffer
  ): Promise<string> {
    const filePath = `${userId}/${invoiceId}.pdf`;

    // Upload (upsert to overwrite existing)
    const { error } = await supabase.storage
      .from(this.bucket)
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) throw error;

    // Get signed URL (valid for 7 days)
    const { data: signedUrl, error: signError } = await supabase.storage
      .from(this.bucket)
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);

    if (signError) throw signError;

    return signedUrl.signedUrl;
  }

  async downloadPdf(userId: string, invoiceId: string): Promise<Buffer> {
    const filePath = `${userId}/${invoiceId}.pdf`;

    const { data, error } = await supabase.storage
      .from(this.bucket)
      .download(filePath);

    if (error) throw error;

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async deletePdf(userId: string, invoiceId: string): Promise<void> {
    const filePath = `${userId}/${invoiceId}.pdf`;

    const { error } = await supabase.storage
      .from(this.bucket)
      .remove([filePath]);

    if (error) throw error;
  }

  async uploadLogo(userId: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
    const ext = mimeType.split('/')[1] || 'png';
    const filePath = `${userId}/logos/logo.${ext}`;

    const { error } = await supabase.storage
      .from(this.bucket)
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from(this.bucket)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async uploadSignature(userId: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
    const ext = mimeType.split('/')[1] || 'png';
    const filePath = `${userId}/signatures/signature.${ext}`;

    const { error } = await supabase.storage
      .from(this.bucket)
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from(this.bucket)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
}

export const storageService = new StorageService();
