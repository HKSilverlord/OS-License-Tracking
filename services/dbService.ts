
import { projectService } from './ProjectService';
import { recordService } from './RecordService';
import { periodService } from './PeriodService';
import { dashboardService } from './DashboardService';

// Facade to maintain backward compatibility import { dbService } from ...
export const dbService = {
  // Projects
  getProjects: projectService.getProjects.bind(projectService),
  getProjectsForCarryOver: projectService.getProjectsForCarryOver.bind(projectService),
  createProject: projectService.createProject.bind(projectService),
  updateProject: projectService.updateProject.bind(projectService),
  updateProjectPriceForPeriod: projectService.updateProjectPriceForPeriod.bind(projectService),
  updateProjectPriceForYear: projectService.updateProjectPriceForYear.bind(projectService),
  deleteProject: projectService.deleteProject.bind(projectService),
  deleteProjects: projectService.deleteProjects.bind(projectService),
  copyProjectsToPeriod: projectService.copyProjectsToPeriod.bind(projectService),
  getAllProjectsForPeriodManagement: projectService.getAllProjectsForPeriodManagement.bind(projectService),
  moveProjectUp: projectService.moveProjectUp.bind(projectService),
  moveProjectDown: projectService.moveProjectDown.bind(projectService),
  generateNextProjectCode: projectService.generateNextProjectCode.bind(projectService),

  // Records
  getRecords: recordService.getRecords.bind(recordService),
  getAllRecords: recordService.getAllRecords.bind(recordService),
  upsertRecord: recordService.upsertRecord.bind(recordService),

  // Periods
  getPeriods: periodService.getPeriods.bind(periodService),
  addPeriod: periodService.addPeriod.bind(periodService),
  getPeriodsWithProjectCount: periodService.getPeriodsWithProjectCount.bind(periodService),
  createPeriodWithProjects: periodService.createPeriodWithProjects.bind(periodService),
  updatePeriodProjects: periodService.updatePeriodProjects.bind(periodService),
  deletePeriod: periodService.deletePeriod.bind(periodService),
  getProjectsForPeriod: periodService.getProjectsForPeriod.bind(periodService),

  // Dashboard & Settings
  getDashboardStats: dashboardService.getDashboardStats.bind(dashboardService),
  getRecordYears: dashboardService.getRecordYears.bind(dashboardService),
  getYearlyAggregatedData: dashboardService.getYearlyAggregatedData.bind(dashboardService),
  getMonthlyAggregatedData: dashboardService.getMonthlyAggregatedData.bind(dashboardService),
  getCapacityLine: dashboardService.getCapacityLine.bind(dashboardService),
  getSettings: dashboardService.getSettings.bind(dashboardService),
  saveSettings: dashboardService.saveSettings.bind(dashboardService),
};
