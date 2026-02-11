import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

class EmitirNfseResultDto {
  @ApiProperty({ example: 'PENDING' })
  status!: string

  @ApiProperty({ example: 'PLUGNOTAS' })
  provider!: string

  @ApiPropertyOptional({ example: 'ffd6e161-1db1-4b81-8dd3-570c4b3362d4' })
  externalId?: string

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  providerResponse?: Record<string, any>

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  providerRequest?: Record<string, any>
}

export class EmitirNfseResponseDto {
  @ApiProperty({ example: '67b0f0d6b2453be7552e736a' })
  emissionId!: string

  @ApiProperty({
    description: 'true quando a resposta reaproveita emissão existente por idempotência.',
    example: false,
  })
  idempotentReplay!: boolean

  @ApiProperty({ type: EmitirNfseResultDto })
  result!: EmitirNfseResultDto
}
