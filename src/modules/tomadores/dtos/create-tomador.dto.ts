import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

class CreateTomadorEnderecoDto {
  @ApiPropertyOptional({ example: 'Rua Exemplo' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  logradouro?: string;

  @ApiPropertyOptional({ example: '100' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  numero?: string;

  @ApiPropertyOptional({ example: 'Apto 12' })
  @IsOptional()
  @IsString()
  complemento?: string;

  @ApiPropertyOptional({ example: 'Centro' })
  @IsOptional()
  @IsString()
  bairro?: string;

  @ApiPropertyOptional({ example: 'Manaus' })
  @IsOptional()
  @IsString()
  municipio?: string;

  @ApiPropertyOptional({ example: 'AM' })
  @IsOptional()
  @IsString()
  uf?: string;

  @ApiPropertyOptional({ example: '69010000' })
  @IsOptional()
  @IsString()
  cep?: string;
}

export class CreateTomadorDto {
  @ApiProperty({ example: '43521115000134' })
  @IsString()
  @IsNotEmpty()
  empresaCnpj!: string;

  @ApiProperty({ example: '61020788100' })
  @IsString()
  @IsNotEmpty()
  cpfCnpj!: string;

  @ApiProperty({ example: 'ANDRE AUGUSTO DE HOLANDA LOBO' })
  @IsString()
  @IsNotEmpty()
  razaoSocial!: string;

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
  @Type(() => CreateTomadorEnderecoDto)
  endereco?: CreateTomadorEnderecoDto;
}
