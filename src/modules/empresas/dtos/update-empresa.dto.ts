import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateEmpresaDto {
  @ApiPropertyOptional()
  razaoSocial?: string

  @ApiPropertyOptional()
  nomeFantasia?: string

  @ApiPropertyOptional()
  inscricaoMunicipal?: string

  @ApiPropertyOptional()
  email?: string

  @ApiPropertyOptional()
  fone?: string

  @ApiPropertyOptional()
  endereco?: {
    logradouro?: string
    numero?: string
    complemento?: string
    bairro?: string
    codigoMunicipio?: string
    cidade?: string
    uf?: string
    codigoPais?: string
    pais?: string
    cep?: string
  }
}
