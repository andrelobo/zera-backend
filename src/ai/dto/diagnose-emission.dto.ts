import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DiagnoseEmissionDto {
  @ApiPropertyOptional({
    description: 'Mongo id da emissão a ser diagnosticada.',
    example: '680a7fb7b68434370d8a4cd2',
  })
  @IsOptional()
  @IsString()
  emissionId?: string;

  @ApiPropertyOptional({
    description: 'External id, idIntegracao ou outro identificador correlacionado à emissão.',
    example: 'quick-15000134-20260421153000-ab12cd',
  })
  @IsOptional()
  @IsString()
  externalId?: string;
}
