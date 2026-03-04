import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class UpdateTomadorEnderecoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logradouro?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  numero?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  complemento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bairro?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  municipio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cep?: string;
}

export class UpdateTomadorDto {
  @ApiPropertyOptional({ example: 'Cliente Exemplo Atualizado' })
  @IsOptional()
  @IsString()
  razaoSocial?: string;

  @ApiPropertyOptional({ example: '8214100099' })
  @IsOptional()
  @IsString()
  inscricaoMunicipal?: string;

  @ApiPropertyOptional({ example: '152233440001' })
  @IsOptional()
  @IsString()
  inscricaoEstadual?: string;

  @ApiPropertyOptional({ example: '12345678' })
  @IsOptional()
  @IsString()
  suframa?: string;

  @ApiPropertyOptional({ example: 'CLIENTE EXEMPLO LTDA' })
  @IsOptional()
  @IsString()
  nomeFantasia?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  substitutoTributario?: boolean;

  @ApiPropertyOptional({ example: 'cliente@example.com' })
  @IsOptional()
  @IsString()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '92999998888' })
  @IsOptional()
  @IsString()
  whatsapp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateTomadorEnderecoDto)
  endereco?: UpdateTomadorEnderecoDto;
}
