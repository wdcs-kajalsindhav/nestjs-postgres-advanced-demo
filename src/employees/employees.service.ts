import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class EmployeesService {
  constructor(private readonly dataSource: DataSource) {}

  //INNER JOIN
  async innerJoin() {
    return this.dataSource.query(`
      SELECT
        e.id,
        e.name,
        e.salary,
        d.name AS department
      FROM employees e
      INNER JOIN departments d
        ON d.id = e.department_id
      ORDER BY e.id
    `);
  }

  //LEFT JOIN
  async leftJoin() {
    return this.dataSource.query(`
      SELECT
        e.id,
        e.name,
        e.salary,
        d.name AS department
      FROM employees e
      LEFT JOIN departments d
        ON d.id = e.department_id
      ORDER BY e.id
    `);
  }

  //RIGHT JOIN: retain departments with no employees
  async rightJoin() {
    return this.dataSource.query(`
      SELECT
        e.name AS employee,
        d.name AS department
      FROM employees e
      RIGHT JOIN departments d
        ON d.id = e.department_id
      ORDER BY d.id, e.id
    `);
  }

  //FULL OUTER JOIN
  async fullJoin() {
    return this.dataSource.query(`
      SELECT
        e.name AS employee,
        d.name AS department
      FROM employees e
      FULL OUTER JOIN departments d
        ON d.id = e.department_id
      ORDER BY d.name NULLS LAST, e.name NULLS LAST
    `);
  }

  //Aggregate functions and GROUP BY
  async departmentSummary() {
    return this.dataSource.query(`
      SELECT
        d.id,
        d.name AS department,
        COUNT(e.id) AS employee_count,
        COALESCE(SUM(e.salary), 0) AS total_salary,
        ROUND(AVG(e.salary), 2) AS average_salary
      FROM departments d
      LEFT JOIN employees e
        ON e.department_id = d.id
      GROUP BY d.id, d.name
      ORDER BY d.id
    `);
  }

  //Correlated subquery
  async aboveDepartmentAverage() {
    return this.dataSource.query(`
      SELECT
        e.id,
        e.name,
        e.salary,
        d.name AS department
      FROM employees e
      JOIN departments d
        ON d.id = e.department_id
      WHERE e.salary > (
        SELECT AVG(e2.salary)
        FROM employees e2
        WHERE e2.department_id = e.department_id
      )
      ORDER BY d.name, e.salary DESC
    `);
  }

  //LATERAL JOIN: top 2 employees per department
  async topTwoPerDepartment() {
    return this.dataSource.query(`
      SELECT
        d.name AS department,
        top_emp.id AS employee_id,
        top_emp.name AS employee,
        top_emp.salary
      FROM departments d
      LEFT JOIN LATERAL (
        SELECT e.id, e.name, e.salary
        FROM employees e
        WHERE e.department_id = d.id
        ORDER BY e.salary DESC, e.id
        LIMIT 2
      ) top_emp ON TRUE
      ORDER BY d.id, top_emp.salary DESC NULLS LAST, top_emp.id
    `);
  }

  //EXISTS: departments containing employees
  async departmentsWithEmployees() {
    return this.dataSource.query(`
      SELECT d.id, d.name
      FROM departments d
      WHERE EXISTS (
        SELECT 1
        FROM employees e
        WHERE e.department_id = d.id
      )
      ORDER BY d.id
    `);
  }

  //NOT EXISTS: departments without employees
  async departmentsWithoutEmployees() {
    return this.dataSource.query(`
      SELECT d.id, d.name
      FROM departments d
      WHERE NOT EXISTS (
        SELECT 1
        FROM employees e
        WHERE e.department_id = d.id
      )
      ORDER BY d.id
    `);
  }

  //Window functions
  async salaryRankings() {
    return this.dataSource.query(`
      SELECT
        e.id,
        e.name,
        e.salary,
        d.name AS department,
        DENSE_RANK() OVER (
          PARTITION BY e.department_id
          ORDER BY e.salary DESC
        ) AS salary_rank_in_dept,
        ROUND(
          AVG(e.salary) OVER (
            PARTITION BY e.department_id
          ),
          2
        ) AS dept_avg_salary
      FROM employees e
      LEFT JOIN departments d
        ON d.id = e.department_id
      ORDER BY d.name NULLS LAST, salary_rank_in_dept, e.id
    `);
  }

  //CTE: summarize salaries before filtering
  async highAverageDepartments() {
    return this.dataSource.query(
      `
      WITH department_stats AS (
        SELECT
          d.id,
          d.name AS department,
          COUNT(e.id) AS employee_count,
          AVG(e.salary) AS avg_salary
        FROM departments d
        LEFT JOIN employees e
          ON e.department_id = d.id
        GROUP BY d.id, d.name
      )
      SELECT
        id,
        department,
        employee_count,
        ROUND(avg_salary, 2) AS avg_salary
      FROM department_stats
      WHERE avg_salary > $1::numeric
      ORDER BY avg_salary DESC
    `,
      [60000],
    );
  }

  async searchEmployees(
    departmentId?: string,
    minSalary?: number,
    limit = 10,
    offset = 0,
  ) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (departmentId !== undefined) {
      params.push(departmentId);
      conditions.push(`e.department_id = $${params.length}::bigint`);
    }

    if (minSalary !== undefined) {
      params.push(minSalary);
      conditions.push(`e.salary >= $${params.length}::numeric`);
    }

    params.push(limit);
    const limitParam = params.length;

    params.push(offset);
    const offsetParam = params.length;

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    return this.dataSource.query(
      `
      SELECT
        e.id,
        e.name,
        e.email,
        e.salary,
        d.name AS department
      FROM employees e
      LEFT JOIN departments d
        ON d.id = e.department_id
      ${whereClause}
      ORDER BY e.salary DESC, e.id ASC
      LIMIT $${limitParam}::integer
      OFFSET $${offsetParam}::integer
    `,
      params,
    );
  }

  async advancedSalaryAnalytics() {
    return this.dataSource.query(`
    SELECT
      e.id,
      e.name,
      e.salary,
      d.name AS department,

      -- Unique position within each department
      ROW_NUMBER() OVER (
        PARTITION BY e.department_id
        ORDER BY e.salary DESC, e.id
      ) AS row_num,

      -- Employees with equal salaries receive the same rank
      RANK() OVER (
        PARTITION BY e.department_id
        ORDER BY e.salary DESC
      ) AS salary_rank,

      DENSE_RANK() OVER (
        PARTITION BY e.department_id
        ORDER BY e.salary DESC
      ) AS dense_salary_rank,

      -- Department-level statistics
      ROUND(
        AVG(e.salary) OVER (
          PARTITION BY e.department_id
        ),
        2
      ) AS department_avg_salary,

      -- Difference from the department average
      ROUND(
        e.salary - AVG(e.salary) OVER (
          PARTITION BY e.department_id
        ),
        2
      ) AS difference_from_average,

      -- Running salary total, highest salary first
      SUM(e.salary) OVER (
        PARTITION BY e.department_id
        ORDER BY e.salary DESC, e.id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS running_salary_total,

      -- Salary of the next employee in the ranking
      LEAD(e.salary) OVER (
        PARTITION BY e.department_id
        ORDER BY e.salary DESC, e.id
      ) AS next_salary

    FROM employees e
    LEFT JOIN departments d
      ON d.id = e.department_id

    ORDER BY d.name NULLS LAST, row_num;
  `);
  }
}
