import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

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

  @ApiPropertyOptional({ example: 'cliente@example.com' })
  @IsOptional()
  @IsString()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateTomadorEnderecoDto)
  endereco?: UpdateTomadorEnderecoDto;
}
