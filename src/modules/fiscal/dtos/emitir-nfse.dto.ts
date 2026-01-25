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
    email?: string
    endereco: {
      logradouro: string
      numero: string
      bairro: string
      municipio: string
      uf: string
      cep: string
    }
  }

  @ApiProperty({
    example: {
      codigoMunicipal: '0107',
      descricao: 'Serviços de informática',
      valor: 100,
    },
  })
  servico!: {
    codigoMunicipal: string
    descricao: string
    valor: number
  }

  @ApiProperty({ example: 'teste-cli-005' })
  referenciaExterna!: string
}
