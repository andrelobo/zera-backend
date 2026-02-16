import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Matches } from 'class-validator';

export class EmitirNfseQuickDto {
  @ApiProperty({ example: '43521115000134' })
  @IsString()
  @IsNotEmpty()
  cnpj!: string;

  @ApiProperty({ example: '61020788100' })
  @IsString()
  @IsNotEmpty()
  cpfTomador!: string;

  @ApiProperty({ example: 125 })
  @IsNumber()
  @IsPositive()
  valor!: number;

  @ApiProperty({
    example: '060101',
    required: false,
    description: 'Codigo nacional do servico (6 digitos). Se informado, a descricao e inferida.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'codigoServico deve conter exatamente 6 digitos' })
  codigoServico?: string;
}
