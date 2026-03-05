import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ImportCnaeCatalogItemDto {
  @ApiProperty({ example: '6201501' })
  @IsString()
  @IsNotEmpty()
  codigoCnae!: string;

  @ApiPropertyOptional({ example: 'Desenvolvimento de programas de computador sob encomenda' })
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiProperty({ example: 'III' })
  @IsString()
  @IsNotEmpty()
  anexo!: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  permiteFatorR?: boolean;
}

export class ImportCnaeCatalogDto {
  @ApiProperty({ type: [ImportCnaeCatalogItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportCnaeCatalogItemDto)
  items!: ImportCnaeCatalogItemDto[];
}
