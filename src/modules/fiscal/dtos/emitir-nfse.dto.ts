import { ApiProperty } from '@nestjs/swagger'

export class EmitirNfseDto {
  @ApiProperty({
    example: {
      cnpj: '43521115000134',
      inscricaoMunicipal: '51754301',
      razaoSocial: 'BURGUS LTDA',
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
  prestador!: {
    cnpj: string
    inscricaoMunicipal?: string
    razaoSocial: string
    endereco: {
      logradouro: string
      numero: string
      complemento?: string
      bairro: string
      municipio: string
      uf: string
      cep: string
    }
  }

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
  tomador!: {
    cpfCnpj: string
    razaoSocial: string
    inscricaoMunicipal?: string
    email?: string
    endereco: {
      logradouro: string
      numero: string
      complemento?: string
      bairro: string
      municipio: string
      uf: string
      cep: string
    }
  }

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
  servico!: {
    codigoMunicipal?: string
    codigoNacional?: string
    codigoTributacao?: string
    descricao: string
    valor: number
    iss?: {
      tipoTributacao?: number
      exigibilidade?: number
      retido?: boolean
      aliquota?: number
    }
    tributacaoTotal?: {
      federal?: {
        valor?: number
        valorPercentual?: number
      }
      estadual?: {
        valor?: number
        valorPercentual?: number
      }
      municipal?: {
        valor?: number
        valorPercentual?: number
      }
    }
  }

  @ApiProperty({ example: 'teste-cli-005' })
  referenciaExterna!: string
}
