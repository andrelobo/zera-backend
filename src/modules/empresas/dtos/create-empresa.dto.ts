import { ApiProperty } from '@nestjs/swagger'

export class CreateEmpresaDto {
  @ApiProperty({ example: '43521115000134' })
  cnpj!: string
}
