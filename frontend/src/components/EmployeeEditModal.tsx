import { useCallback, useEffect, useState } from "react";
import { getDepartments } from "../api/departments";
import { getPositions } from "../api/positions";
import { updateEmployee } from "../api/employees";
import { apiError } from "../api/workspace";
import { EMPLOYEE_STATUS_LABELS, type Employee, type Department, type Position } from "../types";
import CreateModal from "./CreateModal";
import { Modal, LoadState } from "./AcademyUI";

export default function EmployeeEditModal({ employee, onClose, onSaved }: { employee: Employee; onClose: () => void; onSaved: (employee: Employee) => void | Promise<void> }) {
  const [options, setOptions] = useState<{ departments: Department[]; positions: Position[] }>();
  const [error, setError] = useState("");
  const load = useCallback(() => {
    setError("");
    Promise.all([getDepartments(), getPositions()]).then(([departments, positions]) => setOptions({ departments: departments.filter((d: Department) => d.company_id === employee.company_id), positions: positions.filter((p: Position) => p.company_id === employee.company_id) })).catch(e => setError(apiError(e)));
  }, [employee.company_id]);
  useEffect(load, [load]);
  if (!options) return <Modal title="Редактирование сотрудника" onClose={onClose}><LoadState error={error} retry={load} /></Modal>;

  const fields = [
    { name: "full_name", label: "ФИО *", required: true, maxLength: 255 },
    { name: "email", label: "Email", maxLength: 255 },
    { name: "phone", label: "Телефон", type: "tel", maxLength: 50 },
    { name: "department_id", label: "Отдел", type: "select", options: [{ value: "", label: "— не выбран —" }, ...options.departments.map(d => ({ value: d.id, label: d.name }))] },
    { name: "position_id", label: "Должность", type: "select", options: [{ value: "", label: "— не выбрана —" }, ...options.positions.map(p => ({ value: p.id, label: p.name }))] },
    { name: "status", label: "Статус", type: "select", options: Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
    { name: "hire_date", label: "Дата приёма", type: "date" },
  ];
  async function save(form: Record<string, string>) {
    const name = form.full_name.trim();
    if (!name) throw { response: { data: { detail: "Введите ФИО сотрудника" } } };
    const updated: Employee = await updateEmployee(employee.id, {
      full_name: name,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      department_id: form.department_id || null,
      position_id: form.position_id || null,
      status: form.status as Employee["status"],
      hire_date: form.hire_date || null,
    });
    await onSaved(updated);
    onClose();
  }
  return <CreateModal title="Редактирование сотрудника" fields={fields} initialValues={{ full_name: employee.full_name, email: employee.email ?? "", phone: employee.phone ?? "", department_id: employee.department_id ?? "", position_id: employee.position_id ?? "", status: employee.status, hire_date: employee.hire_date ?? "" }} submitLabel="Сохранить" errorMessage="Не удалось сохранить сотрудника" onCreate={save} onClose={onClose} />;
}
