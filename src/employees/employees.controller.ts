import { Controller, Get, Param, Query } from '@nestjs/common';
import { EmployeesService } from './employees.service';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get('inner-join')
  async innerJoin() {
    return this.employeesService.innerJoin();
  }

  @Get('left-join')
  async leftJoin() {
    return this.employeesService.leftJoin();
  }

  @Get('right-join')
  async rightJoin() {
    return this.employeesService.rightJoin();
  }

  @Get('full-join')
  async fullJoin() {
    return this.employeesService.fullJoin();
  }

  @Get('department-summary')
  async departmentSummary() {
    return this.employeesService.departmentSummary();
  }

  @Get('above-department-average')
  async aboveDepartmentAverage() {
    return this.employeesService.aboveDepartmentAverage();
  }

  @Get('top-two-per-department')
  async topTwoPerDepartment() {
    return this.employeesService.topTwoPerDepartment();
  }

  @Get('departments-with-employees')
  async departmentsWithEmployees() {
    return this.employeesService.departmentsWithEmployees();
  }

  @Get('departments-without-employees')
  async departmentsWithoutEmployees() {
    return this.employeesService.departmentsWithoutEmployees();
  }

  @Get('salary-rankings')
  async salaryRankings() {
    return this.employeesService.salaryRankings();
  }

  @Get('high-average-departments')
  async highAverageDepartments() {
    return this.employeesService.highAverageDepartments();
  }

  @Get('search')
  searchEmployees(
    @Query('departmentId') departmentId?: string,
    @Query('minSalary') minSalary?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.employeesService.searchEmployees(
      departmentId,
      minSalary === undefined ? undefined : Number(minSalary),
      limit === undefined ? 10 : Number(limit),
      offset === undefined ? 0 : Number(offset),
    );
  }

  @Get('advanced-salary-analytics')
  async advancedSalaryAnalytics() {
    return this.employeesService.advancedSalaryAnalytics();
  }

  @Get('hierarchy')
  employeeHierarchy() {
    return this.employeesService.employeeHierarchy();
  }

  @Get('conditional-aggregation')
  conditionalAggregation() {
    return this.employeesService.conditionalAggregation();
  }

  @Get('window-frames')
  salaryWindowFrames() {
    return this.employeesService.salaryWindowFrames();
  }

  @Get('set-operations')
  employeeSetOperations() {
    return this.employeesService.employeeSetOperations();
  }

  @Get('keyset-pagination')
  keysetPagination(
    @Query('cursorSalary') cursorSalary?: string,
    @Query('cursorId') cursorId?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit === undefined ? 10 : Number(limit);

    return this.employeesService.keysetPagination(
      cursorSalary,
      cursorId,
      parsedLimit,
    );
  }

  @Get('department-json')
  departmentsWithEmployeesJson() {
    return this.employeesService.departmentsWithEmployeesJson();
  }

  @Get('highest-paid-per-department')
  highestPaidPerDepartment() {
    return this.employeesService.highestPaidPerDepartment();
  }
}