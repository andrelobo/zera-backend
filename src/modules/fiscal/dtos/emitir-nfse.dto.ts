export class EmitirNfseDto {
  prestador!: {
    cnpj: string
  }

  tomador!: {
    cpfCnpj: string
  }

  servico!: Record<string, any>

  referenciaExterna!: string
}
