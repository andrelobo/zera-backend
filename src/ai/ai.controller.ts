import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { Roles } from '../modules/auth/guards/roles.decorator';
import { RolesGuard } from '../modules/auth/guards/roles.guard';
import { DiagnoseAgent } from './agents/diagnose.agent';
import { DiagnoseEmissionDto } from './dto/diagnose-emission.dto';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager', 'user')
export class AiController {
  constructor(private readonly diagnoseAgent: DiagnoseAgent) {}

  @Post('diagnostics/emission')
  @ApiOperation({
    summary: 'Diagnosticar uma emissão com heurística determinística e contexto operacional',
  })
  @ApiBody({ type: DiagnoseEmissionDto })
  diagnoseEmission(@Body() dto: DiagnoseEmissionDto) {
    return this.diagnoseAgent.diagnoseEmission(dto);
  }
}
