import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PlugNotasHttp } from './plugnotas.http';

function sanitizeFileName(value: string) {
  const normalized = value.trim();
  if (!normalized) return 'certificado.pfx';
  return normalized.replace(/[\r\n"]/g, '_');
}

function buildMultipartFormData(input: {
  fields?: Array<{ name: string; value: string }>;
  files?: Array<{
    name: string;
    filename: string;
    contentType: string;
    content: Buffer;
  }>;
}) {
  const boundary = `----zera-${randomBytes(12).toString('hex')}`;
  const chunks: Buffer[] = [];

  for (const field of input.fields ?? []) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${field.name}"\r\n\r\n${field.value}\r\n`,
      ),
    );
  }

  for (const file of input.files ?? []) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${sanitizeFileName(
          file.filename,
        )}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
      ),
    );
    chunks.push(file.content);
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function extractResponseDataId(value: any): string | undefined {
  const raw = value?.data?.id ?? value?.id ?? value?.data?._id ?? value?._id;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

@Injectable()
export class PlugNotasCompanyApi {
  private readonly logger = new Logger(PlugNotasCompanyApi.name);

  constructor(private readonly http: PlugNotasHttp) {}

  async uploadCertificado(input: {
    buffer: Buffer;
    password: string;
    fileName?: string;
    mimeType?: string;
    email?: string;
  }) {
    const multipart = buildMultipartFormData({
      fields: [
        { name: 'senha', value: input.password },
        ...(input.email?.trim() ? [{ name: 'email', value: input.email.trim() }] : []),
      ],
      files: [
        {
          name: 'arquivo',
          filename: input.fileName ?? 'certificado.pfx',
          contentType: input.mimeType ?? 'application/x-pkcs12',
          content: input.buffer,
        },
      ],
    });

    const response = await this.http.request<any>({
      method: 'POST',
      path: '/certificado',
      headers: {
        'Content-Type': multipart.contentType,
      },
      body: multipart.body,
    });

    const id = extractResponseDataId(response);
    if (!id) {
      this.logger.warn('Upload de certificado na PlugNotas sem id retornado');
    }

    return {
      id,
      response,
    };
  }

  cadastrarEmpresa(body: Record<string, unknown>) {
    return this.http.request<any>({
      method: 'POST',
      path: '/empresa',
      body,
    });
  }

  habilitarEmpresaNfseNacional(cnpj: string) {
    return this.http.request<any>({
      method: 'PUT',
      path: '/Empresa/updateCompany',
      body: {
        cnpj,
        cpfCnpj: cnpj,
        nfseNacional: true,
      },
    });
  }
}
