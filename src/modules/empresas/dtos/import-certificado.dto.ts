import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ImportCertificadoDto {
  @ApiProperty({ example: '43521115000134' })
  @IsString()
  @IsNotEmpty()
  cnpj!: string;

  @ApiProperty({ example: 'senha-do-certificado' })
  @IsString()
  @IsNotEmpty()
  senhaCertificado!: string;
}
