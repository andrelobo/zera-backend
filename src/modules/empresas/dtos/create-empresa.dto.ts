import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateEmpresaDto {
  @ApiProperty({ example: '43521115000134' })
  @IsString()
  @IsNotEmpty()
  cnpj!: string;
}
