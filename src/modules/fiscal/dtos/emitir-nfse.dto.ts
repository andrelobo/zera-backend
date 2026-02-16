import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class RegimeTributarioSnDto {
  @IsOptional()
  @IsNumber()
  opSimpNac?: number;

  @IsOptional()
  @IsNumber()
  regApTribSN?: number;

  @IsOptional()
  @IsNumber()
  regEspTrib?: number;
}

class PrestadorEnderecoDto {
  @IsString()
  @IsNotEmpty()
  logradouro!: string;

  @IsString()
  @IsNotEmpty()
  numero!: string;

  @IsOptional()
  @IsString()
  complemento?: string;

  @IsString()
  @IsNotEmpty()
  bairro!: string;

  @IsString()
  @IsNotEmpty()
  municipio!: string;

  @IsString()
  @IsNotEmpty()
  uf!: string;

  @IsString()
  @IsNotEmpty()
  cep!: string;
}

class PrestadorDto {
  @IsString()
  @IsNotEmpty()
  cnpj!: string;

  @IsOptional()
  @IsString()
  inscricaoMunicipal?: string;

  @IsString()
  @IsNotEmpty()
  razaoSocial!: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RegimeTributarioSnDto)
  regimeTributarioSn?: RegimeTributarioSnDto;

  @IsObject()
  @ValidateNested()
  @Type(() => PrestadorEnderecoDto)
  endereco!: PrestadorEnderecoDto;
}

class TomadorEnderecoDto {
  @IsString()
  @IsNotEmpty()
  logradouro!: string;

  @IsString()
  @IsNotEmpty()
  numero!: string;

  @IsOptional()
  @IsString()
  complemento?: string;

  @IsString()
  @IsNotEmpty()
  bairro!: string;

  @IsString()
  @IsNotEmpty()
  municipio!: string;

  @IsString()
  @IsNotEmpty()
  uf!: string;

  @IsString()
  @IsNotEmpty()
  cep!: string;
}

class TomadorDto {
  @IsString()
  @IsNotEmpty()
  cpfCnpj!: string;

  @IsString()
  @IsNotEmpty()
  razaoSocial!: string;

  @IsOptional()
  @IsString()
  inscricaoMunicipal?: string;

  @IsOptional()
  @IsString()
  @IsEmail()
  email?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => TomadorEnderecoDto)
  endereco!: TomadorEnderecoDto;
}

class IssDto {
  @IsOptional()
  @IsNumber()
  tipoTributacao?: number;

  @IsOptional()
  @IsNumber()
  exigibilidade?: number;

  @IsOptional()
  @IsBoolean()
  retido?: boolean;

  @IsOptional()
  @IsNumber()
  aliquota?: number;
}

class TributacaoParcialDto {
  @IsOptional()
  @IsNumber()
  valor?: number;

  @IsOptional()
  @IsNumber()
  valorPercentual?: number;
}

class TributacaoTotalDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TributacaoParcialDto)
  federal?: TributacaoParcialDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TributacaoParcialDto)
  estadual?: TributacaoParcialDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TributacaoParcialDto)
  municipal?: TributacaoParcialDto;
}

class ServicoDto {
  @IsOptional()
  @IsString()
  codigoMunicipal?: string;

  @IsOptional()
  @IsString()
  codigoNacional?: string;

  @IsOptional()
  @IsString()
  codigoTributacao?: string;

  @IsString()
  @IsNotEmpty()
  descricao!: string;

  @IsNumber()
  valor!: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => IssDto)
  iss?: IssDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TributacaoTotalDto)
  tributacaoTotal?: TributacaoTotalDto;
}

export class EmitirNfseDto {
  @ApiProperty({
    example: {
      cnpj: '43521115000134',
      inscricaoMunicipal: '51754301',
      razaoSocial: 'BURGUS LTDA',
      regimeTributarioSn: {
        opSimpNac: 3,
        regApTribSN: 1,
        regEspTrib: 0,
      },
      endereco: {
        logradouro: 'Rua Saldanha Marinho',
        numero: '606',
        bairro: 'Centro',
        municipio: 'Manaus',
        uf: 'AM',
        cep: '69010040',
      },
    },
  })
  @IsObject()
  @ValidateNested()
  @Type(() => PrestadorDto)
  prestador!: PrestadorDto;

  @ApiProperty({
    example: {
      cpfCnpj: '11144477735',
      razaoSocial: 'Cliente Exemplo',
      inscricaoMunicipal: '8214100099',
      email: 'cliente@example.com',
      endereco: {
        logradouro: 'Rua Exemplo',
        numero: '100',
        bairro: 'Centro',
        municipio: 'Manaus',
        uf: 'AM',
        cep: '69010000',
      },
    },
  })
  @IsObject()
  @ValidateNested()
  @Type(() => TomadorDto)
  tomador!: TomadorDto;

  @ApiProperty({
    example: {
      codigoMunicipal: '0107',
      codigoNacional: '100101',
      descricao: 'Serviços de informática',
      valor: 100,
      iss: {
        tipoTributacao: 6,
        exigibilidade: 1,
        retido: false,
        aliquota: 2,
      },
      tributacaoTotal: {
        federal: { valor: 0.1, valorPercentual: 1 },
        estadual: { valor: 0.1, valorPercentual: 2 },
        municipal: { valor: 0.1, valorPercentual: 3 },
      },
    },
  })
  @IsObject()
  @ValidateNested()
  @Type(() => ServicoDto)
  servico!: ServicoDto;

  @ApiProperty({ example: 'teste-cli-005' })
  @IsString()
  @IsNotEmpty()
  referenciaExterna!: string;
}
