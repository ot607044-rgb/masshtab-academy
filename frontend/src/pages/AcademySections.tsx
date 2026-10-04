import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import LessonsPage from "./LessonsPage";
import TestsPage from "./TestsPage";
import MyLessonsPage from "./MyLessonsPage";
import DepartmentsPage from "./DepartmentsPage";
import PositionsPage from "./PositionsPage";
import StructureMapPage from "./StructureMapPage";
import { useAuth } from "../context/AuthContext";

export function LearningPage() {
  const { user } = useAuth();
  return user?.role === "employee" ? <MyLessonsPage /> : <LessonsPage />;
}
export function MaterialsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "tests" ? "tests" : "lessons";
  const setTab = (value: string) => setParams({ tab: value }, { replace: true });
  return <><div className="academy-tabs" style={{ margin: "20px 28px 0" }} role="tablist"><button role="tab" aria-selected={tab === "lessons"} className={tab === "lessons" ? "active" : ""} onClick={() => setTab("lessons")}>Материалы и уроки</button><button role="tab" aria-selected={tab === "tests"} className={tab === "tests" ? "active" : ""} onClick={() => setTab("tests")}>Тесты</button></div>{tab === "lessons" ? <LessonsPage /> : <TestsPage />}</>;
}
export function OrganizationPage() {
  const [tab, setTab] = useState("map");
  return <><div className="academy-tabs" style={{ margin: "20px 28px 0" }} role="tablist"><button role="tab" aria-selected={tab === "map"} className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}>Карта</button><button role="tab" aria-selected={tab === "departments"} className={tab === "departments" ? "active" : ""} onClick={() => setTab("departments")}>Отделы</button><button role="tab" aria-selected={tab === "positions"} className={tab === "positions" ? "active" : ""} onClick={() => setTab("positions")}>Должности</button></div>{tab === "map" ? <StructureMapPage /> : tab === "departments" ? <DepartmentsPage /> : <PositionsPage />}</>;
}
