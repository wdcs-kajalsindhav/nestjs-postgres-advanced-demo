import { BadRequestException, Injectable } from '@nestjs/common';
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

  //RIGHT JOIN:
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

  //group by and aggregate functions
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

  //LATERAL JOIN
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

  //Window functions  dense_rank() and avg() with partitioning
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

  //CTEs
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
    //Validate departmentId
    if (departmentId !== undefined && !/^[1-9]\d*$/.test(departmentId)) {
      throw new BadRequestException('departmentId must be a positive integer');
    }

    //Validate minSalary
    if (
      minSalary !== undefined &&
      (!Number.isFinite(minSalary) || minSalary < 0)
    ) {
      throw new BadRequestException('minSalary must be a non-negative number');
    }

    //Validate limit
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException(
        'limit must be an integer between 1 and 100',
      );
    }

    //Validate offset
    if (!Number.isInteger(offset) || offset < 0) {
      throw new BadRequestException('offset must be a non-negative integer');
    }

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

    // Pagination parameters
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

  //
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

  //recursive CTE for employee hierarchy
  async employeeHierarchy() {
    return this.dataSource.query(`
    WITH RECURSIVE employee_hierarchy AS (
      -- Anchor: employees without managers
      SELECT
        e.id,
        e.name,
        e.manager_id,
        1 AS hierarchy_level,
        ARRAY[e.id] AS visited_ids,
        false AS has_cycle
      FROM employees e
      WHERE e.manager_id IS NULL

      UNION ALL

      -- Find employees reporting to each manager
      SELECT
        e.id,
        e.name,
        e.manager_id,
        h.hierarchy_level + 1,
        h.visited_ids || e.id,
        e.id = ANY(h.visited_ids) AS has_cycle
      FROM employees e
      INNER JOIN employee_hierarchy h
        ON e.manager_id = h.id
      WHERE NOT h.has_cycle
        AND NOT (e.id = ANY(h.visited_ids))
    )
    SELECT
      id,
      name,
      manager_id,
      hierarchy_level
    FROM employee_hierarchy
    ORDER BY hierarchy_level, id
  `);
  }

  async conditionalAggregation() {
    return this.dataSource.query(`
      SELECT
        d.id AS department_id,
        d.name AS department,

        COUNT(e.id) AS total_employees,

        COUNT(e.id) FILTER (
          WHERE e.salary < 30000
        ) AS low_salary_count,

        COUNT(e.id) FILTER (
          WHERE e.salary >= 30000
            AND e.salary < 60000
        ) AS medium_salary_count,

        COUNT(e.id) FILTER (
          WHERE e.salary >= 60000
        ) AS high_salary_count,

        COALESCE(
          SUM(e.salary) FILTER (
            WHERE e.salary >= 60000
          ),
          0
        ) AS total_high_salary

      FROM departments d
      LEFT JOIN employees e
        ON e.department_id = d.id

      GROUP BY d.id, d.name
      ORDER BY d.id
    `);
  }

  async salaryWindowFrames() {
    return this.dataSource.query(`
      SELECT
        e.id,
        e.name,
        e.salary,
        d.name AS department,

        -- Running total of salaries within each department.
        SUM(e.salary) OVER (
          PARTITION BY e.department_id
          ORDER BY e.salary DESC, e.id
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS running_salary_total,

        -- Average salary of the current and two preceding rows.
        ROUND(
          AVG(e.salary) OVER (
            PARTITION BY e.department_id
            ORDER BY e.salary DESC, e.id
            ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
          ),
          2
        ) AS moving_average_salary

      FROM employees e
      LEFT JOIN departments d
        ON d.id = e.department_id

      ORDER BY d.name NULLS LAST, e.salary DESC, e.id
    `);
  }

  // Set operations: UNION, INTERSECT, EXCEPT
  async employeeSetOperations() {
    return this.dataSource.query(`
      WITH
      high_earners AS (
        SELECT id, name
        FROM employees
        WHERE salary >= 60000
      ),

      it_employees AS (
        SELECT e.id, e.name
        FROM employees e
        INNER JOIN departments d
          ON d.id = e.department_id
        WHERE d.name = 'IT'
      )

      SELECT
        'UNION' AS operation,
        combined.id,
        combined.name
      FROM (
        SELECT id, name FROM high_earners
        UNION
        SELECT id, name FROM it_employees
      ) combined

      UNION ALL

      SELECT
        'INTERSECT' AS operation,
        common.id,
        common.name
      FROM (
        SELECT id, name FROM high_earners
        INTERSECT
        SELECT id, name FROM it_employees
      ) common

      UNION ALL

      SELECT
        'EXCEPT' AS operation,
        remaining.id,
        remaining.name
      FROM (
        SELECT id, name FROM high_earners
        EXCEPT
        SELECT id, name FROM it_employees
      ) remaining

      ORDER BY operation, id
    `);
  }

  // Keyset pagination
  async keysetPagination(cursorSalary?: string, cursorId?: string, limit = 10) {
    //Validate limit
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException(
        'limit must be an integer between 1 and 100',
      );
    }

    //Both cursor values must be provided together
    if ((cursorSalary === undefined) !== (cursorId === undefined)) {
      throw new BadRequestException(
        'cursorSalary and cursorId must be provided together',
      );
    }

    const params: unknown[] = [];
    let cursorCondition = '';

    //Validate cursor values
    if (cursorSalary !== undefined && cursorId !== undefined) {
      // Allow non-negative decimal salaries with up to 2 decimal places.
      // Adjust the precision if your salary column uses a different scale.
      if (
        !/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(cursorSalary) ||
        !/^[1-9]\d*$/.test(cursorId)
      ) {
        throw new BadRequestException('Invalid pagination cursor');
      }

      //Build the cursor condition
      params.push(cursorSalary, cursorId);

      cursorCondition = `
      WHERE (
        e.salary < $1::numeric
        OR (
          e.salary = $1::numeric
          AND e.id > $2::bigint
        )
      )
    `;
    }

    //Add limit
    params.push(limit);
    const limitParameter = params.length;

    //Execute query
    return this.dataSource.query(
      `
      SELECT
        e.id,
        e.name,
        e.salary,
        d.name AS department
      FROM employees e
      LEFT JOIN departments d
        ON d.id = e.department_id
      ${cursorCondition}
      ORDER BY e.salary DESC, e.id ASC
      LIMIT $${limitParameter}::integer
    `,
      params,
    );
  }

  // Departments with employees in JSON format
  async departmentsWithEmployeesJson() {
    return this.dataSource.query(`
      SELECT
        d.id AS department_id,
        d.name AS department,

        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', e.id,
              'name', e.name,
              'salary', e.salary
            )
            ORDER BY e.id
          ) FILTER (WHERE e.id IS NOT NULL),
          '[]'::jsonb
        ) AS employees

      FROM departments d
      LEFT JOIN employees e
        ON e.department_id = d.id

      GROUP BY d.id, d.name
      ORDER BY d.id
    `);
  }

  //distinct on to get the highest paid employee per department
  async highestPaidPerDepartment() {
    return this.dataSource.query(`
      SELECT DISTINCT ON (e.department_id)
        e.id,
        e.name,
        e.salary,
        d.name AS department

      FROM employees e
      INNER JOIN departments d
        ON d.id = e.department_id

      ORDER BY
        e.department_id,
        e.salary DESC,
        e.id ASC
    `);
  }
}
