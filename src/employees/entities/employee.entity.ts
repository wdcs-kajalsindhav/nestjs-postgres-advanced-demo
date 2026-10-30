import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Department } from './department.entity';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  email: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  salary: string;

  @Column({ name: 'department_id', type: 'bigint', nullable: true })
  departmentId: string | null;

  @ManyToOne(() => Department, (department) => department.employees, {
    nullable: true,
  })
  @JoinColumn({ name: 'department_id' })
  department: Department | null;

  @Column({ name: 'manager_id', type: 'bigint', nullable: true })
  managerId: string | null;

  @ManyToOne(() => Employee, (employee) => employee.directReports, {
    nullable: true,
  })
  @JoinColumn({ name: 'manager_id' })
  manager: Employee | null;

  @OneToMany(() => Employee, (employee) => employee.manager)
  directReports: Employee[];

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    nullable: false,
    default: () => 'now()',
  })
  createdAt: Date | null;
}
