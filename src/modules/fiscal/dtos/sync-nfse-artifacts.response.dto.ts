import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class SyncNfseArtifactsResponseDto {
  @ApiProperty({ example: true })
  found!: boolean

  @ApiPropertyOptional({ example: '698c972c4cf35620b8333687' })
  id?: string

  @ApiPropertyOptional({ example: 'AUTHORIZED' })
  status?: string

  @ApiProperty({ example: false })
  synced!: boolean

  @ApiProperty({ example: 'already_present' })
  reason!: string

  @ApiProperty({ example: true })
  hasXml!: boolean

  @ApiProperty({ example: true })
  hasPdf!: boolean

  @ApiPropertyOptional({ example: '698c972d33f27fa48bc0f659' })
  artifactId?: string
}
