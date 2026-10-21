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

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    nullable: true,
    default: () => 'now()',
  })
  createdAt: Date | null;
}
