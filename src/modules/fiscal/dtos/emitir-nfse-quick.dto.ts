import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class EmitirNfseQuickDto {
  @ApiProperty({ example: '61020788100' })
  @IsString()
  @IsNotEmpty()
  cpfTomador!: string;

  @ApiProperty({ example: 125 })
  @IsNumber()
  @IsPositive()
  valor!: number;
}
