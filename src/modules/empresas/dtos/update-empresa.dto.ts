import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class UpdateEmpresaEnderecoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  logradouro?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
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
  codigoMunicipio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cidade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  codigoPais?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pais?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cep?: string;
}

export class UpdateEmpresaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  razaoSocial?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nomeFantasia?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inscricaoMunicipal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inscricaoEstadual?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  suframa?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  situacaoCadastral?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataSituacaoCadastral?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataInicioAtividade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cnaeFiscal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cnaeFiscalDescricao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  porte?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  naturezaJuridica?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  capitalSocial?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  opcaoPeloSimples?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataOpcaoPeloSimples?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataExclusaoDoSimples?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  opcaoPeloMei?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  whatsapp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateEmpresaEnderecoDto)
  endereco?: UpdateEmpresaEnderecoDto;
}
